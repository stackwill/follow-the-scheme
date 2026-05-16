import { z } from "zod";

export const gradingResponseSchema = z.object({
  awardedMarks: z.number().int().min(0),
  contentMarks: z.number().int().min(0).optional(),
  spagMarks: z.number().int().min(0).optional(),
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

export type PaperOnlyQuestion = {
  reason: string;
};

const SINGLE_SELECTION_PATTERN = /(?:tick|shade)\s*(?:\([^)]*\)\s*)?one\s+(?:box|lozenge)\.?/gi;
const SIMPLE_NOISE_LINES = new Set(["answers"]);
const PAPER_ONLY_PATTERNS: Array<[RegExp, string]> = [
  [/\bcomplete\s+(figure|fig\.|the\s+diagram|the\s+circuit|the\s+graph|the\s+table)\b/i, "Complete this on the paper."],
  [/\bdraw\s+(a\s+)?(line|curve|graph|diagram|circuit|ray|arrow|bar|best\s+fit)\b/i, "Draw this on the paper."],
  [/\bplot\s+(the\s+)?(points?|graph|line|curve)\b/i, "Plot this on the paper."],
  [/\bsketch\s+(a\s+)?(graph|diagram|curve|line)\b/i, "Sketch this on the paper."],
  [/\b(on|onto)\s+(figure|fig\.|the\s+graph|the\s+grid|the\s+diagram)\b/i, "Use the source image and write/draw on paper."],
  [/\buse\s+the\s+correct\s+circuit\s+symbols?\b/i, "Draw the circuit symbols on paper."],
  [/\bshow\s+(?:your\s+)?(?:answer|working|work|line|curve|diagram|circuit|graph|plot|points?|arrow|method)\b.*\b(on|in)\s+(figure|fig\.|the\s+diagram|the\s+graph|the\s+grid)\b/i, "Show this on the paper."],
];

function isWrittenSourceFollowUpQuestion(questionText: string) {
  return (
    /\bhow could you follow up source [a-z]\b/i.test(questionText) &&
    /\bthe question you would ask\b/i.test(questionText) &&
    /\bthe type of source\b/i.test(questionText)
  );
}

function normalizeAnswerText(text: string) {
  return text
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}×+\-=/().\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.]+$/g, "")
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

function isStandaloneChargeMarkerLine(line: string) {
  return /[+\-−–¯]/.test(line) && /^[\d+\-−–¯\s]+$/.test(line);
}

function getOptionLines(questionText: string) {
  const matches = [...questionText.matchAll(SINGLE_SELECTION_PATTERN)];

  if (matches.length === 1) {
    const match = matches[0];
    const optionsText = questionText.slice((match.index ?? 0) + match[0].length);

    return optionsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^\[\d+\s*marks?\]$/i.test(line))
      .filter((line) => !isStandaloneChargeMarkerLine(line))
      .slice(0, 6);
  }

  const letteredOptions: string[] = [];

  for (const line of questionText.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    const optionMatch = trimmedLine.match(/^([A-D])\s+(.+)$/);

    if (!optionMatch) {
      continue;
    }

    const expectedLetter = String.fromCharCode(65 + letteredOptions.length);

    if (optionMatch[1] !== expectedLetter) {
      return [];
    }

    letteredOptions.push(trimmedLine);

    if (letteredOptions.length === 4) {
      return letteredOptions;
    }
  }

  return [];
}

function looksLikeTextOption(line: string) {
  const normalizedLine = normalizeOptionLabel(line);

  if (normalizedLine.length < 1 || normalizedLine.length > 120) {
    return false;
  }

  if (/^\d+$/.test(normalizedLine)) {
    return false;
  }

  return /[A-Za-z]/.test(normalizedLine);
}

function normalizeOptionLabel(line: string) {
  return line.replace(/^[A-D]\s+/, "").trim();
}

function markSchemeSingleLetter(text: string) {
  const normalizedMarkSchemeText = normalizeMarkSchemeText(text).trim();
  const match = normalizedMarkSchemeText.match(/^[A-D]\b/);

  return match?.[0] ?? null;
}

function normalizeChemistrySelectionText(text: string) {
  return normalizeAnswerText(
    text
      .replace(/[−–]/g, "-")
      .replace(/\b([A-Z][a-z]?)\d?(?:\+|-)(?=\s|$|[):;,.])/g, "$1")
      .replace(/\be(?:\+|-)(?=\s|$|[):;,.])/gi, "e"),
  );
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

  const normalizedCorrectAnswer = normalizeAnswerText(
    normalizeOptionLabel(normalizeMarkSchemeText(input.markSchemeText)),
  );
  const correctLetter = markSchemeSingleLetter(input.markSchemeText);

  if (!normalizedCorrectAnswer && !correctLetter) {
    return null;
  }

  const options = lines.map((line, index) => ({
    id: optionId(index),
    label: normalizeOptionLabel(line),
  }));
  const letterMatch = correctLetter
    ? options[correctLetter.charCodeAt(0) - 65]
    : null;

  if (letterMatch) {
    return {
      type: "single",
      options,
      correctOptionId: letterMatch.id,
    };
  }

  const matches = options.filter((option) => {
    const normalizedOption = normalizeAnswerText(option.label);

    if (normalizedOption === normalizedCorrectAnswer || normalizedCorrectAnswer.includes(normalizedOption)) {
      return true;
    }

    const normalizedChemistryOption = normalizeChemistrySelectionText(option.label);
    const normalizedChemistryAnswer = normalizeChemistrySelectionText(
      normalizeMarkSchemeText(input.markSchemeText),
    );

    return (
      normalizedChemistryOption.length > 0 &&
      (normalizedChemistryOption === normalizedChemistryAnswer ||
        normalizedChemistryAnswer.includes(normalizedChemistryOption))
    );
  });

  if (matches.length !== 1) {
    return null;
  }

  return {
    type: "single",
    options,
    correctOptionId: matches[0].id,
  };
}

export function detectPaperOnlyQuestion(input: { questionText: string }): PaperOnlyQuestion | null {
  const normalizedQuestion = input.questionText.replace(/\s+/g, " ").trim();

  if (isWrittenSourceFollowUpQuestion(normalizedQuestion)) {
    return null;
  }

  for (const [pattern, reason] of PAPER_ONLY_PATTERNS) {
    if (pattern.test(normalizedQuestion)) {
      return { reason };
    }
  }

  return null;
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
