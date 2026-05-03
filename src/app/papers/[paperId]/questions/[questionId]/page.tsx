import type { Route } from "next";
import { redirect, notFound } from "next/navigation";

import { AnswerForm } from "@/components/questions/answer-form";
import { ProgressHeader } from "@/components/questions/progress-header";
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
        include: {
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
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
      paperOnlyReason: paperOnlyQuestion?.reason ?? null,
      latestAttempt: groupQuestion.attempts[0]
        ? {
            awardedMarks: groupQuestion.attempts[0].awardedMarks,
            maxMarks: groupQuestion.attempts[0].maxMarks,
            submittedAnswer: groupQuestion.attempts[0].submittedAnswer,
            reasoning: groupQuestion.attempts[0].gradingReasoning,
            feedback: groupQuestion.attempts[0].feedback,
            createdAt: groupQuestion.attempts[0].createdAt.toISOString(),
          }
        : null,
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

    redirect(`${questionHref(paperId, questionId)}#marks`);
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
          groupKey={currentGroup.key}
          questions={formQuestions}
        />
      </div>
    </main>
  );
}
