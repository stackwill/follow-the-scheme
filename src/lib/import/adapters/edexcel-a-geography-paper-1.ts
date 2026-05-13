import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const ADAPTER_KEY = "edexcel-a-geography-paper-1-physical-environment";
const QUESTION_CROP_LEFT = 35;
const QUESTION_CROP_RIGHT = 560;
const QUESTION_PAGE_TOP_LIMIT = 825;
const QUESTION_PAGE_BOTTOM_LIMIT = 60;
const QUESTION_TOP_PADDING = 24;
const QUESTION_BOTTOM_PADDING = 30;
const QUESTION_START_BOTTOM_PADDING = 10;
const MIN_BOX_HEIGHT = 90;

type Line = {
  pageNumber: number;
  y: number;
  items: TextItem[];
  rawText: string;
  contentText: string;
};

type QuestionLabel = {
  label: string;
  mainKey: string;
  parts: string[];
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
    text === "do not write in this area" ||
    text.includes("turn over") ||
    text.includes("blank page") ||
    text.includes("total marks") ||
    /^\*p\d+a\d+\*$/.test(text) ||
    /^[\s]+$/.test(line.rawText) ||
    (line.y > QUESTION_PAGE_TOP_LIMIT && /^\d+$/.test(text))
  );
}

function formatLabel(mainKey: string, parts: string[]) {
  return [mainKey, ...parts].join(".");
}

function parseMainQuestion(line: Line) {
  if (line.y < 80 || line.y > QUESTION_PAGE_TOP_LIMIT || isQuestionPaperBoilerplate(line)) {
    return null;
  }

  if ((line.items[0]?.x ?? Infinity) > 90) {
    return null;
  }

  const rawText = line.contentText || line.rawText;
  const firstParenIndex = rawText.indexOf("(");
  const text =
    /do\s*not\s*write\s*in\s*this\s*area/i.test(rawText) && firstParenIndex >= 0
      ? rawText.slice(firstParenIndex).trim()
      : rawText.trim();
  const match = text.match(/^(\d+)\s+(?!marks?\b|km\b|cm\b)([A-Z0-9].*)/);

  if (!match) {
    return null;
  }

  const questionNumber = Number(match[1]);

  if (questionNumber < 1 || questionNumber > 9) {
    return null;
  }

  return String(questionNumber).padStart(2, "0");
}

function parsePartTokens(line: Line) {
  if (line.y < 80 || line.y > QUESTION_PAGE_TOP_LIMIT || isQuestionPaperBoilerplate(line)) {
    return [];
  }

  const rawText = line.contentText || line.rawText;
  const firstParenIndex = rawText.indexOf("(");
  const marginPrefixedPartMatch = rawText.match(/(\(\s*(?:i{1,3}|iv|v|vi{0,3}|ix|x|[a-z])\s*\).*)/i);
  const text =
    /do\s*not\s*write\s*in\s*this\s*area/i.test(rawText) && marginPrefixedPartMatch
      ? marginPrefixedPartMatch[1].trim()
      : firstParenIndex >= 0
        ? rawText.slice(firstParenIndex).trim()
        : rawText.trim();
  const tokens = [...text.matchAll(/\(([^)]{1,8})\)/g)]
    .map((match) => match[1].replace(/\s+/g, "").toLowerCase())
    .filter((token) => /^(?:[a-z]|i{1,3}|iv|v|vi{0,3}|ix|x)$/.test(token));
  const firstTokenIndex = text.search(/\([^)]{1,8}\)/);

  if (firstTokenIndex > 8) {
    return [];
  }

  return tokens;
}

function buildQuestionLabels(lines: Line[]) {
  const labels: QuestionLabel[] = [];
  let currentMainKey: string | null = null;
  let currentLetterPart: string | null = null;

  lines.forEach((line, index) => {
    const mainKey = parseMainQuestion(line);

    if (mainKey) {
      currentMainKey = mainKey;
      currentLetterPart = null;
    }

    const tokens = parsePartTokens(line);

    if (!currentMainKey || tokens.length === 0) {
      return;
    }

    const firstToken = tokens[0];
    const parts: string[] = [];

    if (firstToken === "i" && currentLetterPart === "h") {
      currentLetterPart = firstToken;
      parts.push(firstToken, ...tokens.slice(1));
    } else if (/^(?:i{1,3}|iv|v|vi{0,3}|ix|x)$/.test(firstToken) && currentLetterPart) {
      parts.push(currentLetterPart, firstToken, ...tokens.slice(1));
    } else if (/^[a-z]$/.test(firstToken)) {
      currentLetterPart = firstToken;
      parts.push(firstToken);
      parts.push(...tokens.slice(1));
    } else if (currentLetterPart) {
      parts.push(currentLetterPart, firstToken, ...tokens.slice(1));
    } else {
      return;
    }

    const label = formatLabel(currentMainKey, parts);

    if (labels.some((entry) => entry.label === label)) {
      return;
    }

    labels.push({
      label,
      mainKey: currentMainKey,
      parts,
      line,
      index,
    });
  });

  return labels;
}

function parseMarkSchemeLabel(line: Line) {
  const text = line.rawText;
  const match =
    text.match(/^\s*(\d+)\s*\(([a-z])\)\s*\(([ivx]+)\)/i) ??
    text.match(/^\s*(\d+)\(([a-z])\)\s*\(([ivx]+)\)/i) ??
    text.match(/^\s*(\d+)\s*\(([a-z])\)/i) ??
    text.match(/^\s*(\d+)\(([a-z])\)/i);

  if (!match) {
    return null;
  }

  const mainKey = match[1].padStart(2, "0");
  const parts = [match[2].toLowerCase()];

  if (match[3]) {
    parts.push(match[3].toLowerCase());
  }

  return formatLabel(mainKey, parts);
}

function computeBlockMaxMarks(lines: Line[]) {
  const text = lines.map((line) => line.rawText).join("\n");
  const levelMatch = text.match(/AO\d\s*\((\d+)\s*marks?\)\s*\/\s*AO\d\s*\((\d+)\s*marks?\)/i);

  if (levelMatch) {
    return Number(levelMatch[1]) + Number(levelMatch[2]);
  }

  const parentheticalMarks = [...text.matchAll(/\((\d+)\)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value <= 12);

  return parentheticalMarks.length > 0 ? Math.max(...parentheticalMarks) : 0;
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
    const endIndex = starts[index + 1]?.index ?? lines.length;
    const blockLines = lines.slice(start.index, endIndex);
    const maxMarks = computeBlockMaxMarks(blockLines);
    const markSchemeText = blockLines
      .map((line) => line.contentText)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (maxMarks <= 0) {
      fatalErrors.push(`no positive max mark extracted for ${start.label}`);
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

function buildQuestionText(lines: Line[]) {
  return lines
    .filter((line) => !isQuestionPaperBoilerplate(line))
    .map((line) => line.contentText)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isNextQuestionPreludeLine(line: Line) {
  return [
    /\banswer\s+(?:all|only)\b/i,
    /\bwrite your answers in the spaces provided\b/i,
    /\bsome questions must be answered\b/i,
    /\bquestion\s+\d+\s*:/i,
    /\bif you answer question\s+\d+/i,
    /\bsection\s+[a-z]\b/i,
  ].some((pattern) => pattern.test(line.rawText));
}

function questionEndIndexForNextStart(questionLines: Line[], start: QuestionLabel, nextStart: QuestionLabel | null) {
  if (!nextStart) {
    const totalPaperIndex = questionLines.findIndex(
      (line, index) => index > start.index && /total\s+for\s+paper\s*=/i.test(line.rawText),
    );

    return totalPaperIndex >= 0 ? totalPaperIndex + 1 : questionLines.length;
  }

  if (nextStart.line.pageNumber <= start.line.pageNumber) {
    return nextStart.index;
  }

  const nextPagePreludeLines = questionLines
    .slice(start.index + 1, nextStart.index)
    .filter((line) => line.pageNumber === nextStart.line.pageNumber && !isQuestionPaperBoilerplate(line));

  if (nextPagePreludeLines.some(isNextQuestionPreludeLine)) {
    return questionLines.findIndex((line, index) => index > start.index && line.pageNumber === nextStart.line.pageNumber);
  }

  return nextStart.index;
}

function buildPageBandPdfBox(lines: Line[], nextQuestionStartLine: Line | null = null): QuestionPdfBox {
  const visibleItems = lines
    .flatMap((line) => line.items)
    .filter((item) => item.x >= QUESTION_CROP_LEFT && item.x <= QUESTION_CROP_RIGHT);
  const nextQuestionBottom =
    nextQuestionStartLine === null
      ? null
      : nextQuestionStartLine.y + Math.max(...nextQuestionStartLine.items.map((item) => item.height), 0) + QUESTION_START_BOTTOM_PADDING;

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

function buildQuestionDrafts(questionLines: Line[], markSchemeBlocks: Map<string, MarkSchemeBlock>) {
  const labels = buildQuestionLabels(questionLines).filter((label) => markSchemeBlocks.has(label.label));
  const drafts: QuestionDraft[] = [];
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();

  for (const [displayIndex, start] of labels.entries()) {
    const nextStart = labels[displayIndex + 1] ?? null;
    const endIndex = questionEndIndexForNextStart(questionLines, start, nextStart);
    const nextLine = nextStart?.line ?? null;
    const visualLines = questionLines
      .slice(start.index, endIndex)
      .filter((line) => line.contentText.length > 0 && !isQuestionPaperBoilerplate(line));
    const markSchemeBlock = markSchemeBlocks.get(start.label);

    if (!markSchemeBlock) {
      fatalErrors.push(`missing mark scheme block for ${start.label}`);
      continue;
    }

    consumedMarkSchemeLabels.add(start.label);

    const pageStart = visualLines[0]?.pageNumber ?? start.line.pageNumber;
    const pageEnd = visualLines.at(-1)?.pageNumber ?? pageStart;
    const primaryLines = visualLines.filter((line) => line.pageNumber === pageStart);
    const supportingPdfBoxes: SupportingPdfBox[] = [];

    for (let pageNumber = pageStart + 1; pageNumber <= pageEnd; pageNumber += 1) {
      const pageLines = visualLines.filter((line) => line.pageNumber === pageNumber);

      supportingPdfBoxes.push({
        pageNumber,
        ...buildPageBandPdfBox(pageLines, nextLine?.pageNumber === pageNumber ? nextLine : null),
      });
    }

    drafts.push({
      questionKey: start.label,
      displayOrder: displayIndex + 1,
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: buildQuestionText(questionLines.slice(start.index, endIndex)),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: "",
      pageStart,
      pageEnd,
      primaryPdfBox: buildPageBandPdfBox(primaryLines, nextLine?.pageNumber === pageStart ? nextLine : null),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey: ADAPTER_KEY,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: null,
        warnings: [],
      },
    });
  }

  const unconsumedMarkSchemeLabels = [...markSchemeBlocks.keys()].filter((label) => !consumedMarkSchemeLabels.has(label));

  if (unconsumedMarkSchemeLabels.length > 0) {
    fatalErrors.push(`unconsumed mark scheme blocks: ${unconsumedMarkSchemeLabels.join(", ")}`);
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", "Edexcel A Geography Paper 1 extraction failed", {
      problems: fatalErrors,
    });
  }

  return drafts;
}

export const edexcelAGeographyPaper1Adapter: PaperImportAdapter = {
  key: ADAPTER_KEY,
  importVersion: "2026-05-12.1",
  detectQuestionDrafts({ questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
    const questionLines = groupItemsIntoLines(questionItems);
    const markSchemeLines = groupItemsIntoLines(markSchemeItems);
    const { blocks, fatalErrors } = buildMarkSchemeBlocks(markSchemeLines);

    if (fatalErrors.length > 0) {
      throw new ImportFailure("adapter", "Edexcel A Geography mark scheme extraction failed", {
        problems: fatalErrors,
      });
    }

    return buildQuestionDrafts(questionLines, blocks);
  },
};
