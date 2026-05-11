import { readFile } from "node:fs/promises";

import { findPaperForAttemptImport, type AttemptExport } from "@/lib/data/attempt-transfer";
import { db } from "@/lib/db";

const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error("Usage: bun run scripts/import-attempts.ts <input.json>");
}

const parsed = JSON.parse(await readFile(inputPath, "utf8")) as AttemptExport;
const papers = await db.paper.findMany({
  include: {
    questions: {
      select: {
        id: true,
        questionKey: true,
      },
    },
  },
});

for (const exportedAttempt of parsed.attempts) {
  const paper = findPaperForAttemptImport(papers, exportedAttempt.paperIdentity);

  if (!paper) {
    throw new Error(
      `Cannot restore attempt for missing paper ${exportedAttempt.paperIdentity.adapterKey}/${exportedAttempt.paperIdentity.year}/${exportedAttempt.paperIdentity.sessionLabel}`,
    );
  }

  const questionsByKey = new Map(paper.questions.map((question) => [question.questionKey, question]));

  await db.$transaction(async (transaction) => {
    const attempt = await transaction.attempt.create({
      data: {
        paperId: paper.id,
        mode: exportedAttempt.mode,
        startedAt: new Date(exportedAttempt.startedAt),
        completedAt: exportedAttempt.completedAt ? new Date(exportedAttempt.completedAt) : null,
      },
    });

    for (const exportedAnswer of exportedAttempt.answers) {
      const question = questionsByKey.get(exportedAnswer.questionKey);

      if (!question) {
        throw new Error(
          `Cannot restore answer for missing question ${paper.adapterKey}/${paper.year}/${exportedAnswer.questionKey}`,
        );
      }

      await transaction.questionAttempt.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          submittedAnswer: exportedAnswer.submittedAnswer,
          userNotes: exportedAnswer.userNotes,
          awardedMarks: exportedAnswer.awardedMarks,
          maxMarks: exportedAnswer.maxMarks,
          gradingReasoning: exportedAnswer.gradingReasoning,
          feedback: exportedAnswer.feedback,
          rawModelResponse: exportedAnswer.rawModelResponse,
          promptVersion: exportedAnswer.promptVersion,
          createdAt: new Date(exportedAnswer.createdAt),
        },
      });
    }
  });
}

await db.$disconnect();
