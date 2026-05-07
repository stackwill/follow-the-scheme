import { randomUUID } from "node:crypto";

import { requestStructuredGrade } from "@/lib/grading/client";
import { buildGradingPrompt } from "@/lib/grading/prompt";
import { detectSelectionQuestion, gradeSelectionAnswer } from "@/lib/grading/schema";
import { db } from "@/lib/db";

const MAX_ANSWER_CHARACTERS = 4_000;
const MAX_NOTES_CHARACTERS = 1_000;

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

  if (trimmedAnswer.length > MAX_ANSWER_CHARACTERS) {
    throw new Error(`Answer is too long. Keep it under ${MAX_ANSWER_CHARACTERS} characters.`);
  }

  const trimmedNotes = input.notes.trim();

  if (trimmedNotes.length > MAX_NOTES_CHARACTERS) {
    throw new Error(`Notes are too long. Keep them under ${MAX_NOTES_CHARACTERS} characters.`);
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

  return {
    id: randomUUID(),
    questionId: input.questionId,
    questionKey: question.questionKey,
    submittedAnswer,
    awardedMarks: boundedMarks,
    maxMarks: question.maxMarks,
    reasoning: result.reasoning,
    feedback: result.feedback,
    createdAt: new Date().toISOString(),
  };
}
