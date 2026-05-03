import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

import sharp from "sharp";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { importAqaPhysicsPaper1HigherBenchmark } from "@/lib/import/core/import-paper";

const BENCHMARK_EXPECTATIONS = {
  2023: {
    questionCount: 31,
    totalMarks: 70,
  },
  2024: {
    questionCount: 27,
    totalMarks: 70,
  },
} as const;
const PLACEHOLDER_MARK_SCHEME_PATTERN = /^\[Non-textual mark scheme content/i;
const MIN_SUPPORTING_CROP_WIDTH = 800;
const MIN_SUPPORTING_CROP_HEIGHT = 180;
const MIN_BOUNDED_SUPPORTING_CROP_HEIGHT = 40;
const MIN_SUPPORTING_PDF_BOX_HEIGHT = 120;
const MIN_052_PRIMARY_CROP_WIDTH = 900;
const MIN_052_PRIMARY_CROP_HEIGHT = 900;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function getPaperSnapshot(paperId: string) {
  const paper = await db.paper.findFirst({
    where: { id: paperId },
    include: {
      questions: {
        orderBy: {
          displayOrder: "asc",
        },
      },
    },
  });

  assert(paper, `Missing imported paper ${paperId}`);

  return paper;
}

async function assertPaperIntegrity(year: 2023 | 2024, paperId: string) {
  const paper = await getPaperSnapshot(paperId);
  const expectation = BENCHMARK_EXPECTATIONS[year];

  assert(
    paper.questions.length === expectation.questionCount,
    `${year} imported ${paper.questions.length} questions, expected ${expectation.questionCount}`,
  );
  assert(
    paper.totalMarks === expectation.totalMarks,
    `${year} imported ${paper.totalMarks} total marks, expected ${expectation.totalMarks}`,
  );

  const invalidMarkSchemes = paper.questions
    .filter(
      (question) =>
        question.markSchemeText.trim().length === 0 ||
        PLACEHOLDER_MARK_SCHEME_PATTERN.test(question.markSchemeText),
    )
    .map((question) => question.questionKey);

  assert(
    invalidMarkSchemes.length === 0,
    `${year} imported invalid mark scheme text for ${invalidMarkSchemes.join(", ")}`,
  );

  const multiPageQuestions = paper.questions.filter((question) => question.pageEnd > question.pageStart);

  assert(multiPageQuestions.length > 0, `${year} expected at least one multi-page imported question`);

  for (const question of multiPageQuestions) {
    const supportingAssetPaths = JSON.parse(question.supportingAssetPaths) as string[];
    const boundingBoxes = JSON.parse(question.boundingBoxes) as {
      supportingPdfBoxes?: Array<{ pageNumber: number; top: number; bottom: number }>;
    };
    const supportingPdfBoxes = boundingBoxes.supportingPdfBoxes ?? [];

    assert(
      supportingAssetPaths.length > 0,
      `${year}/${question.questionKey} is multi-page but has no supporting crop assets`,
    );
    assert(
      supportingAssetPaths.length === supportingPdfBoxes.length,
      `${year}/${question.questionKey} supporting asset count does not match supporting crop boxes`,
    );

    for (const [index, assetPath] of supportingAssetPaths.entries()) {
      const supportingPdfBox = supportingPdfBoxes[index];
      const supportingPdfBoxHeight =
        supportingPdfBox === undefined ? MIN_SUPPORTING_PDF_BOX_HEIGHT : supportingPdfBox.top - supportingPdfBox.bottom;

      await access(assetPath);
      const metadata = await sharp(assetPath).metadata();

      assert(metadata.width, `Missing crop width metadata for ${assetPath}`);
      assert(metadata.height, `Missing crop height metadata for ${assetPath}`);
      assert(
        metadata.width >= MIN_SUPPORTING_CROP_WIDTH &&
          (metadata.height >= MIN_SUPPORTING_CROP_HEIGHT ||
            (supportingPdfBoxHeight < MIN_SUPPORTING_PDF_BOX_HEIGHT &&
              metadata.height >= MIN_BOUNDED_SUPPORTING_CROP_HEIGHT)),
        `${year}/${question.questionKey} supporting crop ${assetPath} is too small to preserve continuation content (${metadata.width}x${metadata.height})`,
      );
    }
  }

  for (const question of paper.questions) {
    await access(question.primaryCropPath);
    const metadata = await sharp(question.primaryCropPath).metadata();

    assert(metadata.width, `Missing crop width metadata for ${question.primaryCropPath}`);
    assert(metadata.height, `Missing crop height metadata for ${question.primaryCropPath}`);
  }

  if (year === 2024) {
    const question011 = paper.questions.find((question) => question.questionKey === "01.1");
    const question052 = paper.questions.find((question) => question.questionKey === "05.2");

    assert(question011, "Missing imported 2024/01.1 question");
    const question011Boxes = JSON.parse(question011.boundingBoxes) as {
      supportingPdfBoxes?: Array<{ pageNumber: number; top: number; bottom: number }>;
    };
    const question011Page3Box = question011Boxes.supportingPdfBoxes?.find((box) => box.pageNumber === 3);

    assert(question011Page3Box, "Missing imported 2024/01.1 page 3 supporting crop box");
    assert(
      question011Page3Box.top - question011Page3Box.bottom < MIN_SUPPORTING_PDF_BOX_HEIGHT,
      `2024/01.1 page 3 supporting crop should stay bounded before the next question (${question011Page3Box.top}-${question011Page3Box.bottom})`,
    );

    assert(question052, "Missing imported 2024/05.2 question");
    assert(
      question052.pageStart === question052.pageEnd,
      `2024/05.2 should not create a footer-only continuation crop (pages ${question052.pageStart}-${question052.pageEnd})`,
    );

    const primaryMetadata = await sharp(question052.primaryCropPath).metadata();

    assert(primaryMetadata.width, `Missing crop width metadata for ${question052.primaryCropPath}`);
    assert(primaryMetadata.height, `Missing crop height metadata for ${question052.primaryCropPath}`);
    assert(
      primaryMetadata.width >= MIN_052_PRIMARY_CROP_WIDTH &&
        primaryMetadata.height >= MIN_052_PRIMARY_CROP_HEIGHT,
      `2024/05.2 primary crop is too small to preserve raster answer options (${primaryMetadata.width}x${primaryMetadata.height})`,
    );
  }

  return paper;
}

const dbPushExitCode = await new Promise<number>((resolve, reject) => {
  const dbPush = spawn("bunx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: env.DATABASE_URL,
      APP_DATA_DIR: env.APP_DATA_DIR,
    },
    stdio: "inherit",
  });

  dbPush.once("error", reject);
  dbPush.once("exit", (code) => resolve(code ?? 1));
});

if (dbPushExitCode !== 0) {
  throw new Error("Failed to apply Prisma schema before smoke import");
}

const importedPaperIds: string[] = [];

for (const year of [2023, 2024] as const) {
  const initialResult = await importAqaPhysicsPaper1HigherBenchmark(year);
  importedPaperIds.push(initialResult.paperId);
  const initialPaper = await assertPaperIntegrity(year, initialResult.paperId);
  const initialQuestionIds = new Map(
    initialPaper.questions.map((question) => [question.questionKey, question.id] as const),
  );
  const repeatResult = await importAqaPhysicsPaper1HigherBenchmark(year);
  const repeatedPaper = await assertPaperIntegrity(year, repeatResult.paperId);

  assert(
    initialResult.paperId === repeatResult.paperId,
    `${year} re-import changed paper id from ${initialResult.paperId} to ${repeatResult.paperId}`,
  );
  assert(
    initialResult.questionCount === repeatResult.questionCount,
    `${year} re-import changed question count from ${initialResult.questionCount} to ${repeatResult.questionCount}`,
  );
  assert(
    initialResult.totalMarks === repeatResult.totalMarks,
    `${year} re-import changed total marks from ${initialResult.totalMarks} to ${repeatResult.totalMarks}`,
  );

  for (const question of repeatedPaper.questions) {
    assert(
      initialQuestionIds.get(question.questionKey) === question.id,
      `${year}/${question.questionKey} changed question id across repeat import`,
    );
  }
}

const results = await Promise.all(importedPaperIds.map((paperId) => getPaperSnapshot(paperId)));

for (const paper of results) {
  console.log(
    `Imported ${paper.sessionLabel}: ${paper.questions.length} questions, ${paper.totalMarks} marks, paper ${paper.id}`,
  );
}

await db.$disconnect();
