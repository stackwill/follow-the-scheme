import { describe, expect, it } from "vitest";

import { aqaGcseComputerSciencePaper1BPythonAdapter } from "@/lib/import/adapters/aqa-gcse-computer-science-paper-1b-python";
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

function questionLabelItems(questionKey: string, pageNumber: number, y: number) {
  const [mainKey, partKey] = questionKey.split(".");
  const items = [
    item(pageNumber, mainKey[0] ?? "0", 53, y),
    item(pageNumber, mainKey[1] ?? "0", 69, y),
  ];

  if (partKey) {
    items.push(item(pageNumber, ".", 82, y), item(pageNumber, partKey, 92, y));
  }

  return items;
}

function markSchemeItems(questionKey: string, maxMarks: number, pageNumber: number, y: number) {
  const [mainKey, partKey] = questionKey.split(".");

  return [
    item(pageNumber, mainKey, 68, y),
    ...(partKey ? [item(pageNumber, partKey, 119, y)] : []),
    item(pageNumber, `mark scheme for ${questionKey}`, 145, y, 160),
    item(pageNumber, String(maxMarks), 525, y),
  ];
}

const MARKS_BY_QUESTION = [
  ["01.1", 1],
  ["01.2", 1],
  ["01.3", 1],
  ["01.4", 1],
  ["01.5", 2],
  ["02.1", 1],
  ["02.2", 1],
  ["02.3", 1],
  ["02.4", 1],
  ["02.5", 1],
  ["03.1", 2],
  ["03.2", 2],
  ["03.3", 2],
  ["04.1", 1],
  ["04.2", 1],
  ["05", 3],
  ["06", 7],
  ["07", 4],
  ["08", 6],
  ["09.1", 1],
  ["09.2", 3],
  ["09.3", 3],
  ["10.1", 1],
  ["10.2", 1],
  ["11", 7],
  ["12.1", 2],
  ["12.2", 2],
  ["12.3", 1],
  ["12.4", 1],
  ["12.5", 1],
  ["12.6", 4],
  ["12.7", 6],
  ["13", 3],
  ["14.1", 1],
  ["14.2", 6],
  ["15", 8],
] as const;

function genericQuestionItems(questionKey: string, pageNumber: number, y = 740) {
  return [
    ...questionLabelItems(questionKey, pageNumber, y),
    item(pageNumber, `Question ${questionKey} prompt.`, 115, y),
  ];
}

describe("aqaGcseComputerSciencePaper1BPythonAdapter", () => {
  it("assigns pre-label setup on a page to the following subquestion", () => {
    let genericIndex = 0;
    const questionItems = MARKS_BY_QUESTION.flatMap(([questionKey]) => {
      if (questionKey.startsWith("12") || questionKey === "13" || questionKey.startsWith("14") || questionKey === "15") {
        return [];
      }

      const items = genericQuestionItems(
        questionKey,
        2 + Math.floor(genericIndex / 2),
        740 - (genericIndex % 2) * 180,
      );
      genericIndex += 1;
      return items;
    });

    questionItems.push(
      ...questionLabelItems("12", 24, 763),
      item(24, "A program is being written to solve a sliding puzzle.", 115, 763),
      item(25, "Table 3 describes the purpose of three subroutines the program uses.", 115, 762),
      ...questionLabelItems("12.1", 26, 763),
      item(26, "The Python program shown in Figure 14 uses the subroutines in Table 3.", 115, 762),
      item(26, "Complete the board after the program in Figure 14 is run.", 115, 399),
      item(27, "Figure 16 shows part of a Python program that uses getTile.", 115, 762),
      item(27, "The program is used with the board shown in Figure 17.", 115, 723),
      ...questionLabelItems("12.2", 27, 379),
      item(27, "Which two statements about the program in Figure 16 are true?", 115, 378),
      item(28, "Figure 16 and Figure 17 are repeated below.", 115, 762),
      ...questionLabelItems("12.3", 28, 403),
      item(28, "Explain the purpose of the first iteration structure.", 115, 402),
      ...questionLabelItems("12.4", 28, 296),
      item(28, "Explain the purpose of the second iteration structure.", 115, 295),
      ...questionLabelItems("12.5", 28, 188),
      item(28, "State the purpose of the program in Figure 16.", 115, 187),
      ...questionLabelItems("12.6", 30, 763),
      item(30, "Write a Python program to check that values in the first row are consecutive.", 115, 640),
      item(30, "The answer grid below contains vertical lines to help you indent your code accurately.", 115, 120),
      ...genericQuestionItems("12.7", 32),
      ...genericQuestionItems("13", 34),
      ...genericQuestionItems("14.1", 35),
      ...genericQuestionItems("14.2", 36),
      ...genericQuestionItems("15", 37),
    );

    const markSchemeTextItems = MARKS_BY_QUESTION.flatMap(([questionKey, maxMarks], index) =>
      markSchemeItems(questionKey, maxMarks, 23 + Math.floor(index / 6), 720 - (index % 6) * 90),
    );

    const drafts = aqaGcseComputerSciencePaper1BPythonAdapter.detectQuestionDrafts({
      year: 2024,
      questionItems,
      markSchemeItems: markSchemeTextItems,
    });
    const question121 = drafts.find((draft) => draft.questionKey === "12.1");
    const question122 = drafts.find((draft) => draft.questionKey === "12.2");
    const question123 = drafts.find((draft) => draft.questionKey === "12.3");
    const question126 = drafts.find((draft) => draft.questionKey === "12.6");

    expect(question121?.maxMarks).toBe(2);
    expect(question121?.extractedQuestionText).toContain("sliding puzzle");
    expect(question121?.extractedQuestionText).not.toContain("Figure 16 shows part");
    expect(question121?.pageEnd).toBe(26);
    expect(question122?.maxMarks).toBe(2);
    expect(question122?.extractedQuestionText).toContain("Figure 16 shows part");
    expect(question122?.extractedQuestionText).not.toContain("Figure 16 and Figure 17 are repeated below");
    expect(question123?.maxMarks).toBe(1);
    expect(question123?.extractedQuestionText).toContain("Figure 16 and Figure 17 are repeated below");
    expect(question126?.maxMarks).toBe(4);
    expect(question126?.primaryPdfBox.bottom).toBeLessThan(80);
    expect(question126?.pageEnd).toBe(31);
    expect(question126?.supportingPdfBoxes).toEqual([
      expect.objectContaining({
        pageNumber: 31,
        bottom: 70,
      }),
    ]);
  });
});
