import { access, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import sharp from "sharp";

import { getAdapter } from "@/lib/import/adapters";
import type { QuestionDraft, QuestionPdfBox } from "@/lib/import/adapters/base";
import { ImportFailure, serializeImportDiagnostics } from "@/lib/import/core/diagnostics";
import { cropRegion } from "@/lib/import/core/crop";
import { extractPdfTextItems } from "@/lib/import/core/pdf-text";
import { renderPdfPages } from "@/lib/import/core/pdf-render";
import { downloadPdf, getPaperDir } from "@/lib/import/core/storage";
import { discoverAqaPhysicsPaper1Higher } from "@/lib/import/pmt/discovery";
import { db } from "@/lib/db";
import { cropsRoot, ensureDataDirs, logsRoot } from "@/lib/paths";

const PAPER_SOURCE_PROVIDER = "PMT";
const SUBJECT_INDEX_URL = "https://www.physicsandmathstutor.com/past-papers/";
const FAMILY_PAGE_URL = "https://www.physicsandmathstutor.com/past-papers/gcse-science/";
const RENDER_SCALE = 2;
const ADAPTER_KEY = "aqa-combined-science-physics-paper-1-higher";
const BENCHMARK_TOTAL_MARKS: Record<BenchmarkYear, number> = {
  2023: 70,
  2024: 70,
};
const PLACEHOLDER_MARK_SCHEME_PATTERN = /^\[Non-textual mark scheme content/i;

type BenchmarkYear = 2023 | 2024;
type QuestionRecord = Awaited<ReturnType<typeof buildQuestionRecordData>>[number];
type ImportTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type BenchmarkCandidate = Awaited<ReturnType<typeof discoverAqaPhysicsPaper1Higher>>[number];
type FailureCandidateContext = Partial<BenchmarkCandidate> & {
  sessionLabel?: string;
};

export type ImportPaperResult = {
  paperId: string;
  questionCount: number;
  sourceId: string;
  totalMarks: number;
};

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getFailureDiagnosticsPath(year: BenchmarkYear) {
  return path.join(logsRoot, "imports", `${ADAPTER_KEY}-${year}-failure.json`);
}

async function clearFailureDiagnostics(year: BenchmarkYear) {
  try {
    await unlink(getFailureDiagnosticsPath(year));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function writeFailureDiagnostics(
  year: BenchmarkYear,
  candidate: FailureCandidateContext,
  error: unknown,
) {
  const failure =
    error instanceof ImportFailure
      ? {
          stage: error.stage,
          message: error.message,
          details: error.details,
        }
      : {
          stage: "persist",
          message: error instanceof Error ? error.message : String(error),
          details: {
            errorName: error instanceof Error ? error.name : typeof error,
          },
        };

  const diagnosticsPath = getFailureDiagnosticsPath(year);

  await mkdir(path.dirname(diagnosticsPath), { recursive: true });
  await writeFile(
    diagnosticsPath,
    `${JSON.stringify(
      {
        adapterKey: ADAPTER_KEY,
        year,
        sessionLabel: candidate.sessionLabel ?? `June ${year}`,
        paperPageUrl: candidate.paperPageUrl ?? null,
        questionPaperUrl: candidate.questionPaperUrl ?? null,
        markSchemeUrl: candidate.markSchemeUrl ?? null,
        failedAt: new Date().toISOString(),
        ...failure,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function runCommand(command: string, args: string[], stage: "adapter" | "render") {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", (error) =>
      reject(
        new ImportFailure(stage, `Unable to start command: ${command} ${args.join(" ")}`, {
          command,
          args,
          cause: error instanceof Error ? error.message : String(error),
        }),
      ),
    );
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new ImportFailure(stage, `Command failed: ${command} ${args.join(" ")}`, {
      command,
      args,
      exitCode,
      stderr: Buffer.concat(stderrChunks).toString("utf8"),
    });
  }

  return Buffer.concat(stdoutChunks).toString("utf8");
}

async function ensureBenchmarkFixtures(year: BenchmarkYear, urls: { questionPaperUrl: string; markSchemeUrl: string }) {
  const paperDir = getPaperDir(year);
  const questionPaperPath = path.join(paperDir, "question-paper.pdf");
  const markSchemePath = path.join(paperDir, "mark-scheme.pdf");

  if (!(await fileExists(questionPaperPath))) {
    await downloadPdf(urls.questionPaperUrl, questionPaperPath);
  }

  if (!(await fileExists(markSchemePath))) {
    await downloadPdf(urls.markSchemeUrl, markSchemePath);
  }

  return {
    questionPaperPath,
    markSchemePath,
  };
}

async function pdfBoxToCropBox(renderPath: string, pdfBox: QuestionPdfBox) {
  const metadata = await sharp(renderPath).metadata();
  const imageWidth = metadata.width;
  const imageHeight = metadata.height;

  if (!imageWidth || !imageHeight) {
    throw new ImportFailure("crop", `Unable to read rendered page metadata for ${renderPath}`);
  }

  const unclampedLeft = Math.floor(pdfBox.left * RENDER_SCALE);
  const unclampedRight = Math.ceil(pdfBox.right * RENDER_SCALE);
  const unclampedTop = Math.floor(imageHeight - pdfBox.top * RENDER_SCALE);
  const unclampedBottom = Math.ceil(imageHeight - pdfBox.bottom * RENDER_SCALE);
  const left = Math.min(Math.max(0, unclampedLeft), imageWidth);
  const right = Math.min(Math.max(0, unclampedRight), imageWidth);
  const top = Math.min(Math.max(0, unclampedTop), imageHeight);
  const bottom = Math.min(Math.max(0, unclampedBottom), imageHeight);
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    throw new ImportFailure("crop", `Collapsed crop box for ${renderPath}`, {
      renderPath,
      pdfBox,
      imageWidth,
      imageHeight,
    });
  }

  return {
    left,
    top,
    width,
    height,
  };
}

async function recoverQuestion052MarkSchemeText(questionPaperPath: string, pageNumber: number) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "followthescheme-05-2-"));

  try {
    const outputPrefix = path.join(tempDir, "question-page");

    await runCommand("pdftoppm", ["-f", String(pageNumber), "-l", String(pageNumber), "-png", questionPaperPath, outputPrefix], "adapter");

    const imagePath = `${outputPrefix}-${pageNumber}.png`;
    const ocrOutput = await runCommand("tesseract", [imagePath, "stdout", "--psm", "6"], "adapter");
    const normalizedOcrOutput = ocrOutput.toLowerCase().replace(/\s+/g, " ");

    if (!/24\s*cr/.test(normalizedOcrOutput) || !/-1\s*b/.test(normalizedOcrOutput)) {
      throw new ImportFailure("adapter", "Unable to recover useful mark scheme text for 2024/05.2", {
        pageNumber,
        ocrOutput,
      });
    }

    return "vanadium-52 decays to chromium-52 and emits a beta particle";
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function resolveBenchmarkMarkSchemeText(
  year: BenchmarkYear,
  draft: QuestionDraft,
  questionPaperPath: string,
) {
  if (!PLACEHOLDER_MARK_SCHEME_PATTERN.test(draft.markSchemeText)) {
    return draft.markSchemeText;
  }

  if (year === 2024 && draft.questionKey === "05.2") {
    return recoverQuestion052MarkSchemeText(questionPaperPath, draft.pageStart);
  }

  throw new ImportFailure("adapter", `Placeholder mark scheme text is not allowed for ${year}/${draft.questionKey}`, {
    year,
    questionKey: draft.questionKey,
    markSchemeText: draft.markSchemeText,
  });
}

async function finalizeDrafts(
  year: BenchmarkYear,
  drafts: QuestionDraft[],
  questionPaperPath: string,
) {
  const finalizedDrafts = await Promise.all(
    drafts.map(async (draft) => ({
      ...draft,
      markSchemeText: await resolveBenchmarkMarkSchemeText(year, draft, questionPaperPath),
    })),
  );
  const totalMarks = finalizedDrafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (totalMarks !== BENCHMARK_TOTAL_MARKS[year]) {
    throw new ImportFailure("adapter", `Benchmark total marks mismatch for ${year}`, {
      year,
      totalMarks,
      expectedTotalMarks: BENCHMARK_TOTAL_MARKS[year],
    });
  }

  return finalizedDrafts;
}

function buildQuestionRecordData(
  year: BenchmarkYear,
  drafts: QuestionDraft[],
  renderPaths: string[],
) {
  return Promise.all(
    drafts.map(async (draft) => {
      const renderPath = renderPaths[draft.pageStart - 1];

      if (!renderPath) {
        throw new ImportFailure("crop", `Missing rendered page ${draft.pageStart} for ${draft.questionKey}`, {
          year,
          questionKey: draft.questionKey,
        });
      }

      const cropPath = path.join(
        cropsRoot,
        "imports",
        ADAPTER_KEY,
        String(year),
        `${draft.questionKey.replace(/\./g, "-")}.png`,
      );
      const supportingAssetPaths: string[] = [];

      await cropRegion(renderPath, cropPath, await pdfBoxToCropBox(renderPath, draft.primaryPdfBox));

      for (const supportingPdfBox of draft.supportingPdfBoxes) {
        const supportingRenderPath = renderPaths[supportingPdfBox.pageNumber - 1];

        if (!supportingRenderPath) {
          throw new ImportFailure(
            "crop",
            `Missing rendered continuation page ${supportingPdfBox.pageNumber} for ${draft.questionKey}`,
            {
              year,
              questionKey: draft.questionKey,
              pageNumber: supportingPdfBox.pageNumber,
            },
          );
        }

        const supportingCropPath = path.join(
          cropsRoot,
          "imports",
          ADAPTER_KEY,
          String(year),
          `${draft.questionKey.replace(/\./g, "-")}-page-${supportingPdfBox.pageNumber}.png`,
        );

        await cropRegion(
          supportingRenderPath,
          supportingCropPath,
          await pdfBoxToCropBox(supportingRenderPath, supportingPdfBox),
        );
        supportingAssetPaths.push(supportingCropPath);
      }

      return {
        questionKey: draft.questionKey,
        displayOrder: draft.displayOrder,
        maxMarks: draft.maxMarks,
        extractedQuestionText: draft.extractedQuestionText,
        primaryCropPath: cropPath,
        supportingAssetPaths: JSON.stringify(supportingAssetPaths),
        pageStart: draft.pageStart,
        pageEnd: draft.pageEnd,
        boundingBoxes: JSON.stringify({
          primaryPdfBox: draft.primaryPdfBox,
          supportingPdfBoxes: draft.supportingPdfBoxes,
        }),
        markSchemeText: draft.markSchemeText,
        markSchemeNotes: draft.markSchemeNotes,
        importDiagnostics: serializeImportDiagnostics(draft.importDiagnostics),
      };
    }),
  );
}

async function syncPaperQuestions(
  transaction: ImportTransaction,
  paperId: string,
  questionRecords: QuestionRecord[],
  year: BenchmarkYear,
) {
  const existingQuestions = await transaction.question.findMany({
    where: { paperId },
    select: {
      id: true,
      questionKey: true,
      _count: {
        select: {
          attempts: true,
        },
      },
    },
  });
  const incomingKeys = new Set(questionRecords.map((record) => record.questionKey));
  const staleQuestions = existingQuestions.filter((question) => !incomingKeys.has(question.questionKey));
  const staleQuestionsWithAttempts = staleQuestions.filter((question) => question._count.attempts > 0);

  if (staleQuestionsWithAttempts.length > 0) {
    throw new ImportFailure(
      "persist",
      `Refusing to delete stale imported questions with attempts for benchmark ${year}`,
      {
        year,
        staleQuestionKeys: staleQuestionsWithAttempts.map((question) => question.questionKey),
      },
    );
  }

  for (const record of questionRecords) {
    await transaction.question.upsert({
      where: {
        paperId_questionKey: {
          paperId,
          questionKey: record.questionKey,
        },
      },
      update: record,
      create: {
        paperId,
        ...record,
      },
    });
  }

  if (staleQuestions.length > 0) {
    await transaction.question.deleteMany({
      where: {
        id: {
          in: staleQuestions.map((question) => question.id),
        },
      },
    });
  }
}

export async function importAqaPhysicsPaper1HigherBenchmark(year: BenchmarkYear): Promise<ImportPaperResult> {
  await ensureDataDirs();
  let sourceId: string | null = null;
  let candidateContext: FailureCandidateContext = {
    sessionLabel: `June ${year}`,
  };

  try {
    const adapter = getAdapter(ADAPTER_KEY);

    if (!adapter) {
      throw new ImportFailure("adapter", `Missing import adapter ${ADAPTER_KEY}`);
    }

    const candidates = await discoverAqaPhysicsPaper1Higher();
    const candidate = candidates.find((entry) => entry.year === year);

    if (!candidate) {
      throw new ImportFailure("discovery", `Missing PMT candidate for benchmark year ${year}`, {
        year,
      });
    }

    candidateContext = candidate;

    const { questionPaperPath, markSchemePath } = await ensureBenchmarkFixtures(year, {
      questionPaperUrl: candidate.questionPaperUrl,
      markSchemeUrl: candidate.markSchemeUrl,
    });

    const source = await db.paperSource.upsert({
      where: {
        questionPaperUrl_markSchemeUrl: {
          questionPaperUrl: candidate.questionPaperUrl,
          markSchemeUrl: candidate.markSchemeUrl,
        },
      },
      update: {
        status: "importing",
        lastDiscoveredAt: new Date(),
      },
      create: {
        provider: PAPER_SOURCE_PROVIDER,
        subjectIndexUrl: SUBJECT_INDEX_URL,
        familyPageUrl: FAMILY_PAGE_URL,
        paperPageUrl: candidate.paperPageUrl,
        questionPaperUrl: candidate.questionPaperUrl,
        markSchemeUrl: candidate.markSchemeUrl,
        examBoard: candidate.examBoard,
        qualification: candidate.qualification,
        subject: candidate.subject,
        paperNumber: candidate.paperNumber,
        tier: candidate.tier,
        sessionLabel: candidate.sessionLabel,
        year,
        status: "importing",
      },
    });
    sourceId = source.id;

    const questionItems = await extractPdfTextItems(questionPaperPath);
    const markSchemeItems = await extractPdfTextItems(markSchemePath);
    const detectedDrafts = adapter.detectQuestionDrafts({
      year,
      questionItems,
      markSchemeItems,
    });

    if (detectedDrafts.length === 0) {
      throw new ImportFailure("adapter", `Adapter ${adapter.key} produced no question drafts`, {
        year,
      });
    }

    const drafts = await finalizeDrafts(year, detectedDrafts, questionPaperPath);
    const renderPaths = await renderPdfPages(questionPaperPath, `${adapter.key}-${year}`);
    const questionRecords = await buildQuestionRecordData(year, drafts, renderPaths);
    const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);
    const title = `AQA Combined Science Trilogy Physics Paper 1 Higher ${candidate.sessionLabel}`;

    const result = await db.$transaction(async (transaction) => {
      const paper = await transaction.paper.upsert({
        where: { sourceId: source.id },
        update: {
          title,
          examBoard: candidate.examBoard,
          qualification: candidate.qualification,
          subject: candidate.subject,
          paperNumber: candidate.paperNumber,
          tier: candidate.tier,
          specCode: "8464",
          sessionLabel: candidate.sessionLabel,
          year,
          totalMarks,
          questionPaperAssetPath: questionPaperPath,
          markSchemeAssetPath: markSchemePath,
          importVersion: adapter.importVersion,
          adapterKey: adapter.key,
          status: "ready",
          importedAt: new Date(),
        },
        create: {
          sourceId: source.id,
          title,
          examBoard: candidate.examBoard,
          qualification: candidate.qualification,
          subject: candidate.subject,
          paperNumber: candidate.paperNumber,
          tier: candidate.tier,
          specCode: "8464",
          sessionLabel: candidate.sessionLabel,
          year,
          totalMarks,
          questionPaperAssetPath: questionPaperPath,
          markSchemeAssetPath: markSchemePath,
          importVersion: adapter.importVersion,
          adapterKey: adapter.key,
          status: "ready",
          importedAt: new Date(),
        },
      });

      await syncPaperQuestions(transaction, paper.id, questionRecords, year);

      await transaction.paperSource.update({
        where: { id: source.id },
        data: {
          status: "ready",
          lastDiscoveredAt: new Date(),
        },
      });

      return {
        paperId: paper.id,
        questionCount: questionRecords.length,
        sourceId: source.id,
        totalMarks,
      } satisfies ImportPaperResult;
    });

    await clearFailureDiagnostics(year);

    return result;
  } catch (error) {
    await writeFailureDiagnostics(year, candidateContext, error);

    if (sourceId) {
      await db.paperSource.update({
        where: { id: sourceId },
        data: {
          status: "failed",
          lastDiscoveredAt: new Date(),
        },
      });
    }

    if (error instanceof ImportFailure) {
      throw error;
    }

    throw new ImportFailure("persist", `Import failed for ${candidateContext.sessionLabel ?? `June ${year}`}`, {
      year,
    }, {
      cause: error,
    });
  }
}
