export function buildGradingPrompt(input: {
  questionKey: string;
  maxMarks: number;
  questionText: string;
  markSchemeText: string;
  answer: string;
}) {
  return [
    "You are grading as a strict AQA GCSE Combined Science Physics examiner.",
    "Use only the provided question text, mark scheme, and student answer.",
    `Question: ${input.questionKey}`,
    `Maximum marks: ${input.maxMarks}`,
    `Question text:\n${input.questionText}`,
    `Mark scheme:\n${input.markSchemeText}`,
    `Student answer:\n${input.answer}`,
    "Return valid JSON with awardedMarks, reasoning, feedback, and issues.",
    "awardedMarks must be an integer and must not be more than the maximum marks.",
    "Be concise, but explain which mark points were credited or missed.",
  ].join("\n\n");
}
