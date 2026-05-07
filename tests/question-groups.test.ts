import { describe, expect, it } from "vitest";

import { questionGroupKey, uniqueQuestionGroups } from "@/lib/questions/groups";

describe("OCR Business question grouping", () => {
  const paper = { adapterKey: "ocr-gcse-business-paper-1" };

  it("groups Section A multiple-choice questions in batches of five", () => {
    expect(questionGroupKey(paper, { questionKey: "1" })).toBe("1-5");
    expect(questionGroupKey(paper, { questionKey: "5" })).toBe("1-5");
    expect(questionGroupKey(paper, { questionKey: "6" })).toBe("6-10");
    expect(questionGroupKey(paper, { questionKey: "10" })).toBe("6-10");
    expect(questionGroupKey(paper, { questionKey: "11" })).toBe("11-15");
    expect(questionGroupKey(paper, { questionKey: "15" })).toBe("11-15");
  });

  it("keeps Section B grouped by main question number", () => {
    expect(questionGroupKey(paper, { questionKey: "16.a" })).toBe("16");
    expect(questionGroupKey(paper, { questionKey: "17.d.iii" })).toBe("17");
  });

  it("returns contiguous grouped question sets", () => {
    const groups = uniqueQuestionGroups(
      paper,
      ["1", "2", "3", "4", "5", "6", "16.a", "16.b"].map((questionKey) => ({
        questionKey,
      })),
    );

    expect(groups.map((group) => ({
      key: group.key,
      questions: group.questions.map((question) => question.questionKey),
    }))).toEqual([
      { key: "1-5", questions: ["1", "2", "3", "4", "5"] },
      { key: "6-10", questions: ["6"] },
      { key: "16", questions: ["16.a", "16.b"] },
    ]);
  });
});
