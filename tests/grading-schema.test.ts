import { describe, expect, it } from "vitest";

import { detectSelectionQuestion, gradeSelectionAnswer, gradingResponseSchema } from "@/lib/grading/schema";

describe("gradingResponseSchema", () => {
  it("accepts a valid grading payload", () => {
    expect(
      gradingResponseSchema.parse({
        awardedMarks: 3,
        reasoning: "Matched three mark points.",
        feedback: "Good explanation.",
        issues: [],
      }),
    ).toBeTruthy();
  });

  it("rejects non-integer marks", () => {
    expect(() =>
      gradingResponseSchema.parse({
        awardedMarks: 1.5,
        reasoning: "Partial credit.",
        feedback: "Some points matched.",
        issues: [],
      }),
    ).toThrow();
  });
});

describe("detectSelectionQuestion", () => {
  it("detects simple tick-box questions with a matching mark scheme answer", () => {
    const result = detectSelectionQuestion({
      maxMarks: 1,
      questionText: [
        "Which scientist provided evidence that neutrons exist?",
        "Tick () one box.",
        "Isaac Newton",
        "James Chadwick",
        "Niels Bohr",
      ].join("\n"),
      markSchemeText: "James Chadwick",
    });

    expect(result).toEqual({
      type: "single",
      options: [
        { id: "option-1", label: "Isaac Newton" },
        { id: "option-2", label: "James Chadwick" },
        { id: "option-3", label: "Niels Bohr" },
      ],
      correctOptionId: "option-2",
    });
  });

  it("falls back when the option text is not clean enough", () => {
    expect(
      detectSelectionQuestion({
        maxMarks: 1,
        questionText: ["Which equation links current and power?", "Tick () one box.", "2", "P = I R"].join("\n"),
        markSchemeText: "P = IR",
      }),
    ).toBeNull();
  });
});

describe("gradeSelectionAnswer", () => {
  const selectionQuestion = {
    type: "single" as const,
    options: [
      { id: "option-1", label: "Geothermal" },
      { id: "option-2", label: "Natural gas" },
      { id: "option-3", label: "Nuclear fuel" },
    ],
    correctOptionId: "option-1",
  };

  it("awards full marks for the selected correct option", () => {
    expect(
      gradeSelectionAnswer({
        selectionQuestion,
        selectedOptionId: "option-1",
        maxMarks: 1,
      }).awardedMarks,
    ).toBe(1);
  });

  it("awards zero marks for an incorrect option", () => {
    expect(
      gradeSelectionAnswer({
        selectionQuestion,
        selectedOptionId: "option-2",
        maxMarks: 1,
      }).awardedMarks,
    ).toBe(0);
  });
});
