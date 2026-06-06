import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const ADAPTER_KEY = "edexcel-gcse-maths-paper-2-higher";
const NOVEMBER_2024_ADAPTER_KEY = "edexcel-gcse-maths-paper-2-higher-november-2024";
const QUESTION_CROP_LEFT = 35;
const QUESTION_CROP_RIGHT = 565;
const QUESTION_PAGE_TOP_LIMIT = 815;
const QUESTION_PAGE_BOTTOM_LIMIT = 58;
const QUESTION_TOP_PADDING = 12;
const QUESTION_START_BOTTOM_PADDING = 8;
const MIN_BOX_HEIGHT = 72;
const EXPECTED_TOTAL_MARKS = 80;
const EXPECTED_QUESTION_COUNTS = new Map([
  [2023, 24],
  [2024, 22],
]);

type Line = {
  pageNumber: number;
  y: number;
  items: TextItem[];
  rawText: string;
  contentText: string;
};

type QuestionLabel = {
  label: string;
  line: Line;
  index: number;
};

type MarkSchemeBlock = {
  label: string;
  markSchemeText: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildLineText(items: TextItem[], minX = -Infinity, maxX = Infinity) {
  return normalizeText(
    items
      .filter((item) => item.x >= minX && item.x <= maxX)
      .map((item) => item.text)
      .join(" "),
  );
}

function groupItemsIntoLines(items: TextItem[]) {
  const lines: Line[] = [];
  const sortedItems = [...items].sort(
    (left, right) => left.pageNumber - right.pageNumber || right.y - left.y || left.x - right.x,
  );

  for (const item of sortedItems) {
    const previousLine = lines.at(-1);

    if (previousLine && previousLine.pageNumber === item.pageNumber && Math.abs(previousLine.y - item.y) <= 2.5) {
      previousLine.items.push(item);
      previousLine.y = Math.max(previousLine.y, item.y);
      continue;
    }

    lines.push({
      pageNumber: item.pageNumber,
      y: item.y,
      items: [item],
      rawText: "",
      contentText: "",
    });
  }

  return lines
    .map((line) => {
      const sortedLineItems = [...line.items].sort((left, right) => left.x - right.x);

      return {
        ...line,
        items: sortedLineItems,
        rawText: buildLineText(sortedLineItems),
        contentText: buildLineText(sortedLineItems, QUESTION_CROP_LEFT, QUESTION_CROP_RIGHT),
      };
    })
    .filter((line) => line.rawText.length > 0);
}

function isQuestionPaperBoilerplate(line: Line) {
  const text = line.rawText.toLowerCase();

  return (
    text === "pmt" ||
    text.includes("do not write in this area") ||
    text.includes("turn over") ||
    text.includes("blank page") ||
    text.includes("total for question") ||
    text.includes("total for paper") ||
    /^\*p.*\*$/.test(text) ||
    /^[\s]+$/.test(line.rawText) ||
    (line.y < 90 && /^\d+$/.test(text))
  );
}

function parseQuestionLabel(line: Line) {
  if (line.y < 120 || line.y > QUESTION_PAGE_TOP_LIMIT || isQuestionPaperBoilerplate(line)) {
    return null;
  }

  const firstItem = line.items.find((item) => item.text.trim().length > 0);

  if (!firstItem || firstItem.x < 65 || firstItem.x > 78) {
    return null;
  }

  const match = firstItem.text.trim().match(/^(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const questionNumber = Number(match[1]);

  return questionNumber >= 1 && questionNumber <= 30 ? String(questionNumber) : null;
}

function findQuestionLabels(lines: Line[]) {
  const labels: QuestionLabel[] = [];

  for (const [index, line] of lines.entries()) {
    const label = parseQuestionLabel(line);

    if (!label || labels.some((entry) => entry.label === label)) {
      continue;
    }

    labels.push({ label, line, index });
  }

  return labels;
}

function findMarkSchemeTableStart(lines: Line[]) {
  return lines.findIndex((line) => /^Paper:\s*1MA1\/2H$/i.test(line.contentText));
}

function parseMarkSchemeLabel(line: Line) {
  if (line.y < 120 || line.y > 495) {
    return null;
  }

  const firstItem = line.items.find((item) => item.text.trim().length > 0);

  if (!firstItem || firstItem.x < 55 || firstItem.x > 90) {
    return null;
  }

  const match = firstItem.text.trim().match(/^(\d{1,2})$/);

  return match ? String(Number(match[1])) : null;
}

function buildMarkSchemeBlocks(lines: Line[]) {
  const tableStart = findMarkSchemeTableStart(lines);

  if (tableStart < 0) {
    return { blocks: new Map<string, MarkSchemeBlock>(), fatalErrors: ["mark scheme table header not found"] };
  }

  const tableLines = lines.slice(tableStart);
  const modificationsIndex = tableLines.findIndex((line) =>
    /modifications to the mark scheme/i.test(line.rawText),
  );
  const coreLines = modificationsIndex >= 0 ? tableLines.slice(0, modificationsIndex) : tableLines;
  const starts = coreLines
    .map((line, index) => {
      const label = parseMarkSchemeLabel(line);
      return label ? { label, index } : null;
    })
    .filter((entry): entry is { label: string; index: number } => entry !== null);
  const blocks = new Map<string, MarkSchemeBlock>();
  const fatalErrors: string[] = [];

  for (const [index, start] of starts.entries()) {
    if (blocks.has(start.label)) {
      continue;
    }

    const nextStart = starts.slice(index + 1).find((entry) => entry.label !== start.label);
    const blockLines = coreLines.slice(start.index, nextStart?.index ?? coreLines.length);
    const markSchemeText = blockLines
      .map((line) => line.contentText)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!markSchemeText) {
      fatalErrors.push(`empty mark scheme block for ${start.label}`);
      continue;
    }

    blocks.set(start.label, { label: start.label, markSchemeText });
  }

  return { blocks, fatalErrors };
}

function readQuestionMarks(lines: Line[], label: string) {
  const text = lines.map((line) => line.rawText).join(" ");
  const match = text.match(new RegExp(`Total for Question\\s+${label}\\s+is\\s+(\\d+)\\s+marks?`, "i"));

  return match ? Number(match[1]) : 0;
}

function buildQuestionText(lines: Line[]) {
  return lines
    .filter((line) => !isQuestionPaperBoilerplate(line))
    .map((line) => line.contentText)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildPageBandPdfBox(lines: Line[], nextQuestionStartLine: Line | null = null): QuestionPdfBox {
  const visibleItems = lines
    .flatMap((line) => line.items)
    .filter((item) => item.x >= QUESTION_CROP_LEFT && item.x <= QUESTION_CROP_RIGHT);
  const nextQuestionBottom =
    nextQuestionStartLine === null
      ? null
      : nextQuestionStartLine.y +
        Math.max(...nextQuestionStartLine.items.map((item) => item.height), 0) +
        QUESTION_START_BOTTOM_PADDING;

  if (visibleItems.length === 0) {
    const bottom = nextQuestionBottom ?? QUESTION_PAGE_BOTTOM_LIMIT;

    return {
      left: QUESTION_CROP_LEFT,
      right: QUESTION_CROP_RIGHT,
      top: Math.min(QUESTION_PAGE_TOP_LIMIT, bottom + MIN_BOX_HEIGHT),
      bottom,
    };
  }

  const top = Math.min(
    QUESTION_PAGE_TOP_LIMIT,
    Math.max(...visibleItems.map((item) => item.y + item.height)) + QUESTION_TOP_PADDING,
  );
  const bottom = Math.max(
    QUESTION_PAGE_BOTTOM_LIMIT,
    Math.min(nextQuestionBottom ?? QUESTION_PAGE_BOTTOM_LIMIT, top - MIN_BOX_HEIGHT),
  );

  return {
    left: QUESTION_CROP_LEFT,
    right: QUESTION_CROP_RIGHT,
    top,
    bottom,
  };
}

function buildQuestionDrafts(
  adapterKey: string,
  year: number,
  questionLines: Line[],
  markSchemeBlocks: Map<string, MarkSchemeBlock>,
) {
  const labels = findQuestionLabels(questionLines);
  const expectedQuestionCount = EXPECTED_QUESTION_COUNTS.get(year);
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();
  const drafts: QuestionDraft[] = [];

  for (const [displayIndex, start] of labels.entries()) {
    const nextStart = labels[displayIndex + 1] ?? null;
    const paperEndIndex = questionLines.findIndex(
      (line, index) => index > start.index && /total\s+for\s+paper\s+is/i.test(line.rawText),
    );
    const nextPageBoundaryIndex =
      nextStart && nextStart.line.pageNumber > start.line.pageNumber
        ? questionLines.findIndex(
            (line, index) => index > start.index && line.pageNumber === nextStart.line.pageNumber,
          )
        : -1;
    const hasMeaningfulNextPagePrelude =
      nextPageBoundaryIndex >= 0 &&
      questionLines
        .slice(nextPageBoundaryIndex, nextStart?.index)
        .some((line) => /^\([a-z]\)/i.test(line.contentText));
    const chunkEnd =
      nextPageBoundaryIndex >= 0 && !hasMeaningfulNextPagePrelude
        ? nextPageBoundaryIndex
        : nextStart?.index ?? (paperEndIndex >= 0 ? paperEndIndex + 1 : questionLines.length);
    const questionChunk = questionLines.slice(start.index, chunkEnd);
    const visualLines = questionChunk.filter(
      (line) => line.contentText.length > 0 && !isQuestionPaperBoilerplate(line),
    );
    const markSchemeBlock = markSchemeBlocks.get(start.label);
    const maxMarks = readQuestionMarks(questionLines, start.label);

    if (!markSchemeBlock) {
      fatalErrors.push(`missing mark scheme block for ${start.label}`);
      continue;
    }

    if (maxMarks <= 0) {
      fatalErrors.push(`missing printed total marks for ${start.label}`);
      continue;
    }

    consumedMarkSchemeLabels.add(start.label);

    const pageStart = start.line.pageNumber;
    const pageEnd = visualLines.at(-1)?.pageNumber ?? pageStart;
    const nextBoundaryLine = nextStart?.line ?? null;
    const primaryLines = visualLines.filter((line) => line.pageNumber === pageStart);
    const supportingPdfBoxes: SupportingPdfBox[] = [];

    for (let pageNumber = pageStart + 1; pageNumber <= pageEnd; pageNumber += 1) {
      const pageLines = visualLines.filter((line) => line.pageNumber === pageNumber);

      if (pageLines.length === 0) {
        continue;
      }

      supportingPdfBoxes.push({
        pageNumber,
        ...buildPageBandPdfBox(pageLines, nextBoundaryLine?.pageNumber === pageNumber ? nextBoundaryLine : null),
      });
    }

    drafts.push({
      questionKey: start.label,
      displayOrder: displayIndex + 1,
      maxMarks,
      extractedQuestionText: buildQuestionText(questionChunk),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: "",
      pageStart,
      pageEnd,
      primaryPdfBox: buildPageBandPdfBox(
        primaryLines,
        nextBoundaryLine?.pageNumber === pageStart ? nextBoundaryLine : null,
      ),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: null,
        warnings: [],
      },
    });
  }

  const unconsumedMarkSchemeLabels = [...markSchemeBlocks.keys()].filter(
    (label) => !consumedMarkSchemeLabels.has(label),
  );
  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (expectedQuestionCount === undefined) {
    fatalErrors.push(`unsupported benchmark year ${year}`);
  } else if (drafts.length !== expectedQuestionCount) {
    fatalErrors.push(`expected ${expectedQuestionCount} questions but detected ${drafts.length}`);
  }

  if (unconsumedMarkSchemeLabels.length > 0) {
    fatalErrors.push(`unconsumed mark scheme blocks: ${unconsumedMarkSchemeLabels.join(", ")}`);
  }

  if (totalMarks !== EXPECTED_TOTAL_MARKS) {
    fatalErrors.push(`expected ${EXPECTED_TOTAL_MARKS} total marks but counted ${totalMarks}`);
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", "Edexcel GCSE Maths Paper 2 Higher extraction failed", {
      problems: fatalErrors,
    });
  }

  return drafts;
}

function createEdexcelGcseMathsPaper2HigherAdapter(key: string): PaperImportAdapter {
  return {
    key,
    importVersion: "2026-06-02.1",
    detectQuestionDrafts({ year, questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
      const questionLines = groupItemsIntoLines(questionItems);
      const markSchemeLines = groupItemsIntoLines(markSchemeItems);
      const { blocks, fatalErrors } = buildMarkSchemeBlocks(markSchemeLines);

      if (fatalErrors.length > 0) {
        throw new ImportFailure("adapter", "Edexcel GCSE Maths Paper 2 Higher mark scheme extraction failed", {
          problems: fatalErrors,
        });
      }

      return buildQuestionDrafts(key, year, questionLines, blocks);
    },
  };
}

export const edexcelGcseMathsPaper2HigherAdapter =
  createEdexcelGcseMathsPaper2HigherAdapter(ADAPTER_KEY);

export const edexcelGcseMathsPaper2HigherNovember2024Adapter =
  createEdexcelGcseMathsPaper2HigherAdapter(NOVEMBER_2024_ADAPTER_KEY);
