import type { Route } from "next";
import { redirect, notFound } from "next/navigation";

import { AnswerForm } from "@/components/questions/answer-form";
import { ProgressHeader } from "@/components/questions/progress-header";
import { QuestionViewer } from "@/components/questions/question-viewer";
import { ResultPanel } from "@/components/questions/result-panel";
import { detectSelectionQuestion } from "@/lib/grading/schema";

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

  const latestAttempt = await db.questionAttempt.findFirst({
    where: { questionId },
    orderBy: { createdAt: "desc" },
  });
  const selectionQuestion = detectSelectionQuestion({
    maxMarks: question.maxMarks,
    questionText: question.extractedQuestionText,
    markSchemeText: question.markSchemeText,
  });
  const publicSelectionQuestion = selectionQuestion
    ? {
        type: selectionQuestion.type,
        options: selectionQuestion.options,
      }
    : null;
  const previousQuestion = paper.questions[currentIndex - 1] ?? null;
  const nextQuestion = paper.questions[currentIndex + 1] ?? null;

  async function submit(_state: FormState, formData: FormData): Promise<FormState> {
    "use server";

    try {
      const { gradeQuestionAttempt } = await import("@/lib/grading/grade-question");

      await gradeQuestionAttempt({
        paperId,
        questionId,
        answer: String(formData.get("answer") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
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
        current={currentIndex + 1}
        total={paper.questions.length}
        previousHref={previousQuestion ? questionHref(paper.id, previousQuestion.id) : null}
        nextHref={nextQuestion ? questionHref(paper.id, nextQuestion.id) : null}
      />
      <div className="question-layout">
        <QuestionViewer
          questionKey={question.questionKey}
          maxMarks={question.maxMarks}
          imagePath={question.primaryCropPath}
          supportingImagePaths={parseSupportingAssetPaths(question.supportingAssetPaths)}
          text={question.extractedQuestionText}
        />
        <aside className="answer-stack">
          {latestAttempt ? (
            <ResultPanel
              awardedMarks={latestAttempt.awardedMarks}
              maxMarks={latestAttempt.maxMarks}
              reasoning={latestAttempt.gradingReasoning}
              feedback={latestAttempt.feedback}
              submittedAnswer={latestAttempt.submittedAnswer}
              createdAt={latestAttempt.createdAt}
            />
          ) : null}
          <AnswerForm action={submit} selectionQuestion={publicSelectionQuestion} />
        </aside>
      </div>
    </main>
  );
}
