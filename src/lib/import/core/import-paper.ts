import { access } from "node:fs/promises";
import path from "node:path";

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
import { cropsRoot, ensureDataDirs } from "@/lib/paths";

const PAPER_SOURCE_PROVIDER = "PMT";
const SUBJECT_INDEX_URL = "https://www.physicsandmathstutor.com/past-papers/";
const FAMILY_PAGE_URL = "https://www.physicsandmathstutor.com/past-papers/gcse-science/";
const RENDER_SCALE = 2;
const ADAPTER_KEY = "aqa-combined-science-physics-paper-1-higher";

type BenchmarkYear = 2023 | 2024;
type QuestionRecord = Awaited<ReturnType<typeof buildQuestionRecordData>>[number];
type ImportTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

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

  try {
    const questionItems = await extractPdfTextItems(questionPaperPath);
    const markSchemeItems = await extractPdfTextItems(markSchemePath);
    const drafts = adapter.detectQuestionDrafts({
      year,
      questionItems,
      markSchemeItems,
    });

    if (drafts.length === 0) {
      throw new ImportFailure("adapter", `Adapter ${adapter.key} produced no question drafts`, {
        year,
      });
    }

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

    return result;
  } catch (error) {
    await db.paperSource.update({
      where: { id: source.id },
      data: {
        status: "failed",
        lastDiscoveredAt: new Date(),
      },
    });

    if (error instanceof ImportFailure) {
      throw error;
    }

    throw new ImportFailure("persist", `Import failed for ${candidate.sessionLabel}`, {
      year,
    }, {
      cause: error,
    });
  }
}
