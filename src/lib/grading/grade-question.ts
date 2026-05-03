import { db } from "@/lib/db";
import { requestStructuredGrade } from "@/lib/grading/client";
import { buildGradingPrompt } from "@/lib/grading/prompt";
import { detectSelectionQuestion, gradeSelectionAnswer } from "@/lib/grading/schema";

export async function gradeQuestionAttempt(input: {
  paperId: string;
  questionId: string;
  answer: string;
  notes: string;
}) {
  const question = await db.question.findUniqueOrThrow({
    where: { id: input.questionId },
  });

  if (question.paperId !== input.paperId) {
    throw new Error("Question does not belong to the requested paper.");
  }

  const trimmedAnswer = input.answer.trim();

  if (!trimmedAnswer) {
    throw new Error("Enter an answer before submitting.");
  }

  let attempt = await db.attempt.findFirst({
    where: {
      paperId: input.paperId,
      completedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (!attempt) {
    attempt = await db.attempt.create({
      data: {
        paperId: input.paperId,
        mode: "question-by-question",
      },
    });
  }

  const selectionQuestion = detectSelectionQuestion({
    maxMarks: question.maxMarks,
    questionText: question.extractedQuestionText,
    markSchemeText: question.markSchemeText,
  });
  const result = selectionQuestion
    ? gradeSelectionAnswer({
        selectionQuestion,
        selectedOptionId: trimmedAnswer,
        maxMarks: question.maxMarks,
      })
    : await requestStructuredGrade(
        buildGradingPrompt({
          questionKey: question.questionKey,
          maxMarks: question.maxMarks,
          questionText: question.extractedQuestionText,
          markSchemeText: question.markSchemeText,
          answer: trimmedAnswer,
        }),
      );
  const boundedMarks = Math.max(0, Math.min(question.maxMarks, result.awardedMarks));
  const submittedAnswer = selectionQuestion
    ? (selectionQuestion.options.find((option) => option.id === trimmedAnswer)?.label ?? trimmedAnswer)
    : trimmedAnswer;

  return db.questionAttempt.create({
    data: {
      attemptId: attempt.id,
      questionId: input.questionId,
      submittedAnswer,
      userNotes: input.notes.trim(),
      awardedMarks: boundedMarks,
      maxMarks: question.maxMarks,
      gradingReasoning: result.reasoning,
      feedback: result.feedback,
      rawModelResponse: JSON.stringify({
        ...result,
        awardedMarks: boundedMarks,
        gradingMode: selectionQuestion ? "deterministic-selection" : "openrouter",
      }),
      promptVersion: selectionQuestion ? "selection-v1" : "grading-v1",
    },
  });
}
