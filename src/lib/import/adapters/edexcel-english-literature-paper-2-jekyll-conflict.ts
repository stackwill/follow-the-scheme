import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const ADAPTER_KEY = "edexcel-gcse-english-literature-paper-2-jekyll-conflict";
const CROP_LEFT = 50;
const CROP_RIGHT = 550;
const EXPECTED_TOTAL_MARKS = 80;

type Line = {
  pageNumber: number;
  y: number;
  items: TextItem[];
  rawText: string;
  text: string;
};

type QuestionConfig = {
  key: string;
  label: string;
  displayOrder: number;
  maxMarks: number;
  primaryPage: number;
  primaryBox: QuestionPdfBox;
  supportingBoxes: SupportingPdfBox[];
  questionTextPages: number[];
};

const QUESTION_CONFIGS: QuestionConfig[] = [
  {
    key: "3.a",
    label: "3 (a)",
    displayOrder: 1,
    maxMarks: 20,
    primaryPage: 29,
    primaryBox: { left: CROP_LEFT, right: CROP_RIGHT, top: 802, bottom: 730 },
    supportingBoxes: [{ pageNumber: 28, left: CROP_LEFT, right: CROP_RIGHT, top: 818, bottom: 226 }],
    questionTextPages: [28, 29],
  },
  {
    key: "3.b",
    label: "3 (b)",
    displayOrder: 2,
    maxMarks: 20,
    primaryPage: 29,
    primaryBox: { left: CROP_LEFT, right: CROP_RIGHT, top: 735, bottom: 590 },
    supportingBoxes: [{ pageNumber: 28, left: CROP_LEFT, right: CROP_RIGHT, top: 818, bottom: 226 }],
    questionTextPages: [28, 29],
  },
  {
    key: "9",
    label: "9",
    displayOrder: 3,
    maxMarks: 20,
    primaryPage: 41,
    primaryBox: { left: CROP_LEFT, right: CROP_RIGHT, top: 818, bottom: 292 },
    supportingBoxes: [{ pageNumber: 40, left: CROP_LEFT, right: CROP_RIGHT, top: 818, bottom: 55 }],
    questionTextPages: [40, 41],
  },
  {
    key: "12",
    label: "12",
    displayOrder: 4,
    maxMarks: 20,
    primaryPage: 47,
    primaryBox: { left: CROP_LEFT, right: CROP_RIGHT, top: 818, bottom: 282 },
    supportingBoxes: [{ pageNumber: 46, left: CROP_LEFT, right: CROP_RIGHT, top: 818, bottom: 330 }],
    questionTextPages: [46, 47],
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
      rawText: "",
      text: "",
    });
  }

  return lines
    .map((line) => ({
      ...line,
      items: [...line.items].sort((left, right) => left.x - right.x),
      rawText: normalizeText(
        line.items
          .sort((left, right) => left.x - right.x)
          .map((item) => item.text)
          .join(" "),
      ),
      text: normalizeText(
        line.items
          .filter((item) => item.x >= CROP_LEFT && item.x <= CROP_RIGHT)
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
    text.includes("begin your answer") ||
    text.includes("total for section") ||
    text.includes("total for paper") ||
    text.includes("turn over") ||
    /^p\d+[a-z]?\s+\d+$/.test(text) ||
    /^\d+\s+p\d+[a-z]?$/.test(text) ||
    /^[\s]+$/.test(line.text)
  );
}

function linesInBox(lines: Line[], pageNumber: number, box: QuestionPdfBox) {
  return lines.filter(
    (line) =>
      line.pageNumber === pageNumber &&
      line.y <= box.top &&
      line.y >= box.bottom &&
      !isBoilerplate(line),
  );
}

function buildQuestionText(lines: Line[], config: QuestionConfig) {
  const collected = [
    ...config.supportingBoxes.flatMap((box) => linesInBox(lines, box.pageNumber, box)),
    ...linesInBox(lines, config.primaryPage, config.primaryBox),
  ];

  return collected.map((line) => line.text).join("\n").trim();
}

function markSchemeLabel(line: Line) {
  const text = line.rawText;

  if (/^3\s*\(a\)/i.test(text)) {
    return "3.a";
  }

  if (/^3\s*\(b\)/i.test(text)) {
    return "3.b";
  }

  if (/^9\b/.test(text) && /indicative content|conflict|the indicative content/i.test(text)) {
    return "9";
  }

  if (/^12\b/.test(text) && /indicative content|unseen poetry|the indicative content/i.test(text)) {
    return "12";
  }

  const laterPaperMatch = text.match(/^(?:10|11)\b/);

  if (laterPaperMatch && /indicative content|the indicative content/i.test(text)) {
    return laterPaperMatch[0];
  }

  return null;
}

function buildMarkSchemeBlocks(lines: Line[]) {
  const starts = lines
    .map((line, index) => {
      const label = markSchemeLabel(line);
      return label ? { label, index } : null;
    })
    .filter((entry): entry is { label: string; index: number } => entry !== null);
  const blocks = new Map<string, string>();

  for (const config of QUESTION_CONFIGS) {
    const start = starts.find((entry) => entry.label === config.key);

    if (!start) {
      throw new ImportFailure("adapter", `Missing mark scheme block for ${config.key}`, {
        adapterKey: ADAPTER_KEY,
        questionKey: config.key,
      });
    }

    const nextStart = starts.find((entry) => entry.index > start.index);
    const blockLines = lines.slice(start.index, nextStart?.index ?? lines.length);
    blocks.set(
      config.key,
      blockLines
        .filter((line) => !isBoilerplate(line))
        .map((line) => line.text)
        .join("\n")
        .trim(),
    );
  }

  return blocks;
}

function validateDrafts(drafts: QuestionDraft[], year: number) {
  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (drafts.length !== QUESTION_CONFIGS.length) {
    throw new ImportFailure("adapter", `Expected ${QUESTION_CONFIGS.length} Edexcel Literature drafts`, {
      adapterKey: ADAPTER_KEY,
      year,
      questionCount: drafts.length,
    });
  }

  if (totalMarks !== EXPECTED_TOTAL_MARKS) {
    throw new ImportFailure("adapter", "Edexcel Literature route total marks mismatch", {
      adapterKey: ADAPTER_KEY,
      year,
      totalMarks,
      expectedTotalMarks: EXPECTED_TOTAL_MARKS,
    });
  }

  for (const draft of drafts) {
    if (!draft.extractedQuestionText || !draft.markSchemeText) {
      throw new ImportFailure("adapter", `Incomplete Edexcel Literature draft ${draft.questionKey}`, {
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
  const markSchemeBlocks = buildMarkSchemeBlocks(markSchemeLines);
  const drafts = QUESTION_CONFIGS.map((config) => {
    const markSchemeText = markSchemeBlocks.get(config.key) ?? "";

    return {
      questionKey: config.key,
      displayOrder: config.displayOrder,
      maxMarks: config.maxMarks,
      extractedQuestionText: buildQuestionText(questionLines, config),
      markSchemeText,
      markSchemeNotes:
        "Edexcel GCSE English Literature Paper 2 route: Dr Jekyll and Mr Hyde, Conflict anthology, and compulsory unseen poetry.",
      pageStart: config.primaryPage,
      pageEnd: Math.max(config.primaryPage, ...config.supportingBoxes.map((box) => box.pageNumber)),
      primaryPdfBox: config.primaryBox,
      supportingPdfBoxes: config.supportingBoxes,
      importDiagnostics: {
        adapterKey: ADAPTER_KEY,
        sourceQuestionLabel: config.label,
        sourceMarkSchemeLabel: config.label,
        contextQuestionLabel: null,
        warnings: [],
      },
    } satisfies QuestionDraft;
  });

  validateDrafts(drafts, year);

  return drafts;
}

export const edexcelGcseEnglishLiteraturePaper2JekyllConflictAdapter = {
  key: ADAPTER_KEY,
  importVersion: "2026-05-15.1",
  detectQuestionDrafts,
} satisfies PaperImportAdapter;
