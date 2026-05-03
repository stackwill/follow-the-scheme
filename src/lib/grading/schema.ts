import { z } from "zod";

export const gradingResponseSchema = z.object({
  awardedMarks: z.number().int().min(0),
  reasoning: z.string().min(1),
  feedback: z.string().min(1),
  issues: z.array(z.string()).default([]),
});

export type GradingResponse = z.infer<typeof gradingResponseSchema>;

export type SelectionOption = {
  id: string;
  label: string;
};

export type SelectionQuestion = {
  type: "single";
  options: SelectionOption[];
  correctOptionId: string;
};

const TICK_ONE_BOX_PATTERN = /tick\s*\([^)]*\)\s*one\s+box\.?/gi;
const SIMPLE_NOISE_LINES = new Set(["answers"]);

function normalizeAnswerText(text: string) {
  return text
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}×+\-=/().\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMarkSchemeText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+$/.test(line) && !SIMPLE_NOISE_LINES.has(line.toLowerCase()))
    .join(" ");
}

function optionId(index: number) {
  return `option-${index + 1}`;
}

function getOptionLines(questionText: string) {
  const matches = [...questionText.matchAll(TICK_ONE_BOX_PATTERN)];

  if (matches.length !== 1) {
    return [];
  }

  const match = matches[0];
  const optionsText = questionText.slice((match.index ?? 0) + match[0].length);

  return optionsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function looksLikeTextOption(line: string) {
  if (line.length < 2 || line.length > 120) {
    return false;
  }

  if (/^\d+$/.test(line)) {
    return false;
  }

  return /[A-Za-z]/.test(line);
}

export function detectSelectionQuestion(input: {
  maxMarks: number;
  questionText: string;
  markSchemeText: string;
}): SelectionQuestion | null {
  if (input.maxMarks !== 1) {
    return null;
  }

  const lines = getOptionLines(input.questionText);

  if (lines.length < 2 || !lines.every(looksLikeTextOption)) {
    return null;
  }

  const normalizedCorrectAnswer = normalizeAnswerText(normalizeMarkSchemeText(input.markSchemeText));

  if (!normalizedCorrectAnswer) {
    return null;
  }

  const options = lines.map((label, index) => ({
    id: optionId(index),
    label,
  }));
  const matches = options.filter((option) => normalizeAnswerText(option.label) === normalizedCorrectAnswer);

  if (matches.length !== 1) {
    return null;
  }

  return {
    type: "single",
    options,
    correctOptionId: matches[0].id,
  };
}

export function gradeSelectionAnswer(input: {
  selectionQuestion: SelectionQuestion;
  selectedOptionId: string;
  maxMarks: number;
}): GradingResponse {
  const selectedOption = input.selectionQuestion.options.find((option) => option.id === input.selectedOptionId);
  const correctOption = input.selectionQuestion.options.find(
    (option) => option.id === input.selectionQuestion.correctOptionId,
  );
  const isCorrect = input.selectedOptionId === input.selectionQuestion.correctOptionId;
  const awardedMarks = isCorrect ? input.maxMarks : 0;

  return {
    awardedMarks,
    reasoning: isCorrect
      ? `Selected "${selectedOption?.label ?? input.selectedOptionId}", which matches the mark scheme answer.`
      : `Selected "${selectedOption?.label ?? input.selectedOptionId}". The mark scheme answer is "${
          correctOption?.label ?? input.selectionQuestion.correctOptionId
        }".`,
    feedback: isCorrect ? "Correct selection." : "Check the selected option against the mark scheme.",
    issues: [],
  };
}
