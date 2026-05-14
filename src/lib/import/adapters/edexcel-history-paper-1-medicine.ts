import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const ADAPTER_KEY = "edexcel-gcse-history-paper-1-medicine";
const QUESTION_CROP_LEFT = 35;
const QUESTION_CROP_RIGHT = 565;
const QUESTION_PAGE_TOP_LIMIT = 810;
const QUESTION_PAGE_BOTTOM_LIMIT = 58;
const QUESTION_TOP_PADDING = 16;
const QUESTION_BOTTOM_PADDING = 28;
const QUESTION_START_BOTTOM_PADDING = 8;
const MIN_BOX_HEIGHT = 82;
const EXPECTED_TOTAL_MARKS_WITH_BOTH_OPTIONALS = 72;
const EXPECTED_QUESTION_COUNT = 7;

const MAX_MARKS_BY_LABEL = new Map([
  ["1", 4],
  ["2.a", 8],
  ["2.b", 4],
  ["3", 4],
  ["4", 12],
  ["5", 20],
  ["6", 20],
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
  maxMarks: number;
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
    text === "outside the" ||
    text === "box" ||
    text.includes("do not write") ||
    text.includes("turn over") ||
    text.includes("blank page") ||
    text.includes("answer in the spaces provided") ||
    text.includes("indicate which question you are answering") ||
    text.includes("chosen question number") ||
    text.includes("end of questions") ||
    text.includes("centre number") ||
    text.includes("candidate number") ||
    text.includes("candidate surname") ||
    text.includes("for examiner") ||
    /^p\d+[a-z]*$/i.test(text) ||
    /^\*p[0-9a-z]+\*\s*[\s]*$/.test(text) ||
    /^f:/.test(text) ||
    /^\d+$/.test(text) ||
    /^[\s]+$/.test(line.rawText)
  );
}

function parseQuestionLabel(line: Line, currentMainQuestion: string | null) {
  if (line.y < 70 || line.y > QUESTION_PAGE_TOP_LIMIT || isQuestionPaperBoilerplate(line)) {
    return null;
  }

  const text = line.contentText || line.rawText;
  const numberedPartMatch = text.match(/^2\s*\(([ab])\)/i);

  if (numberedPartMatch) {
    return `2.${numberedPartMatch[1].toLowerCase()}`;
  }

  const numberedMatch = text.match(/^([1-6])\s+(?:Describe|Explain|[‘'])/);

  if (numberedMatch) {
    return numberedMatch[1];
  }

  const partMatch = text.match(/^\(([ab])\)/i);

  if (partMatch && currentMainQuestion === "2") {
    return `2.${partMatch[1].toLowerCase()}`;
  }

  return null;
}

function findQuestionLabels(questionLines: Line[]) {
  const labels: QuestionLabel[] = [];
  let currentMainQuestion: string | null = null;

  for (const [index, line] of questionLines.entries()) {
    const label = parseQuestionLabel(line, currentMainQuestion);

    if (!label) {
      continue;
    }

    currentMainQuestion = label.split(".")[0];

    if (!MAX_MARKS_BY_LABEL.has(label) || labels.some((entry) => entry.label === label)) {
      continue;
    }

    labels.push({
      label,
      line,
      index,
    });
  }

  return labels;
}

function parseMarkSchemeLabel(line: Line) {
  if (line.pageNumber < 5 || line.y < 55 || line.y > QUESTION_PAGE_TOP_LIMIT) {
    return null;
  }

  const text = line.rawText;
  const partMatch = text.match(/^2\s*\(([ab])\)/i);

  if (partMatch) {
    return `2.${partMatch[1].toLowerCase()}`;
  }

  const numberedMatch = text.match(/^([1-6])\s+(?:Describe|Explain|[‘'])/);

  if (!numberedMatch) {
    return null;
  }

  const label = numberedMatch[1];

  return MAX_MARKS_BY_LABEL.has(label) ? label : null;
}

function buildMarkSchemeBlocks(lines: Line[]) {
  const starts = lines
    .map((line, index) => {
      const label = parseMarkSchemeLabel(line);
      return label ? { label, index } : null;
    })
    .filter((entry): entry is { label: string; index: number } => entry !== null);
  const blocks = new Map<string, MarkSchemeBlock>();
  const fatalErrors: string[] = [];

  for (const [index, start] of starts.entries()) {
    const nextStart = starts[index + 1];
    const maxMarks = MAX_MARKS_BY_LABEL.get(start.label) ?? 0;
    const blockLines = lines.slice(start.index, nextStart?.index ?? lines.length);
    const markSchemeText = blockLines
      .map((line) => line.contentText)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (maxMarks <= 0) {
      fatalErrors.push(`no positive max mark configured for ${start.label}`);
    }

    if (blocks.has(start.label)) {
      fatalErrors.push(`duplicate mark scheme block for ${start.label}`);
    }

    blocks.set(start.label, {
      label: start.label,
      maxMarks,
      markSchemeText,
    });
  }

  return { blocks, fatalErrors };
}

function sourceLinesForLabel(questionLines: Line[], label: string) {
  if (label !== "2.a" && label !== "2.b") {
    return [];
  }

  return questionLines.filter((line) => {
    if (line.pageNumber !== 18) {
      return false;
    }

    if (label === "2.b") {
      return line.y <= 790 && line.y >= 620;
    }

    return line.y <= 815 && line.y >= 350;
  });
}

function buildQuestionText(lines: Line[], sourceLines: Line[]) {
  const questionText = lines
    .filter((line) => !isQuestionPaperBoilerplate(line))
    .map((line) => line.contentText)
    .filter(Boolean)
    .join("\n")
    .trim();
  const sourceText = sourceLines
    .map((line) => line.contentText)
    .filter(Boolean)
    .join("\n")
    .trim();

  return [questionText, sourceText].filter(Boolean).join("\n\n");
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

  const top = Math.min(QUESTION_PAGE_TOP_LIMIT, Math.max(...visibleItems.map((item) => item.y + item.height)) + QUESTION_TOP_PADDING);
  const contentBottom = Math.min(...visibleItems.map((item) => item.y)) - QUESTION_BOTTOM_PADDING;
  const bottom = Math.max(
    QUESTION_PAGE_BOTTOM_LIMIT,
    Math.min(nextQuestionBottom ?? contentBottom, top - MIN_BOX_HEIGHT),
  );

  return {
    left: QUESTION_CROP_LEFT,
    right: QUESTION_CROP_RIGHT,
    top,
    bottom,
  };
}

function buildSourcePdfBox(label: string): SupportingPdfBox | null {
  if (label === "2.a") {
    return {
      pageNumber: 18,
      left: QUESTION_CROP_LEFT,
      right: QUESTION_CROP_RIGHT,
      top: 815,
      bottom: 350,
    };
  }

  if (label === "2.b") {
    return {
      pageNumber: 18,
      left: QUESTION_CROP_LEFT,
      right: QUESTION_CROP_RIGHT,
      top: 795,
      bottom: 620,
    };
  }

  return null;
}

function findPaperEndIndex(questionLines: Line[]) {
  const endIndex = questionLines.findIndex((line) => /^(end of questions|sources for use with section a)/i.test(line.contentText));

  return endIndex >= 0 ? endIndex : questionLines.length;
}

function optionalQuestionEndIndex(questionLines: Line[], start: QuestionLabel, nextStart: QuestionLabel | null) {
  if (nextStart && nextStart.line.pageNumber === start.line.pageNumber) {
    return nextStart.index;
  }

  const nextPageIndex = questionLines.findIndex(
    (line, index) => index > start.index && line.pageNumber > start.line.pageNumber,
  );

  return nextPageIndex >= 0 ? nextPageIndex : questionLines.length;
}

function buildQuestionDrafts(questionLines: Line[], markSchemeBlocks: Map<string, MarkSchemeBlock>) {
  const labels = findQuestionLabels(questionLines).filter((label) => markSchemeBlocks.has(label.label));
  const paperEndIndex = findPaperEndIndex(questionLines);
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();
  const drafts: QuestionDraft[] = [];

  for (const [displayIndex, start] of labels.entries()) {
    const markSchemeBlock = markSchemeBlocks.get(start.label);
    const nextStart = labels[displayIndex + 1] ?? null;
    const nextPageBoundaryIndex =
      nextStart && nextStart.line.pageNumber > start.line.pageNumber
        ? questionLines.findIndex((line, index) => index > start.index && line.pageNumber === nextStart.line.pageNumber)
        : -1;
    const nextBoundaryIndex =
      start.label === "5" || start.label === "6"
        ? optionalQuestionEndIndex(questionLines, start, nextStart)
        : nextPageBoundaryIndex >= 0
          ? nextPageBoundaryIndex
          : nextStart?.index ?? paperEndIndex;
    const nextBoundaryLine = nextStart ? questionLines[nextBoundaryIndex] : null;
    const questionChunk = questionLines.slice(start.index, nextBoundaryIndex);
    const visualLines = questionChunk.filter(
      (line) => line.contentText.length > 0 && !isQuestionPaperBoilerplate(line),
    );
    const sourceLines = sourceLinesForLabel(questionLines, start.label);
    const sourcePdfBox = buildSourcePdfBox(start.label);

    if (!markSchemeBlock) {
      fatalErrors.push(`missing mark scheme block for ${start.label}`);
      continue;
    }

    consumedMarkSchemeLabels.add(start.label);

    const pageStart = visualLines[0]?.pageNumber ?? start.line.pageNumber;
    const visualPageEnd = visualLines.at(-1)?.pageNumber ?? pageStart;
    const pageEnd = Math.max(visualPageEnd, sourcePdfBox?.pageNumber ?? visualPageEnd);
    const primaryLines = visualLines.filter((line) => line.pageNumber === pageStart);
    const supportingPdfBoxes: SupportingPdfBox[] = [];

    for (let pageNumber = pageStart + 1; pageNumber <= visualPageEnd; pageNumber += 1) {
      const pageLines = visualLines.filter((line) => line.pageNumber === pageNumber);

      supportingPdfBoxes.push({
        pageNumber,
        ...buildPageBandPdfBox(pageLines, nextBoundaryLine?.pageNumber === pageNumber ? nextBoundaryLine : null),
      });
    }

    if (sourcePdfBox) {
      supportingPdfBoxes.push(sourcePdfBox);
    }

    drafts.push({
      questionKey: start.label,
      displayOrder: displayIndex + 1,
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: buildQuestionText(questionChunk, sourceLines),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes:
        start.label === "5" || start.label === "6"
          ? "Maximum includes 16 content marks plus 4 SPaG marks. Both optional questions are imported as answerable questions for practice."
          : "",
      pageStart,
      pageEnd,
      primaryPdfBox: buildPageBandPdfBox(
        primaryLines,
        nextBoundaryLine?.pageNumber === pageStart ? nextBoundaryLine : null,
      ),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey: ADAPTER_KEY,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: null,
        warnings:
          start.label === "5" || start.label === "6"
            ? [
                {
                  stage: "adapter",
                  message:
                    "Official paper asks candidates to answer either Question 5 or Question 6; importer exposes both for practice.",
                },
              ]
            : [],
      },
    });
  }

  const unconsumedMarkSchemeLabels = [...markSchemeBlocks.keys()].filter((label) => !consumedMarkSchemeLabels.has(label));
  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (unconsumedMarkSchemeLabels.length > 0) {
    fatalErrors.push(`unconsumed mark scheme blocks: ${unconsumedMarkSchemeLabels.join(", ")}`);
  }

  if (drafts.length !== EXPECTED_QUESTION_COUNT) {
    fatalErrors.push(`expected ${EXPECTED_QUESTION_COUNT} questions but detected ${drafts.length}`);
  }

  if (totalMarks !== EXPECTED_TOTAL_MARKS_WITH_BOTH_OPTIONALS) {
    fatalErrors.push(
      `expected ${EXPECTED_TOTAL_MARKS_WITH_BOTH_OPTIONALS} total marks with both optional questions but counted ${totalMarks}`,
    );
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", "Edexcel GCSE History Paper 1 Medicine extraction failed", {
      problems: fatalErrors,
    });
  }

  return drafts;
}

export const edexcelGcseHistoryPaper1MedicineAdapter: PaperImportAdapter = {
  key: ADAPTER_KEY,
  importVersion: "2026-05-14.1",
  detectQuestionDrafts({ questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
    const questionLines = groupItemsIntoLines(questionItems);
    const markSchemeLines = groupItemsIntoLines(markSchemeItems);
    const { blocks, fatalErrors } = buildMarkSchemeBlocks(markSchemeLines);

    if (fatalErrors.length > 0) {
      throw new ImportFailure("adapter", "Edexcel GCSE History Paper 1 Medicine mark scheme extraction failed", {
        problems: fatalErrors,
      });
    }

    return buildQuestionDrafts(questionLines, blocks);
  },
};
