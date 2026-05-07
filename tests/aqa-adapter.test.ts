import { describe, expect, it } from "vitest";

import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";
import { ImportFailure } from "@/lib/import/core/diagnostics";
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
      item(5, "You should include an explanation of the change in power output during a typical year.", 114.8, 727.0, 420),
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
    expect(drafts[2]?.pageEnd).toBe(5);
    expect(drafts[2]?.supportingPdfBoxes).toEqual([
      expect.objectContaining({
        pageNumber: 5,
      }),
    ]);
  });

  it("fails fast when a detected subquestion has no paired mark scheme block", () => {
    const questionItems: TextItem[] = [
      item(3, "0", 52.7, 707.9),
      item(3, "1", 69.4, 707.9),
      item(3, ".", 82.4, 707.9),
      item(3, "1", 92.6, 707.9),
      item(3, "Which of the following is also a renewable energy resource?", 114.8, 707.0, 320),
    ];

    expect(() =>
      aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
        year: 2023,
        questionItems,
        markSchemeItems: [],
      }),
    ).toThrow(ImportFailure);
    expect(() =>
      aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
        year: 2023,
        questionItems,
        markSchemeItems: [],
      }),
    ).toThrow("incomplete output");
  });

  it("fails fast when parsed mark scheme blocks are left unconsumed", () => {
    const questionItems: TextItem[] = [
      item(3, "0", 52.7, 707.9),
      item(3, "1", 69.4, 707.9),
      item(3, ".", 82.4, 707.9),
      item(3, "1", 92.6, 707.9),
      item(3, "Which of the following is also a renewable energy resource?", 114.8, 707.0, 320),
    ];
    const markSchemeItems: TextItem[] = [
      item(7, "01.1", 67.3, 675.7, 24),
      item(7, "geothermal", 113.2, 675.7, 64),
      item(7, "1", 466.2, 675.7, 8),
      item(7, "01.2", 67.3, 573.7, 24),
      item(7, "36 x 10^9 J", 113.2, 573.7, 78),
      item(7, "1", 466.2, 573.7, 8),
      item(8, "Total Question 1 2", 49.5, 75.7, 96),
    ];

    expect(() =>
      aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
        year: 2023,
        questionItems,
        markSchemeItems,
      }),
    ).toThrow(ImportFailure);
    expect(() =>
      aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
        year: 2023,
        questionItems,
        markSchemeItems,
      }),
    ).toThrow("completeness validation failed");
  });

  it("imports an answerable main question when the mark scheme has a whole-question block", () => {
    const questionItems: TextItem[] = [
      item(8, "0", 52.7, 715.0),
      item(8, "2", 69.4, 715.0),
      item(8, "Figure 2 shows onion cells viewed using a light microscope.", 114.8, 714.2, 330),
      item(8, "Figure 2", 269.2, 665.0, 43),
      item(9, "Describe how the student could estimate the mean length of onion cells.", 114.8, 720.0, 360),
      item(9, "[6 marks]", 491.6, 690.0, 60),
    ];
    const markSchemeItems: TextItem[] = [
      item(10, "10", 42.5, 37.4, 16),
      item(12, "Level 3:", 113.2, 712.0, 46),
      item(12, "valid method with logically sequenced steps", 153.0, 712.0, 240),
      item(12, "5", 455.7, 705.0, 8),
      item(12, "6", 466.2, 705.0, 8),
      item(12, "02", 71.8, 679.7, 16),
      item(12, "measure cells and calculate the mean", 113.2, 679.7, 220),
      item(12, "Total Question 2 6", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2023,
      questionItems,
      markSchemeItems,
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.questionKey).toBe("02");
    expect(drafts[0]?.maxMarks).toBe(6);
    expect(drafts[0]?.extractedQuestionText).toContain("Figure 2 shows onion cells");
    expect(drafts[0]?.supportingPdfBoxes).toEqual([
      expect.objectContaining({
        pageNumber: 9,
      }),
    ]);
  });

  it("ignores footer-only continuation noise and keeps raster-answer crops on the primary page", () => {
    const questionItems: TextItem[] = [
      item(20, "0", 52.4, 687.8),
      item(20, "5", 69.1, 687.8),
      item(20, ".", 82.3, 687.0),
      item(20, "2", 92.6, 687.8),
      item(20, "Vanadium-52 (V) decays by emitting beta particles.", 114.8, 687.0, 280),
      item(20, "What is the correct nuclear equation for this process?", 114.8, 661.8, 280),
      item(20, "Tick one box.", 114.8, 635.8, 96),
      item(21, "10", 553.8, 126.1, 16),
    ];
    const markSchemeItems: TextItem[] = [
      item(15, "05.2", 67.3, 675.7, 24),
      item(15, "beta particle emitted and chromium-52 formed", 113.2, 675.7, 240),
      item(15, "1", 466.2, 675.7, 8),
      item(16, "Total Question 5 1", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems,
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.questionKey).toBe("05.2");
    expect(drafts[0]?.pageStart).toBe(20);
    expect(drafts[0]?.pageEnd).toBe(20);
    expect(drafts[0]?.supportingPdfBoxes).toEqual([]);
    expect((drafts[0]?.primaryPdfBox.right ?? 0) - (drafts[0]?.primaryPdfBox.left ?? 0)).toBeGreaterThan(490);
    expect((drafts[0]?.primaryPdfBox.top ?? 0) - (drafts[0]?.primaryPdfBox.bottom ?? 0)).toBeGreaterThan(500);
  });

  it("bounds same-page supporting crops before the next question start", () => {
    const questionItems: TextItem[] = [
      item(2, "0", 52.7, 707.9),
      item(2, "1", 69.4, 707.9),
      item(2, ".", 82.4, 707.9),
      item(2, "1", 92.6, 707.9),
      item(2, "Describe the energy transfer shown in the diagram.", 114.8, 707.0, 300),
      item(3, "Continuation of the answer space.", 114.8, 735.0, 220),
      item(3, "0", 52.7, 690.0),
      item(3, "1", 69.4, 690.0),
      item(3, ".", 82.4, 690.0),
      item(3, "2", 92.6, 690.0),
      item(3, "Calculate the useful energy transferred.", 114.8, 689.2, 260),
    ];
    const markSchemeItems: TextItem[] = [
      item(7, "01.1", 67.3, 675.7, 24),
      item(7, "energy transferred mechanically", 113.2, 675.7, 180),
      item(7, "1", 466.2, 675.7, 8),
      item(7, "01.2", 67.3, 573.7, 24),
      item(7, "correct substitution and answer", 113.2, 573.7, 180),
      item(7, "1", 466.2, 573.7, 8),
      item(8, "Total Question 1 2", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems,
    });
    const supportingBox = drafts[0]?.supportingPdfBoxes[0];

    expect(supportingBox).toEqual(expect.objectContaining({ pageNumber: 3 }));
    expect(supportingBox?.bottom).toBeGreaterThan(720);
    expect((supportingBox?.top ?? 0) - (supportingBox?.bottom ?? 0)).toBeLessThan(120);
  });

  it("extends terminal question crops to the lowest detected answer option", () => {
    const questionItems: TextItem[] = [
      item(9, "0", 52.7, 330.0),
      item(9, "2", 69.4, 330.0),
      item(9, ".", 82.4, 330.0),
      item(9, "4", 92.6, 330.0),
      item(9, "Which scientist provided evidence that neutrons exist?", 114.8, 329.2, 300),
      item(9, "Tick one box.", 114.8, 300.0, 90),
      item(9, "Isaac Newton", 170.0, 240.0, 100),
      item(9, "James Chadwick", 170.0, 195.0, 120),
      item(9, "Niels Bohr", 170.0, 150.0, 90),
    ];
    const markSchemeItems: TextItem[] = [
      item(12, "02.4", 67.3, 675.7, 24),
      item(12, "James Chadwick", 113.2, 675.7, 100),
      item(12, "1", 466.2, 675.7, 8),
      item(13, "Total Question 2 1", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems,
    });

    expect(drafts[0]?.primaryPdfBox.bottom).toBeLessThan(130);
  });

  it("keeps later subquestion crops bounded to their own visual segment", () => {
    const questionItems: TextItem[] = [
      item(8, "0", 52.7, 760.0),
      item(8, "2", 69.4, 760.0),
      item(8, "Shared context for this question.", 114.8, 759.2, 240),
      item(8, "0", 52.7, 705.0),
      item(8, "2", 69.4, 705.0),
      item(8, ".", 82.4, 705.0),
      item(8, "1", 92.6, 705.0),
      item(8, "What does an alpha particle consist of?", 114.8, 704.2, 220),
      item(8, "0", 52.7, 500.0),
      item(8, "2", 69.4, 500.0),
      item(8, ".", 82.4, 500.0),
      item(8, "2", 92.6, 500.0),
      item(8, "How many neutrons are there?", 114.8, 499.2, 200),
      item(8, "Number of neutrons =", 300.0, 430.0, 140),
      item(9, "0", 52.7, 760.0),
      item(9, "2", 69.4, 760.0),
      item(9, ".", 82.4, 760.0),
      item(9, "3", 92.6, 760.0),
      item(9, "Describe the model.", 114.8, 759.2, 160),
    ];
    const markSchemeItems: TextItem[] = [
      item(12, "02.1", 67.3, 675.7, 24),
      item(12, "2 protons and 2 neutrons", 113.2, 675.7, 160),
      item(12, "1", 466.2, 675.7, 8),
      item(12, "02.2", 67.3, 573.7, 24),
      item(12, "118", 113.2, 573.7, 30),
      item(12, "1", 466.2, 573.7, 8),
      item(12, "02.3", 67.3, 473.7, 24),
      item(12, "clear description", 113.2, 473.7, 120),
      item(12, "1", 466.2, 473.7, 8),
      item(13, "Total Question 2 3", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems,
    });
    const question022 = drafts.find((draft) => draft.questionKey === "02.2");

    expect(question022?.primaryPdfBox.top).toBeLessThan(560);
    expect(question022?.primaryPdfBox.bottom).toBeLessThan(410);
    expect(question022?.extractedQuestionText).toContain("Shared context for this question.");
  });

  it("preserves figure-only source space that PDF text extraction cannot see", () => {
    const questionItems: TextItem[] = [
      item(8, "0", 52.7, 763.7),
      item(8, "2", 69.4, 763.7),
      item(8, ".", 82.4, 763.2),
      item(8, "3", 92.6, 763.6),
      item(8, "Figure 2 shows the results predicted by the model.", 114.8, 712.3, 310),
      item(8, "Figure 2", 269.2, 674.4, 43),
      item(9, "Describe how the actual results led to the new model.", 114.8, 740.0, 320),
    ];
    const markSchemeItems: TextItem[] = [
      item(12, "02.3", 67.3, 675.7, 24),
      item(12, "clear comparison of results and models", 113.2, 675.7, 220),
      item(12, "6", 466.2, 675.7, 8),
      item(13, "Total Question 2 6", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems,
    });

    expect(drafts[0]?.primaryPdfBox.bottom).toBe(140);
  });

  it("keeps adjacent 2024 tick-box questions as separate answerable parts", () => {
    const questionItems: TextItem[] = [
      item(12, "0", 52.7, 620.0),
      item(12, "3", 69.4, 620.0),
      item(12, ".", 82.4, 620.0),
      item(12, "5", 92.6, 620.0),
      item(12, "What conclusion can be made about the investigation?", 114.8, 584.0, 300),
      item(12, "Tick () one box.", 114.8, 562.0, 100),
      item(12, "The investigation is repeatable.", 114.8, 520.0, 180),
      item(12, "The investigation is reproducible.", 114.8, 480.0, 190),
      item(12, "The results were accurate.", 114.8, 440.0, 160),
      item(12, "0", 52.7, 380.0),
      item(12, "3", 69.4, 380.0),
      item(12, ".", 82.4, 380.0),
      item(12, "6", 92.6, 380.0),
      item(12, "Which of the following always shows a linear relationship?", 114.8, 344.0, 320),
      item(12, "Tick () one box.", 114.8, 322.0, 100),
      item(12, "Filament lamp", 114.8, 280.0, 100),
      item(12, "LDR", 114.8, 240.0, 40),
      item(12, "Resistor at constant temperature", 114.8, 200.0, 190),
      item(12, "Thermistor", 114.8, 160.0, 80),
    ];
    const markSchemeItems: TextItem[] = [
      item(18, "03.5", 67.3, 675.7, 24),
      item(18, "reproducible", 113.2, 675.7, 80),
      item(18, "1", 466.2, 675.7, 8),
      item(18, "03.6", 67.3, 573.7, 24),
      item(18, "resistor at constant temperature", 113.2, 573.7, 180),
      item(18, "1", 466.2, 573.7, 8),
      item(18, "Total Question 3 2", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems,
    });

    expect(drafts.map((draft) => draft.questionKey)).toEqual(["03.5", "03.6"]);
    expect(drafts.map((draft) => draft.maxMarks)).toEqual([1, 1]);
    expect(drafts[0]?.markSchemeText).toContain("reproducible");
    expect(drafts[1]?.markSchemeText).toContain("resistor at constant temperature");
  });

  it("does not let setup for the next same-page subquestion become multiple-choice options", () => {
    const questionItems: TextItem[] = [
      item(11, "0", 52.7, 355.0),
      item(11, "3", 69.4, 355.0),
      item(11, ".", 82.4, 355.0),
      item(11, "3", 92.6, 355.0),
      item(11, "Which blood vessel carries deoxygenated blood?", 114.8, 354.2, 260),
      item(11, "Tick () one box.", 114.8, 320.0, 110),
      item(11, "Aorta", 170.0, 280.0, 60),
      item(11, "Coronary artery", 170.0, 240.0, 120),
      item(11, "Pulmonary artery", 170.0, 200.0, 120),
      item(11, "Pulmonary vein", 170.0, 160.0, 110),
      item(11, "The structure of a vein is different from the structure of an artery.", 114.8, 105.0, 360),
      item(11, "One difference is that veins have valves but arteries do not have valves.", 114.8, 85.0, 380),
      item(12, "0", 52.7, 720.0),
      item(12, "3", 69.4, 720.0),
      item(12, ".", 82.4, 720.0),
      item(12, "4", 92.6, 720.0),
      item(12, "Explain why veins have valves, but arteries do not.", 114.8, 719.2, 280),
    ];
    const markSchemeItems: TextItem[] = [
      item(12, "03.3", 67.3, 675.7, 24),
      item(12, "pulmonary artery", 113.2, 675.7, 120),
      item(12, "1", 466.2, 675.7, 8),
      item(12, "03.4", 67.3, 573.7, 24),
      item(12, "veins carry blood at low pressure", 113.2, 573.7, 190),
      item(12, "2", 466.2, 573.7, 8),
      item(13, "Total Question 3 3", 49.5, 75.7, 96),
    ];

    const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts({
      year: 2023,
      questionItems,
      markSchemeItems,
    });
    const question033 = drafts.find((draft) => draft.questionKey === "03.3");
    const question034 = drafts.find((draft) => draft.questionKey === "03.4");

    expect(question033?.extractedQuestionText).toContain("Pulmonary vein");
    expect(question033?.extractedQuestionText).not.toContain("veins have valves");
    expect(question034?.extractedQuestionText).toContain("veins have valves");
    expect(question034?.extractedQuestionText).toContain("Explain why veins have valves");
  });
});
