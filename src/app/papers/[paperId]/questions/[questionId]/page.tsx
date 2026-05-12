import type { Route } from "next";
import { notFound } from "next/navigation";

import { AnswerForm } from "@/components/questions/answer-form";
import { ProgressHeader } from "@/components/questions/progress-header";
import { detectPaperOnlyQuestion, detectSelectionQuestion } from "@/lib/grading/schema";
import type { LocalQuestionAttempt } from "@/lib/questions/local-attempts";
import { questionGroupKey, uniqueQuestionGroups } from "@/lib/questions/groups";

export const dynamic = "force-dynamic";

type FormState = {
  error: string | null;
  answers?: Record<string, string>;
  results?: LocalQuestionAttempt[];
  skippedCount?: number;
  submitted?: boolean;
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

  const groups = uniqueQuestionGroups(paper, paper.questions);
  const groupKey = questionGroupKey(paper, question);
  const currentGroupIndex = groups.findIndex((entry) => entry.key === groupKey);
  const currentGroup = groups[currentGroupIndex];

  if (!currentGroup) {
    notFound();
  }

  const formQuestions = currentGroup.questions.map((groupQuestion) => {
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
      imagePath: groupQuestion.primaryCropPath,
      continuationImagePaths: parseSupportingAssetPaths(groupQuestion.supportingAssetPaths),
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

    const submittedAnswers = Object.fromEntries(
      currentGroup.questions.map((groupQuestion) => [
        groupQuestion.id,
        String(formData.get(`answer-${groupQuestion.id}`) ?? ""),
      ]),
    );

    try {
      const { gradeQuestionAttempt } = await import("@/lib/grading/grade-question");
      let gradedCount = 0;
      let skippedCount = 0;
      const results: LocalQuestionAttempt[] = [];

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

        if (formData.get(`skip-remark-${groupQuestion.id}`)) {
          skippedCount += 1;
          continue;
        }

        const result = await gradeQuestionAttempt({
          paperId,
          questionId: groupQuestion.id,
          answer,
          notes: "",
        });
        results.push(result);
        gradedCount += 1;
      }

      if (gradedCount === 0 && skippedCount === 0) {
        return {
          error: "Enter an answer for at least one answerable part before submitting.",
          answers: submittedAnswers,
          submitted: true,
        };
      }

      return {
        error: null,
        answers: submittedAnswers,
        results,
        skippedCount,
        submitted: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown grading error",
        answers: submittedAnswers,
        submitted: true,
      };
    }
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
      <div className="question-flow">
        <AnswerForm
          action={submit}
          paperId={paper.id}
          groupKey={currentGroup.key}
          questions={formQuestions}
        />
      </div>
    </main>
  );
}
