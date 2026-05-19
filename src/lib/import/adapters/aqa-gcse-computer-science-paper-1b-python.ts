import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const QUESTION_CROP_LEFT = 35;
const QUESTION_CROP_RIGHT = 535;
const QUESTION_PAGE_TOP_LIMIT = 790;
const QUESTION_PAGE_BOTTOM_LIMIT = 70;
const QUESTION_START_BOTTOM_PADDING = 8;
const QUESTION_TOP_PADDING = 14;
const QUESTION_BOTTOM_PADDING = 28;
const MIN_BOX_HEIGHT = 88;
const MARK_COLUMN_MIN_X = 500;
const MARK_COLUMN_MAX_X = 560;
const EXPECTED_TOTAL_MARKS = 90;
const MARK_RANGE_PATTERN = /^(\d+)[-\u2010-\u2015](\d+)$/;

type ComputerScienceAdapterOptions = {
  key: string;
  importVersion: string;
  paperCodePattern: RegExp;
  failureLabel: string;
};

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
  partKey: string | null;
  line: Line;
  index: number;
};

type MarkSchemeBlock = {
  label: string;
  maxMarks: number;
  markSchemeText: string;
};

type QuestionDraftStart = QuestionLabel & {
  textStartIndex: number;
  visualStartIndex: number;
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
  const sortedItems = [...items].sort((left, right) => left.pageNumber - right.pageNumber || right.y - left.y || left.x - right.x);

  for (const item of sortedItems) {
    const previousLine = lines.at(-1);

    if (previousLine && previousLine.pageNumber === item.pageNumber && Math.abs(previousLine.y - item.y) <= 2) {
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

function formatQuestionLabel(mainKey: string, partKey: string | null) {
  return partKey ? `${mainKey}.${partKey}` : mainKey;
}

function parseQuestionLabel(line: Line) {
  if (line.y < 80 || line.y > QUESTION_PAGE_TOP_LIMIT) {
    return null;
  }

  const labelItems = line.items.filter((item) => item.x >= 45 && item.x <= 105 && /^[\d.]$/.test(item.text.trim()));
  const firstItem = labelItems[0];

  if (!firstItem || firstItem.x > 62) {
    return null;
  }

  const digits = labelItems.map((item) => item.text.trim()).filter((text) => /^\d$/.test(text));
  const hasDot = labelItems.some((item) => item.text.trim() === ".");

  if (digits.length < 2 || digits.length > 3) {
    return null;
  }

  const mainKey = `${digits[0]}${digits[1]}`.padStart(2, "0");
  const partKey = (hasDot || digits.length === 3) && digits[2] ? digits[2] : null;

  return {
    label: formatQuestionLabel(mainKey, partKey),
    mainKey,
    partKey,
  };
}

function parseMarkSchemeLabel(line: Line) {
  if (line.y < 70 || line.y > QUESTION_PAGE_TOP_LIMIT) {
    return null;
  }

  const questionItem = line.items.find((item) => item.x >= 40 && item.x <= 90 && /^\d{2}$/.test(item.text.trim()));

  if (!questionItem) {
    return null;
  }

  const partItem = line.items.find(
    (item) => item.x > questionItem.x && item.x <= 135 && /^\d+$/.test(item.text.trim()),
  );
  const mainKey = questionItem.text.trim();
  const partKey = partItem?.text.trim() ?? null;

  return formatQuestionLabel(mainKey, partKey);
}

function computeLineMaxMarks(line: Line) {
  const marks: number[] = [];

  for (const item of line.items) {
    if (item.x < MARK_COLUMN_MIN_X || item.x > MARK_COLUMN_MAX_X) {
      continue;
    }

    const text = item.text.replace(/\s+/g, "");
    const rangeMatch = text.match(MARK_RANGE_PATTERN);

    if (rangeMatch) {
      marks.push(Number(rangeMatch[2]));
      continue;
    }

    if (/^\d+$/.test(text)) {
      marks.push(Number(text));
    }
  }

  return marks.length > 0 ? Math.max(...marks) : 0;
}

function buildMarkSchemeBlocks(lines: Line[]) {
  const blockStarts = lines
    .map((line, index) => {
      const label = parseMarkSchemeLabel(line);

      return label ? { label, index } : null;
    })
    .filter((entry): entry is { label: string; index: number } => entry !== null);
  const blocks = new Map<string, MarkSchemeBlock>();
  const fatalErrors: string[] = [];

  for (const [index, blockStart] of blockStarts.entries()) {
    const nextStart = blockStarts[index + 1];
    const blockLines = lines.slice(blockStart.index, nextStart?.index ?? lines.length);
    const maxMarks = computeLineMaxMarks(lines[blockStart.index]);
    const markSchemeText = blockLines.map((line) => line.contentText).filter(Boolean).join("\n");

    if (maxMarks <= 0) {
      fatalErrors.push(`no positive max mark extracted for ${blockStart.label}`);
    }

    if (blocks.has(blockStart.label)) {
      fatalErrors.push(`duplicate mark scheme block for ${blockStart.label}`);
    }

    blocks.set(blockStart.label, {
      label: blockStart.label,
      maxMarks,
      markSchemeText,
    });
  }

  return {
    blocks,
    fatalErrors,
  };
}

function isQuestionPaperBoilerplate(line: Line, paperCodePattern: RegExp) {
  const text = line.rawText.toLowerCase();

  return (
    text === "pmt" ||
    text.includes("do not write outside") ||
    text.includes("question ") && text.includes("continues on the next page") ||
    text.includes("turn over") ||
    text.includes("answer in the spaces provided") ||
    text.includes("do not write on this page") ||
    /^\*\s*\d+\s*\*$/.test(text) ||
    paperCodePattern.test(line.rawText) ||
    ((line.y > QUESTION_PAGE_TOP_LIMIT || line.y < QUESTION_PAGE_BOTTOM_LIMIT) && /^\d+$/.test(line.rawText))
  );
}

function buildQuestionText(lines: Line[], paperCodePattern: RegExp) {
  return lines
    .filter((line) => !isQuestionPaperBoilerplate(line, paperCodePattern))
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
    nextQuestionStartLine === null ? null : nextQuestionStartLine.y + Math.max(...nextQuestionStartLine.items.map((item) => item.height), 0) + QUESTION_START_BOTTOM_PADDING;

  if (visibleItems.length === 0) {
    const bottom = Math.max(QUESTION_PAGE_BOTTOM_LIMIT, nextQuestionBottom ?? QUESTION_PAGE_BOTTOM_LIMIT);

    return {
      left: QUESTION_CROP_LEFT,
      right: QUESTION_CROP_RIGHT,
      top: Math.min(QUESTION_PAGE_TOP_LIMIT, bottom + MIN_BOX_HEIGHT),
      bottom,
    };
  }

  const maxY = Math.max(...visibleItems.map((item) => item.y + item.height));
  const minY = Math.min(...visibleItems.map((item) => item.y));
  const hasAnswerGridInstruction = lines.some((line) => /answer grid below/i.test(line.rawText));
  const hasLabelAnswerLines = lines.some((line) =>
    /should be written in place of the labels|will not need to use all the items/i.test(line.rawText),
  );
  const hasVisualAnswerArea = lines.some((line) =>
    /figure \d+ has been included again below|complete the logic circuit|logic gate in each empty box/i.test(
      line.rawText,
    ),
  );
  const top = Math.min(QUESTION_PAGE_TOP_LIMIT, maxY + QUESTION_TOP_PADDING);
  const bottom = Math.max(
    QUESTION_PAGE_BOTTOM_LIMIT,
    Math.min(
      nextQuestionBottom ??
        (hasAnswerGridInstruction || hasLabelAnswerLines || hasVisualAnswerArea
          ? QUESTION_PAGE_BOTTOM_LIMIT
          : minY - QUESTION_BOTTOM_PADDING),
      top - MIN_BOX_HEIGHT,
    ),
  );

  return {
    left: QUESTION_CROP_LEFT,
    right: QUESTION_CROP_RIGHT,
    top,
    bottom,
  };
}

function findPreLabelContextStartIndex(
  questionLines: Line[],
  start: QuestionLabel,
  previousLabel: QuestionLabel | null,
  paperCodePattern: RegExp,
) {
  if (!previousLabel || start.partKey === null || previousLabel.mainKey !== start.mainKey) {
    return start.index;
  }

  if (previousLabel.line.pageNumber === start.line.pageNumber) {
    return start.index;
  }

  const samePagePreludeLines = questionLines
    .slice(previousLabel.index + 1, start.index)
    .filter(
      (line) =>
        line.pageNumber === start.line.pageNumber &&
        line.y > start.line.y &&
        line.contentText.length > 0 &&
        !isQuestionPaperBoilerplate(line, paperCodePattern),
    );

  return samePagePreludeLines[0]
    ? questionLines.indexOf(samePagePreludeLines[0])
    : start.index;
}

function buildDraftStarts(
  labels: QuestionLabel[],
  questionLines: Line[],
  paperCodePattern: RegExp,
) {
  const rawDraftStarts = labels.filter((label, index) => {
    if (label.partKey !== null) {
      return true;
    }

    const nextLabel = labels[index + 1];

    return nextLabel?.mainKey !== label.mainKey || nextLabel.partKey === null;
  });

  return rawDraftStarts.map((start, index) => {
    const previousLabel = [...labels]
      .reverse()
      .find((label) => label.index < start.index) ?? null;
    const previousMainContext = [...labels]
      .reverse()
      .find((label) => label.mainKey === start.mainKey && label.partKey === null && label.index < start.index);
    const previousDraftSameMain = rawDraftStarts
      .slice(0, index)
      .some((draftStart) => draftStart.mainKey === start.mainKey);
    const preLabelContextStartIndex = findPreLabelContextStartIndex(
      questionLines,
      start,
      previousLabel,
      paperCodePattern,
    );
    const shouldIncludeMainContext = start.partKey && previousMainContext && !previousDraftSameMain;
    const textStartIndex = shouldIncludeMainContext ? previousMainContext.index : preLabelContextStartIndex;
    const visualStartIndex = shouldIncludeMainContext ? previousMainContext.index : preLabelContextStartIndex;

    return {
      ...start,
      textStartIndex,
      visualStartIndex,
    } satisfies QuestionDraftStart;
  });
}

function buildQuestionDrafts(
  questionLines: Line[],
  markSchemeBlocks: Map<string, MarkSchemeBlock>,
  options: ComputerScienceAdapterOptions,
) {
  const labels = questionLines
    .map((line, index) => {
      const label = parseQuestionLabel(line);

      return label ? { ...label, line, index } : null;
    })
    .filter((entry): entry is QuestionLabel => entry !== null);
  const draftStarts = buildDraftStarts(labels, questionLines, options.paperCodePattern);
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();
  const drafts: QuestionDraft[] = [];

  for (const [displayIndex, start] of draftStarts.entries()) {
    const nextDraftStart = draftStarts[displayIndex + 1] ?? null;
    const nextBoundaryIndex = nextDraftStart?.visualStartIndex ?? questionLines.length;
    const nextBoundaryLine = nextDraftStart ? questionLines[nextDraftStart.visualStartIndex] : null;
    const previousMainContext = [...labels]
      .reverse()
      .find((label) => label.mainKey === start.mainKey && label.partKey === null && label.index < start.index);
    const textLines = questionLines.slice(start.textStartIndex, nextBoundaryIndex);
    const visualLines = questionLines
      .slice(start.visualStartIndex, nextBoundaryIndex)
      .filter(
        (line) =>
          line.contentText.length > 0 &&
          !isQuestionPaperBoilerplate(line, options.paperCodePattern),
      );
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
    const hasAnswerGridInstruction = visualLines.some((line) => /answer grid below/i.test(line.rawText));
    const blankAnswerGridPageEnd =
      hasAnswerGridInstruction && nextBoundaryLine && nextBoundaryLine.pageNumber > pageEnd + 1
        ? nextBoundaryLine.pageNumber - 1
        : pageEnd;

    for (let pageNumber = pageStart + 1; pageNumber <= blankAnswerGridPageEnd; pageNumber += 1) {
      const pageLines = visualLines.filter((line) => line.pageNumber === pageNumber);

      supportingPdfBoxes.push({
        pageNumber,
        ...(pageLines.length > 0
          ? buildPageBandPdfBox(pageLines, nextBoundaryLine?.pageNumber === pageNumber ? nextBoundaryLine : null)
          : {
              left: QUESTION_CROP_LEFT,
              right: QUESTION_CROP_RIGHT,
              top: QUESTION_PAGE_TOP_LIMIT,
              bottom: QUESTION_PAGE_BOTTOM_LIMIT,
            }),
      });
    }

    drafts.push({
      questionKey: start.label,
      displayOrder: displayIndex + 1,
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: buildQuestionText(textLines, options.paperCodePattern),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: "",
      pageStart,
      pageEnd: blankAnswerGridPageEnd,
      primaryPdfBox: buildPageBandPdfBox(primaryLines, nextBoundaryLine?.pageNumber === pageStart ? nextBoundaryLine : null),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey: options.key,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: previousMainContext?.label ?? null,
        warnings: [],
      },
    });
  }

  const unconsumedMarkSchemeLabels = [...markSchemeBlocks.keys()].filter((label) => !consumedMarkSchemeLabels.has(label));

  if (unconsumedMarkSchemeLabels.length > 0) {
    fatalErrors.push(`unconsumed mark scheme blocks: ${unconsumedMarkSchemeLabels.join(", ")}`);
  }

  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (totalMarks !== EXPECTED_TOTAL_MARKS) {
    fatalErrors.push(`expected ${EXPECTED_TOTAL_MARKS} total marks but counted ${totalMarks}`);
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", `${options.failureLabel} extraction failed`, {
      problems: fatalErrors,
    });
  }

  return drafts;
}

function createAqaGcseComputerScienceAdapter(
  options: ComputerScienceAdapterOptions,
): PaperImportAdapter {
  return {
    key: options.key,
    importVersion: options.importVersion,
    detectQuestionDrafts({ questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
      const questionLines = groupItemsIntoLines(questionItems);
      const markSchemeLines = groupItemsIntoLines(markSchemeItems);
      const { blocks, fatalErrors } = buildMarkSchemeBlocks(markSchemeLines);

      if (fatalErrors.length > 0) {
        throw new ImportFailure("adapter", "AQA GCSE Computer Science mark scheme extraction failed", {
          problems: fatalErrors,
        });
      }

      return buildQuestionDrafts(questionLines, blocks, options);
    },
  };
}

export const aqaGcseComputerSciencePaper1BPythonAdapter =
  createAqaGcseComputerScienceAdapter({
    key: "aqa-gcse-computer-science-paper-1b-python",
    importVersion: "2026-05-12.1",
    paperCodePattern: /^ib\/g\/jun\d+\/8525\/1b$/i,
    failureLabel: "AQA GCSE Computer Science Paper 1B",
  });

export const aqaGcseComputerSciencePaper2Adapter = createAqaGcseComputerScienceAdapter({
  key: "aqa-gcse-computer-science-paper-2",
  importVersion: "2026-05-17.1",
  paperCodePattern: /^ib\/g\/jun\d+\/8525\/2$/i,
  failureLabel: "AQA GCSE Computer Science Paper 2",
});
