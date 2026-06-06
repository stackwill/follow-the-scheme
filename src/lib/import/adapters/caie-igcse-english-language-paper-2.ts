import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const ADAPTER_KEY = "caie-igcse-english-language-paper-2";
const EXPECTED_TOTAL_MARKS = 80;
const CROP_LEFT = 45;
const CROP_RIGHT = 550;

type Line = {
  pageNumber: number;
  y: number;
  items: TextItem[];
  text: string;
};

type DraftConfig = {
  questionKey: string;
  displayOrder: number;
  maxMarks: number;
  primaryBox: QuestionPdfBox & { pageNumber: number };
  supportingBoxes: Array<QuestionPdfBox & { pageNumber: number }>;
  questionTextPages: number[];
  markSchemePages: number[];
};

const DRAFT_CONFIGS: DraftConfig[] = [
  {
    questionKey: "1",
    displayOrder: 1,
    maxMarks: 40,
    primaryBox: { pageNumber: 2, left: CROP_LEFT, right: CROP_RIGHT, top: 782, bottom: 485 },
    supportingBoxes: [
      { pageNumber: 14, left: CROP_LEFT, right: CROP_RIGHT, top: 780, bottom: 350 },
      { pageNumber: 15, left: CROP_LEFT, right: CROP_RIGHT, top: 780, bottom: 340 },
    ],
    questionTextPages: [2, 14, 15],
    markSchemePages: [4, 5, 6, 7],
  },
  {
    questionKey: "2-5",
    displayOrder: 2,
    maxMarks: 40,
    primaryBox: { pageNumber: 6, left: CROP_LEFT, right: CROP_RIGHT, top: 780, bottom: 340 },
    supportingBoxes: [],
    questionTextPages: [6],
    markSchemePages: [8, 9, 10, 11],
  },
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function groupItemsIntoLines(items: TextItem[]) {
  const lines: Line[] = [];
  const sortedItems = [...items].sort(
    (left, right) => left.pageNumber - right.pageNumber || right.y - left.y || left.x - right.x,
  );

  for (const item of sortedItems) {
    const previousLine = lines.at(-1);

    if (previousLine && previousLine.pageNumber === item.pageNumber && Math.abs(previousLine.y - item.y) <= 2.2) {
      previousLine.items.push(item);
      previousLine.y = Math.max(previousLine.y, item.y);
      continue;
    }

    lines.push({
      pageNumber: item.pageNumber,
      y: item.y,
      items: [item],
      text: "",
    });
  }

  return lines
    .map((line) => ({
      ...line,
      items: [...line.items].sort((left, right) => left.x - right.x),
      text: normalizeText(
        line.items
          .sort((left, right) => left.x - right.x)
          .map((item) => item.text)
          .join(" "),
      ),
    }))
    .filter((line) => line.text.length > 0);
}

function isBoilerplate(line: Line) {
  const text = line.text.toLowerCase();

  return (
    text === "pmt" ||
    text.includes("© ucles") ||
    text.includes("© cambridge university press") ||
    text.includes("cambridge igcse – mark scheme") ||
    text.includes("published") ||
    text.includes("may/june 2024") ||
    text.includes("[turn over") ||
    /^page \d+ of \d+$/.test(text) ||
    /^0500\/21/.test(text) ||
    /^\d+$/.test(text)
  );
}

function textForPages(lines: Line[], pageNumbers: number[]) {
  const pageSet = new Set(pageNumbers);

  return lines
    .filter((line) => pageSet.has(line.pageNumber) && !isBoilerplate(line))
    .map((line) => line.text)
    .join("\n")
    .trim();
}

function validateDrafts(drafts: QuestionDraft[], year: number) {
  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (drafts.length !== DRAFT_CONFIGS.length || totalMarks !== EXPECTED_TOTAL_MARKS) {
    throw new ImportFailure("adapter", "CAIE English Language Paper 2 draft contract mismatch", {
      adapterKey: ADAPTER_KEY,
      year,
      questionCount: drafts.length,
      totalMarks,
      expectedTotalMarks: EXPECTED_TOTAL_MARKS,
    });
  }

  for (const draft of drafts) {
    if (!draft.extractedQuestionText || !draft.markSchemeText) {
      throw new ImportFailure("adapter", `Incomplete CAIE English Language draft ${draft.questionKey}`, {
        adapterKey: ADAPTER_KEY,
        year,
        questionKey: draft.questionKey,
      });
    }
  }
}

function detectQuestionDrafts({ year, questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
  const questionLines = groupItemsIntoLines(questionItems);
  const markSchemeLines = groupItemsIntoLines(markSchemeItems);
  const drafts = DRAFT_CONFIGS.map((config) => {
    const extractedQuestionText = textForPages(questionLines, config.questionTextPages);
    const markSchemeText = textForPages(markSchemeLines, config.markSchemePages);

    return {
      questionKey: config.questionKey,
      displayOrder: config.displayOrder,
      maxMarks: config.maxMarks,
      extractedQuestionText,
      markSchemeText,
      markSchemeNotes:
        config.questionKey === "2-5"
          ? "Candidate answers one of the Section B composition options."
          : "Question 1 uses Text A and Text B from the insert.",
      pageStart: config.primaryBox.pageNumber,
      pageEnd: config.primaryBox.pageNumber,
      primaryPdfBox: {
        left: config.primaryBox.left,
        right: config.primaryBox.right,
        top: config.primaryBox.top,
        bottom: config.primaryBox.bottom,
      },
      supportingPdfBoxes: config.supportingBoxes,
      importDiagnostics: {
        adapterKey: ADAPTER_KEY,
        sourceQuestionLabel: config.questionKey,
        sourceMarkSchemeLabel: config.questionKey,
        contextQuestionLabel: null,
        warnings: [],
      },
    } satisfies QuestionDraft;
  });

  validateDrafts(drafts, year);

  return drafts;
}

export const caieIgcseEnglishLanguagePaper2Adapter: PaperImportAdapter = {
  key: ADAPTER_KEY,
  importVersion: "2026-05-20.1",
  detectQuestionDrafts,
};
