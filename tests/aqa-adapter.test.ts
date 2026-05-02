import { describe, expect, it } from "vitest";

import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";
import type { TextItem } from "@/lib/import/core/pdf-text";

function item(
  pageNumber: number,
  text: string,
  x: number,
  y: number,
  width = Math.max(text.length * 6, 6),
): TextItem {
  return {
    pageNumber,
    text,
    x,
    y,
    width,
    height: 12,
  };
}

describe("aqaCombinedSciencePhysicsPaper1HigherAdapter", () => {
  it("normalizes left-margin numbering and joins benchmark-style mark scheme blocks", () => {
    const questionItems: TextItem[] = [
      item(3, "0", 52.7, 763.6),
      item(3, "1", 69.4, 763.6),
      item(3, "Wind power and solar power are both renewable energy resources.", 114.8, 763.0, 320),
      item(3, "generate electricity for the National Grid.", 114.8, 750.3, 220),
      item(3, "0", 52.7, 707.9),
      item(3, "1", 69.4, 707.9),
      item(3, ".", 82.4, 707.9),
      item(3, "1", 92.6, 707.9),
      item(3, "Which of the following is also a renewable energy resource?", 114.8, 707.0, 320),
      item(3, "Tick one box.", 114.8, 679.7, 80),
      item(3, "[1 mark]", 491.6, 694.7, 60),
      item(3, "0", 52.7, 476.8),
      item(3, "1", 69.4, 476.8),
      item(3, "2", 92.6, 476.8),
      item(3, "The energy transferred by the National Grid in one second was 36 gigajoules.", 114.8, 476.3, 380),
      item(3, "Which of the following is the same as 36 gigajoules?", 114.8, 451.0, 260),
      item(3, "Tick one box.", 114.8, 423.3, 80),
      item(3, "[1 mark]", 491.6, 438.3, 60),
      item(4, "0", 52.7, 763.6),
      item(4, "1", 69.4, 763.6),
      item(4, ".", 82.4, 763.6),
      item(4, "3", 92.6, 763.6),
      item(4, "Explain the changes in power output.", 114.8, 763.0, 220),
    ];

    const markSchemeItems: TextItem[] = [
      item(7, "Question Answers Extra information Mark", 54.1, 713.2, 320),
      item(7, "AO /", 511.8, 719.5, 28),
      item(7, "01.1", 67.3, 675.7, 24),
      item(7, "geothermal", 113.2, 675.7, 64),
      item(7, "1", 466.2, 675.7, 8),
      item(7, "AO1", 512.1, 675.7, 24),
      item(7, "01.2", 67.3, 573.7, 24),
      item(7, "36 x 10^9 J", 113.2, 573.7, 78),
      item(7, "allow equivalent power-of-ten notation", 283.3, 573.7, 180),
      item(7, "1", 466.2, 573.7, 8),
      item(7, "AO2", 512.1, 573.7, 24),
      item(8, "Level 2:", 113.2, 712.0, 46),
      item(8, "clear explanation linked to figure trends", 153.0, 712.0, 200),
      item(8, "5‒6", 455.7, 705.0, 20),
      item(8, "01.3", 62.9, 705.0, 24),
      item(8, "AO3", 507.8, 705.0, 24),
      item(8, "Total Question 1 8", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2023,
      questionItems,
      markSchemeItems,
    });

    expect(drafts.map((draft) => draft.questionKey)).toEqual(["01.1", "01.2", "01.3"]);
    expect(drafts[0]?.extractedQuestionText).toContain("Wind power and solar power");
    expect(drafts[0]?.extractedQuestionText).toContain("Which of the following is also a renewable energy resource?");
    expect(drafts[1]?.questionKey).toBe("01.2");
    expect(drafts[1]?.markSchemeText).toContain("36 x 10^9 J");
    expect(drafts[1]?.markSchemeText).toContain("allow equivalent power-of-ten notation");
    expect(drafts[1]?.markSchemeText).not.toContain("AO2");
    expect(drafts[2]?.markSchemeText).toContain("Level 2:");
    expect(drafts[2]?.maxMarks).toBe(6);
    expect(drafts[0]?.maxMarks).toBe(1);
    expect(drafts[1]?.maxMarks).toBe(1);
  });
});
