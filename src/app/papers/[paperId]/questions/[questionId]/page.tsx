import type { Route } from "next";
import { redirect, notFound } from "next/navigation";

import { AnswerForm } from "@/components/questions/answer-form";
import { ProgressHeader } from "@/components/questions/progress-header";
import { QuestionViewer } from "@/components/questions/question-viewer";
import { ResultPanel } from "@/components/questions/result-panel";
import { detectPaperOnlyQuestion, detectSelectionQuestion } from "@/lib/grading/schema";

export const dynamic = "force-dynamic";

type FormState = {
  error: string | null;
};

function paperHref(paperId: string) {
  return `/papers/${paperId}` as Route;
}

function questionHref(paperId: string, questionId: string) {
  return `/papers/${paperId}/questions/${questionId}` as Route;
}

function parseSupportingAssetPaths(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return parsed;
    }
  } catch {
    return [];
  }

  return [];
}

function questionGroupKey(questionKey: string) {
  return questionKey.split(".")[0] ?? questionKey;
}

function uniqueQuestionGroups<T extends { questionKey: string }>(questions: T[]) {
  const groups: Array<{ key: string; firstQuestion: T; questions: T[] }> = [];

  for (const question of questions) {
    const key = questionGroupKey(question.questionKey);
    const existingGroup = groups.at(-1);

    if (existingGroup?.key === key) {
      existingGroup.questions.push(question);
    } else {
      groups.push({ key, firstQuestion: question, questions: [question] });
    }
  }

  return groups;
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ paperId: string; questionId: string }>;
}) {
  const { paperId, questionId } = await params;
  const { db } = await import("@/lib/db");
  const paper = await db.paper.findUnique({
    where: { id: paperId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!paper) {
    notFound();
  }

  const currentIndex = paper.questions.findIndex((entry) => entry.id === questionId);
  const question = paper.questions[currentIndex];

  if (!question) {
    notFound();
  }

  const groups = uniqueQuestionGroups(paper.questions);
  const groupKey = questionGroupKey(question.questionKey);
  const currentGroupIndex = groups.findIndex((entry) => entry.key === groupKey);
  const currentGroup = groups[currentGroupIndex];

  if (!currentGroup) {
    notFound();
  }

  const latestAttempts = await db.questionAttempt.findMany({
    where: {
      questionId: {
        in: currentGroup.questions.map((entry) => entry.id),
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const latestAttemptByQuestionId = new Map<string, (typeof latestAttempts)[number]>();

  for (const attempt of latestAttempts) {
    if (!latestAttemptByQuestionId.has(attempt.questionId)) {
      latestAttemptByQuestionId.set(attempt.questionId, attempt);
    }
  }

  const answerableQuestions = currentGroup.questions.map((groupQuestion) => {
    const paperOnlyQuestion = detectPaperOnlyQuestion({
      questionText: groupQuestion.extractedQuestionText,
    });
    const selectionQuestion = paperOnlyQuestion
      ? null
      : detectSelectionQuestion({
          maxMarks: groupQuestion.maxMarks,
          questionText: groupQuestion.extractedQuestionText,
          markSchemeText: groupQuestion.markSchemeText,
        });

    return {
      id: groupQuestion.id,
      questionKey: groupQuestion.questionKey,
      maxMarks: groupQuestion.maxMarks,
      paperOnlyReason: paperOnlyQuestion?.reason ?? null,
      selectionQuestion: selectionQuestion
        ? {
            type: selectionQuestion.type,
            options: selectionQuestion.options,
          }
        : null,
    };
  });
  const previousGroup = groups[currentGroupIndex - 1] ?? null;
  const nextGroup = groups[currentGroupIndex + 1] ?? null;

  async function submit(_state: FormState, formData: FormData): Promise<FormState> {
    "use server";

    try {
      const { gradeQuestionAttempt } = await import("@/lib/grading/grade-question");
      let gradedCount = 0;

      for (const groupQuestion of currentGroup.questions) {
        const paperOnlyQuestion = detectPaperOnlyQuestion({
          questionText: groupQuestion.extractedQuestionText,
        });

        if (paperOnlyQuestion) {
          continue;
        }

        const answer = String(formData.get(`answer-${groupQuestion.id}`) ?? "");

        if (!answer.trim()) {
          continue;
        }

        await gradeQuestionAttempt({
          paperId,
          questionId: groupQuestion.id,
          answer,
          notes: "",
        });
        gradedCount += 1;
      }

      if (gradedCount === 0) {
        return {
          error: "Enter an answer for at least one answerable part before submitting.",
        };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown grading error",
      };
    }

    redirect(questionHref(paperId, questionId));
  }

  return (
    <main className="page-shell question-shell">
      <ProgressHeader
        paperTitle={paper.title}
        paperHref={paperHref(paper.id)}
        current={currentGroupIndex + 1}
        total={groups.length}
        previousHref={previousGroup ? questionHref(paper.id, previousGroup.firstQuestion.id) : null}
        nextHref={nextGroup ? questionHref(paper.id, nextGroup.firstQuestion.id) : null}
      />
      <div className="question-layout">
        <QuestionViewer
          groupKey={currentGroup.key}
          questions={currentGroup.questions.map((groupQuestion) => {
            const paperOnlyQuestion = detectPaperOnlyQuestion({
              questionText: groupQuestion.extractedQuestionText,
            });

            return {
              id: groupQuestion.id,
              questionKey: groupQuestion.questionKey,
              maxMarks: groupQuestion.maxMarks,
              imagePath: groupQuestion.primaryCropPath,
              supportingImagePaths: parseSupportingAssetPaths(groupQuestion.supportingAssetPaths),
              text: groupQuestion.extractedQuestionText,
              paperOnlyReason: paperOnlyQuestion?.reason ?? null,
            };
          })}
        />
        <aside className="answer-stack">
          {[...latestAttemptByQuestionId.entries()].map(([attemptQuestionId, latestAttempt]) => {
            const attemptQuestion = currentGroup.questions.find((entry) => entry.id === attemptQuestionId);

            return (
              <ResultPanel
                key={latestAttempt.id}
                questionKey={attemptQuestion?.questionKey ?? "Unknown"}
                awardedMarks={latestAttempt.awardedMarks}
                maxMarks={latestAttempt.maxMarks}
                reasoning={latestAttempt.gradingReasoning}
                feedback={latestAttempt.feedback}
                submittedAnswer={latestAttempt.submittedAnswer}
                createdAt={latestAttempt.createdAt}
              />
            );
          })}
          <AnswerForm action={submit} questions={answerableQuestions} />
        </aside>
      </div>
    </main>
  );
}
