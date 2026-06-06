import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const PAPER_2_ADAPTER_KEY = "edexcel-gcse-history-paper-2-cold-war-elizabeth";
const PAPER_3_ADAPTER_KEY = "edexcel-gcse-history-paper-3-germany";
const CROP_LEFT = 35;
const CROP_RIGHT = 565;
const PAGE_TOP_LIMIT = 812;
const PAGE_BOTTOM_LIMIT = 58;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 28;
const QUESTION_START_BOTTOM_PADDING = 8;
const MIN_BOX_HEIGHT = 82;

const PAPER_2_MARKS = new Map([
  ["p4.1", 8],
  ["p4.2", 8],
  ["p4.3", 16],
  ["b4.1.a", 4],
  ["b4.1.b", 12],
  ["b4.1.c.i", 16],
  ["b4.1.c.ii", 16],
]);

const PAPER_3_MARKS = new Map([
  ["1", 4],
  ["2", 12],
  ["3.a", 8],
  ["3.b", 4],
  ["3.c", 4],
  ["3.d", 20],
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
        contentText: buildLineText(sortedLineItems, CROP_LEFT, CROP_RIGHT),
      };
    })
    .filter((line) => line.rawText.length > 0);
}

function isBoilerplate(line: Line) {
  const text = line.rawText.toLowerCase();

  return (
    text === "pmt" ||
    text === "outside the" ||
    text === "box" ||
    text.includes("do not write") ||
    text.includes("turn over") ||
    text.includes("blank page") ||
    text.includes("answer in the spaces provided") ||
    text.includes("please check the examination details") ||
    text.includes("centre number") ||
    text.includes("candidate number") ||
    text.includes("candidate surname") ||
    text.includes("total marks") ||
    text.includes("end of questions") ||
    /^p\d+[a-z]*$/i.test(text) ||
    /^\*p[0-9a-z]+\*/i.test(text) ||
    /^f:/.test(text) ||
    /^\d+$/.test(text) ||
    /^[\u25a0\uF0A2\s]+$/.test(line.rawText)
  );
}

function buildQuestionText(lines: Line[], sourceLines: Line[] = []) {
  const questionText = lines
    .filter((line) => !isBoilerplate(line))
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
    .filter((item) => item.x >= CROP_LEFT && item.x <= CROP_RIGHT);
  const nextQuestionBottom =
    nextQuestionStartLine === null
      ? null
      : nextQuestionStartLine.y +
        Math.max(...nextQuestionStartLine.items.map((item) => item.height), 0) +
        QUESTION_START_BOTTOM_PADDING;

  if (visibleItems.length === 0) {
    const bottom = nextQuestionBottom ?? PAGE_BOTTOM_LIMIT;

    return {
      left: CROP_LEFT,
      right: CROP_RIGHT,
      top: Math.min(PAGE_TOP_LIMIT, bottom + MIN_BOX_HEIGHT),
      bottom,
    };
  }

  const top = Math.min(PAGE_TOP_LIMIT, Math.max(...visibleItems.map((item) => item.y + item.height)) + TOP_PADDING);
  const contentBottom = Math.min(...visibleItems.map((item) => item.y)) - BOTTOM_PADDING;
  const bottom = Math.max(
    PAGE_BOTTOM_LIMIT,
    Math.min(nextQuestionBottom ?? contentBottom, top - MIN_BOX_HEIGHT),
  );

  return {
    left: CROP_LEFT,
    right: CROP_RIGHT,
    top,
    bottom,
  };
}

function fullPageBox(pageNumber: number): SupportingPdfBox {
  return {
    pageNumber,
    left: CROP_LEFT,
    right: CROP_RIGHT,
    top: PAGE_TOP_LIMIT,
    bottom: PAGE_BOTTOM_LIMIT,
  };
}

function paperEndIndex(lines: Line[]) {
  const endIndex = lines.findIndex((line) =>
    /^(end of questions|source a taken from|acknowledgements)/i.test(line.contentText),
  );

  return endIndex >= 0 ? endIndex : lines.length;
}

function buildMarkSchemeBlocks(
  lines: Line[],
  starts: Array<{ label: string; index: number }>,
  marksByLabel: Map<string, number>,
) {
  const blocks = new Map<string, MarkSchemeBlock>();
  const fatalErrors: string[] = [];

  for (const [index, start] of starts.entries()) {
    const nextStart = starts[index + 1];
    const maxMarks = marksByLabel.get(start.label) ?? 0;
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

function linesInBox(lines: Line[], box: SupportingPdfBox) {
  return lines.filter(
    (line) =>
      line.pageNumber === box.pageNumber &&
      line.y <= box.top &&
      line.y >= box.bottom &&
      line.contentText.length > 0,
  );
}

function makeDrafts(input: {
  adapterKey: string;
  questionLines: Line[];
  labels: QuestionLabel[];
  markSchemeBlocks: Map<string, MarkSchemeBlock>;
  expectedQuestionCount: number;
  expectedTotalMarks: number;
  supportingBoxesForLabel: (label: string) => SupportingPdfBox[];
  notesForLabel: (label: string) => string;
}) {
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();
  const drafts: QuestionDraft[] = [];
  const endIndex = paperEndIndex(input.questionLines);

  for (const [displayIndex, start] of input.labels.entries()) {
    const markSchemeBlock = input.markSchemeBlocks.get(start.label);
    const nextStart = input.labels[displayIndex + 1] ?? null;
    const nextBoundaryIndex = nextStart?.index ?? endIndex;
    const nextBoundaryLine = nextStart ? input.questionLines[nextBoundaryIndex] : null;
    const questionChunk = input.questionLines.slice(start.index, nextBoundaryIndex);
    const visualLines = questionChunk.filter(
      (line) => line.contentText.length > 0 && !isBoilerplate(line),
    );
    const supportingPdfBoxes = input.supportingBoxesForLabel(start.label);
    const sourceLines = supportingPdfBoxes.flatMap((box) => linesInBox(input.questionLines, box));

    if (!markSchemeBlock) {
      fatalErrors.push(`missing mark scheme block for ${start.label}`);
      continue;
    }

    consumedMarkSchemeLabels.add(start.label);

    const pageStart = visualLines[0]?.pageNumber ?? start.line.pageNumber;
    const visualPageEnd = visualLines.at(-1)?.pageNumber ?? pageStart;
    const pageEnd = Math.max(visualPageEnd, ...supportingPdfBoxes.map((box) => box.pageNumber));
    const primaryLines = visualLines.filter((line) => line.pageNumber === pageStart);
    const continuationBoxes: SupportingPdfBox[] = [];

    for (let pageNumber = pageStart + 1; pageNumber <= visualPageEnd; pageNumber += 1) {
      const pageLines = visualLines.filter((line) => line.pageNumber === pageNumber);

      continuationBoxes.push({
        pageNumber,
        ...buildPageBandPdfBox(pageLines, nextBoundaryLine?.pageNumber === pageNumber ? nextBoundaryLine : null),
      });
    }

    drafts.push({
      questionKey: start.label,
      displayOrder: displayIndex + 1,
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: buildQuestionText(questionChunk, sourceLines),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: input.notesForLabel(start.label),
      pageStart,
      pageEnd,
      primaryPdfBox: buildPageBandPdfBox(
        primaryLines,
        nextBoundaryLine?.pageNumber === pageStart ? nextBoundaryLine : null,
      ),
      supportingPdfBoxes: [...continuationBoxes, ...supportingPdfBoxes],
      importDiagnostics: {
        adapterKey: input.adapterKey,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: null,
        warnings:
          start.label === "b4.1.c.i" || start.label === "b4.1.c.ii"
            ? [
                {
                  stage: "adapter",
                  message:
                    "Official Paper 2 Booklet B4 asks candidates to answer either Question 1(c)(i) or 1(c)(ii); importer exposes both for practice.",
                },
              ]
            : [],
      },
    });
  }

  const unconsumedMarkSchemeLabels = [...input.markSchemeBlocks.keys()].filter(
    (label) => !consumedMarkSchemeLabels.has(label),
  );
  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (unconsumedMarkSchemeLabels.length > 0) {
    fatalErrors.push(`unconsumed mark scheme blocks: ${unconsumedMarkSchemeLabels.join(", ")}`);
  }

  if (drafts.length !== input.expectedQuestionCount) {
    fatalErrors.push(`expected ${input.expectedQuestionCount} questions but detected ${drafts.length}`);
  }

  if (totalMarks !== input.expectedTotalMarks) {
    fatalErrors.push(`expected ${input.expectedTotalMarks} total marks but counted ${totalMarks}`);
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", `${input.adapterKey} extraction failed`, {
      problems: fatalErrors,
    });
  }

  return drafts;
}

function parsePaper2QuestionLabel(line: Line, seenB4CLabels: number) {
  if (line.y < 70 || line.y > PAGE_TOP_LIMIT || isBoilerplate(line)) {
    return null;
  }

  const text = line.contentText || line.rawText;

  if (/^1\s+Explain two consequences/i.test(text)) {
    return "p4.1";
  }

  if (/^2\s+Write a narrative account/i.test(text)) {
    return "p4.2";
  }

  if (/^3\s+(?:Explain the importance|Explain two of the following)/i.test(text)) {
    return "p4.3";
  }

  if (/^1\s*\(a\)\s*Describe two features/i.test(text)) {
    return "b4.1.a";
  }

  if (/^\(b\)\s*Explain why/i.test(text)) {
    return "b4.1.b";
  }

  if (/^\(c\)\s*\(i\)/i.test(text)) {
    return "b4.1.c.i";
  }

  if (/^\(c\)\s*\(ii\)/i.test(text)) {
    return "b4.1.c.ii";
  }

  if (/^\(c\)\s*[`'"‘’]/i.test(text)) {
    return seenB4CLabels === 0 ? "b4.1.c.i" : "b4.1.c.ii";
  }

  return null;
}

function findPaper2QuestionLabels(questionLines: Line[]) {
  const labels: QuestionLabel[] = [];
  let seenB4CLabels = 0;

  for (const [index, line] of questionLines.entries()) {
    const label = parsePaper2QuestionLabel(line, seenB4CLabels);

    if (!label || labels.some((entry) => entry.label === label)) {
      continue;
    }

    if (label.startsWith("b4.1.c.")) {
      seenB4CLabels += 1;
    }

    labels.push({ label, line, index });
  }

  return labels;
}

function findPaper2MarkSchemeStarts(markSchemeLines: Line[]) {
  const starts: Array<{ label: string; index: number }> = [];

  for (const [index, line] of markSchemeLines.entries()) {
    if (!/^Question$/i.test(line.contentText)) {
      continue;
    }

    const nextText = markSchemeLines[index + 1]?.contentText ?? "";
    const pageNumber = line.pageNumber;
    let label: string | null = null;

    if (pageNumber <= 9) {
      if (/^1\b/.test(nextText)) label = "p4.1";
      if (/^2\b/.test(nextText)) label = "p4.2";
      if (/^3\b/.test(nextText)) label = "p4.3";
    } else {
      if (/^1\s*\(a\)/i.test(nextText)) label = "b4.1.a";
      if (/^1\s*\(b\)/i.test(nextText)) label = "b4.1.b";
      if (/^1\s*\(c\)\s*\(i\)/i.test(nextText)) label = "b4.1.c.i";
      if (/^1\s*\(c\)\s*\(ii\)/i.test(nextText)) label = "b4.1.c.ii";
    }

    if (label) {
      starts.push({ label, index });
    }
  }

  return starts;
}

function paper2SupportingBoxes(label: string): SupportingPdfBox[] {
  if (label === "p4.3") {
    return [fullPageBox(7), fullPageBox(8), fullPageBox(9)];
  }

  return [];
}

function buildPaper2Drafts(input: DetectQuestionDraftsInput) {
  const questionLines = groupItemsIntoLines(input.questionItems);
  const markSchemeLines = groupItemsIntoLines(input.markSchemeItems);
  const { blocks, fatalErrors } = buildMarkSchemeBlocks(
    markSchemeLines,
    findPaper2MarkSchemeStarts(markSchemeLines),
    PAPER_2_MARKS,
  );

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", "Edexcel GCSE History Paper 2 mark scheme extraction failed", {
      problems: fatalErrors,
    });
  }

  return makeDrafts({
    adapterKey: PAPER_2_ADAPTER_KEY,
    questionLines,
    labels: findPaper2QuestionLabels(questionLines),
    markSchemeBlocks: blocks,
    expectedQuestionCount: 7,
    expectedTotalMarks: 80,
    supportingBoxesForLabel: paper2SupportingBoxes,
    notesForLabel: (label) =>
      label === "b4.1.c.i" || label === "b4.1.c.ii"
        ? "Official booklet B4 asks candidates to answer one of the two 1(c) questions. Both optional questions are imported as answerable questions for practice."
        : "",
  });
}

function parsePaper3QuestionLabel(line: Line) {
  if (line.y < 70 || line.y > PAGE_TOP_LIMIT || isBoilerplate(line)) {
    return null;
  }

  const text = line.contentText || line.rawText;

  if (/^1\s+Give two things/i.test(text)) return "1";
  if (/^2\s+Explain why/i.test(text)) return "2";
  if (/^3\s*\(a\)\s*Study Sources/i.test(text)) return "3.a";
  if (/^\(b\)\s*Study Interpretations/i.test(text)) return "3.b";
  if (/^\(c\)\s*Suggest one reason/i.test(text)) return "3.c";
  if (/^\(d\)\s*How far/i.test(text)) return "3.d";

  return null;
}

function findPaper3QuestionLabels(questionLines: Line[]) {
  const labels: QuestionLabel[] = [];

  for (const [index, line] of questionLines.entries()) {
    const label = parsePaper3QuestionLabel(line);

    if (!label || labels.some((entry) => entry.label === label)) {
      continue;
    }

    labels.push({ label, line, index });
  }

  return labels;
}

function findPaper3MarkSchemeStarts(markSchemeLines: Line[]) {
  const starts: Array<{ label: string; index: number }> = [];

  for (const [index, line] of markSchemeLines.entries()) {
    if (!/^Question$/i.test(line.contentText)) {
      continue;
    }

    const nextText = markSchemeLines[index + 1]?.contentText ?? "";
    let label: string | null = null;

    if (/^1\b/.test(nextText)) label = "1";
    if (/^2\b/.test(nextText)) label = "2";
    if (/^3\s*\(a\)/i.test(nextText)) label = "3.a";
    if (/^3\s*\(b\)/i.test(nextText)) label = "3.b";
    if (/^3\s*\(c\)/i.test(nextText)) label = "3.c";
    if (/^3\s*\(d\)/i.test(nextText)) label = "3.d";

    if (label) {
      starts.push({ label, index });
    }
  }

  return starts;
}

function paper3SupportingBoxes(label: string): SupportingPdfBox[] {
  if (label === "1") {
    return [fullPageBox(2)];
  }

  if (label.startsWith("3.")) {
    return [fullPageBox(18), fullPageBox(19)];
  }

  return [];
}

function buildPaper3Drafts(input: DetectQuestionDraftsInput) {
  const questionLines = groupItemsIntoLines(input.questionItems);
  const markSchemeLines = groupItemsIntoLines(input.markSchemeItems);
  const { blocks, fatalErrors } = buildMarkSchemeBlocks(
    markSchemeLines,
    findPaper3MarkSchemeStarts(markSchemeLines),
    PAPER_3_MARKS,
  );

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", "Edexcel GCSE History Paper 3 mark scheme extraction failed", {
      problems: fatalErrors,
    });
  }

  return makeDrafts({
    adapterKey: PAPER_3_ADAPTER_KEY,
    questionLines,
    labels: findPaper3QuestionLabels(questionLines),
    markSchemeBlocks: blocks,
    expectedQuestionCount: 6,
    expectedTotalMarks: 52,
    supportingBoxesForLabel: paper3SupportingBoxes,
    notesForLabel: (label) =>
      label === "3.d"
        ? "Maximum includes 16 content marks plus 4 SPaG marks."
        : "",
  });
}

export const edexcelGcseHistoryPaper2ColdWarElizabethAdapter: PaperImportAdapter = {
  key: PAPER_2_ADAPTER_KEY,
  importVersion: "2026-06-03.1",
  detectQuestionDrafts(input) {
    return buildPaper2Drafts(input);
  },
};

export const edexcelGcseHistoryPaper3GermanyAdapter: PaperImportAdapter = {
  key: PAPER_3_ADAPTER_KEY,
  importVersion: "2026-06-03.1",
  detectQuestionDrafts(input) {
    return buildPaper3Drafts(input);
  },
};
