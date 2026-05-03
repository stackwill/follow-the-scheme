import { describe, expect, it } from "vitest";

import { parseStructuredGradeContent } from "@/lib/grading/client";

const validPayload = {
  awardedMarks: 1,
  reasoning: "The answer matches the required mark point.",
  feedback: "No improvement needed.",
  issues: [],
};

describe("parseStructuredGradeContent", () => {
  it("parses plain JSON content", () => {
    expect(parseStructuredGradeContent(JSON.stringify(validPayload))).toEqual(validPayload);
  });

  it("parses JSON returned inside a markdown code fence", () => {
    expect(parseStructuredGradeContent(`\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\`\n`)).toEqual(validPayload);
  });

  it("parses a JSON object even when the model adds surrounding text", () => {
    expect(parseStructuredGradeContent(`Here is the mark:\n${JSON.stringify(validPayload)}\nDone.`)).toEqual(validPayload);
  });

  it("throws a useful preview when no complete JSON object is present", () => {
    expect(() => parseStructuredGradeContent("I cannot mark this as JSON")).toThrow(
      /OpenRouter grading returned invalid JSON content/,
    );
  });
});
