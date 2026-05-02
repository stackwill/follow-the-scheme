import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function getPaperSnapshot(year: 2023 | 2024) {
  const paper = await db.paper.findFirst({
    where: { year },
    include: {
      questions: {
        orderBy: {
          displayOrder: "asc",
        },
      },
    },
  });

  assert(paper, `Missing imported paper for ${year}`);

  return paper;
}

async function assertPaperIntegrity(year: 2023 | 2024) {
  const paper = await getPaperSnapshot(year);
  const expectation = BENCHMARK_EXPECTATIONS[year];

  assert(
    paper.questions.length === expectation.questionCount,
    `${year} imported ${paper.questions.length} questions, expected ${expectation.questionCount}`,
  );
  assert(
    paper.totalMarks === expectation.totalMarks,
    `${year} imported ${paper.totalMarks} total marks, expected ${expectation.totalMarks}`,
  );

  const emptyMarkSchemes = paper.questions
    .filter((question) => question.markSchemeText.trim().length === 0)
    .map((question) => question.questionKey);

  assert(
    emptyMarkSchemes.length === 0,
    `${year} imported empty mark scheme text for ${emptyMarkSchemes.join(", ")}`,
  );

  const multiPageQuestions = paper.questions.filter((question) => question.pageEnd > question.pageStart);

  assert(multiPageQuestions.length > 0, `${year} expected at least one multi-page imported question`);

  for (const question of multiPageQuestions) {
    const supportingAssetPaths = JSON.parse(question.supportingAssetPaths) as string[];
    const boundingBoxes = JSON.parse(question.boundingBoxes) as {
      supportingPdfBoxes?: Array<{ pageNumber: number }>;
    };

    assert(
      supportingAssetPaths.length > 0,
      `${year}/${question.questionKey} is multi-page but has no supporting crop assets`,
    );
    assert(
      supportingAssetPaths.length === (boundingBoxes.supportingPdfBoxes?.length ?? 0),
      `${year}/${question.questionKey} supporting asset count does not match supporting crop boxes`,
    );

    for (const assetPath of supportingAssetPaths) {
      await access(assetPath);
    }
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

for (const year of [2023, 2024] as const) {
  const initialResult = await importAqaPhysicsPaper1HigherBenchmark(year);
  const initialPaper = await assertPaperIntegrity(year);
  const initialQuestionIds = new Map(
    initialPaper.questions.map((question) => [question.questionKey, question.id] as const),
  );
  const repeatResult = await importAqaPhysicsPaper1HigherBenchmark(year);
  const repeatedPaper = await assertPaperIntegrity(year);

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

const results = await Promise.all([getPaperSnapshot(2023), getPaperSnapshot(2024)]);

for (const paper of results) {
  console.log(
    `Imported ${paper.sessionLabel}: ${paper.questions.length} questions, ${paper.totalMarks} marks, paper ${paper.id}`,
  );
}

await db.$disconnect();
