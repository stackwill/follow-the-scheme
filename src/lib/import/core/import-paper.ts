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

export type ImportPaperResult = {
  paperId: string;
  questionCount: number;
  sourceId: string;
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

  const left = Math.max(0, Math.floor(pdfBox.left * RENDER_SCALE));
  const top = Math.max(0, Math.floor(imageHeight - pdfBox.top * RENDER_SCALE));
  const width = Math.max(1, Math.ceil((pdfBox.right - pdfBox.left) * RENDER_SCALE));
  const height = Math.max(1, Math.ceil((pdfBox.top - pdfBox.bottom) * RENDER_SCALE));

  return {
    left: Math.min(left, imageWidth - 1),
    top: Math.min(top, imageHeight - 1),
    width: Math.min(width, imageWidth - left),
    height: Math.min(height, imageHeight - top),
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

      await cropRegion(renderPath, cropPath, await pdfBoxToCropBox(renderPath, draft.primaryPdfBox));

      return {
        questionKey: draft.questionKey,
        displayOrder: draft.displayOrder,
        maxMarks: draft.maxMarks,
        extractedQuestionText: draft.extractedQuestionText,
        primaryCropPath: cropPath,
        supportingAssetPaths: JSON.stringify([]),
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

      await transaction.question.deleteMany({
        where: { paperId: paper.id },
      });

      await transaction.question.createMany({
        data: questionRecords.map((record) => ({
          paperId: paper.id,
          ...record,
        })),
      });

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
