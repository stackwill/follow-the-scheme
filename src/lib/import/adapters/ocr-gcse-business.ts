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
const QUESTION_CROP_RIGHT = 565;
const QUESTION_PAGE_TOP_LIMIT = 790;
const QUESTION_PAGE_BOTTOM_LIMIT = 58;
const QUESTION_TOP_PADDING = 12;
const QUESTION_BOTTOM_PADDING = 24;
const QUESTION_START_BOTTOM_PADDING = 8;
const MIN_BOX_HEIGHT = 72;
const EXPECTED_TOTAL_MARKS = 80;
const SECTION_A_QUESTION_COUNT = 15;

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
  romanKey: string | null;
  line: Line;
  index: number;
};

type MarkSchemeBlock = {
  label: string;
  maxMarks: number;
  markSchemeText: string;
};

type BusinessPaperConfig = {
  key: string;
  component: "01" | "02";
  expectedQuestionCount: number;
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

function normalizeRoman(value: string) {
  return value.toLowerCase();
}

function formatQuestionLabel(mainKey: string, partKey: string | null, romanKey: string | null) {
  return [mainKey, partKey, romanKey].filter(Boolean).join(".");
}

function parseQuestionPaperLabel(line: Line, state: { mainKey: string | null; partKey: string | null }) {
  if (line.y < 70 || line.y > QUESTION_PAGE_TOP_LIMIT) {
    return null;
  }

  const text = line.contentText;
  const sectionAMatch = text.match(/^(\d{1,2})\b/);

  if (sectionAMatch && line.items.some((item) => item.x >= 45 && item.x <= 65)) {
    const questionNumber = Number(sectionAMatch[1]);

    if (questionNumber >= 1 && questionNumber <= 18) {
      const mainKey = String(questionNumber);
      state.mainKey = mainKey;
      state.partKey = null;

      return {
        label: mainKey,
        mainKey,
        partKey: null,
        romanKey: null,
      };
    }
  }

  const partMatch = text.match(/^\(([a-e])\*?\)\*?(?=\s|$)/);

  if (partMatch && state.mainKey) {
    const partKey = partMatch[1];

    state.partKey = partKey;

    return {
      label: formatQuestionLabel(state.mainKey, partKey, null),
      mainKey: state.mainKey,
      partKey,
      romanKey: null,
    };
  }

  const romanMatch = text.match(/^\((i{1,3})\)(?=\s|$)/);

  if (romanMatch && state.mainKey && state.partKey) {
    const romanKey = normalizeRoman(romanMatch[1]);

    return {
      label: formatQuestionLabel(state.mainKey, state.partKey, romanKey),
      mainKey: state.mainKey,
      partKey: state.partKey,
      romanKey,
    };
  }

  return null;
}

function parseSectionAMarkSchemeLine(line: Line) {
  const match = line.contentText.match(/^(\d{1,2})\s+([A-D])\s+1\b/);

  if (!match) {
    return null;
  }

  const questionNumber = Number(match[1]);

  if (questionNumber < 1 || questionNumber > SECTION_A_QUESTION_COUNT) {
    return null;
  }

  return {
    label: String(questionNumber),
    answer: match[2],
  };
}

function readMarksFromStartLine(text: string) {
  const match = text.match(/\s(\d+)\s+(?:One mark|Use marking|Two marks|Three marks|For each|Advantage|AO1|AO2|AO3|Guidance)\b/);

  return match ? Number(match[1]) : 0;
}

function parseMarkSchemeStart(
  line: Line,
  state: { mainKey: string | null; partKey: string | null },
) {
  const text = line.contentText.replace(/\s+\*\s+/g, "* ");

  if (/^Question\s+Answer\s+Marks?\s+Guidance\b/.test(text) || /^SECTION B\b/.test(text)) {
    return null;
  }

  const explicitMainMatch = text.match(/^(\d{2})\s+(?:\(([a-e])\)|([a-e]))\*?(?:\s*\((i{1,3})\))?(?=\s|$)/);

  if (explicitMainMatch) {
    const maxMarks = readMarksFromStartLine(text);
    const mainKey = explicitMainMatch[1];
    const partKey = explicitMainMatch[2] ?? explicitMainMatch[3] ?? null;
    const romanKey = explicitMainMatch[4] ? normalizeRoman(explicitMainMatch[4]) : null;

    if (!partKey || maxMarks <= 0) {
      return null;
    }

    state.mainKey = mainKey;
    state.partKey = partKey;

    return {
      label: formatQuestionLabel(mainKey, partKey, romanKey),
      maxMarks,
    };
  }

  const partWithRomanMatch = text.match(/^([a-e])\s*\((i{1,3})\)(?=\s|$)/);

  if (partWithRomanMatch && state.mainKey) {
    const maxMarks = readMarksFromStartLine(text);

    if (maxMarks <= 0) {
      return null;
    }

    const partKey = partWithRomanMatch[1];
    const romanKey = normalizeRoman(partWithRomanMatch[2]);

    state.partKey = partKey;

    return {
      label: formatQuestionLabel(state.mainKey, partKey, romanKey),
      maxMarks,
    };
  }

  const partMatch = text.match(/^([a-e])\*?(?=\s)/);

  if (partMatch && state.mainKey) {
    const maxMarks = readMarksFromStartLine(text);

    if (maxMarks <= 0) {
      return null;
    }

    const partKey = partMatch[1];

    state.partKey = partKey;

    return {
      label: formatQuestionLabel(state.mainKey, partKey, null),
      maxMarks,
    };
  }

  const romanMatch = text.match(/^\((i{1,3})\)(?=\s|$)/);

  if (romanMatch && state.mainKey && state.partKey) {
    const maxMarks = readMarksFromStartLine(text);

    if (maxMarks <= 0) {
      return null;
    }

    const romanKey = normalizeRoman(romanMatch[1]);

    return {
      label: formatQuestionLabel(state.mainKey, state.partKey, romanKey),
      maxMarks,
    };
  }

  return null;
}

function buildMarkSchemeBlocks(lines: Line[]) {
  const blocks = new Map<string, MarkSchemeBlock>();
  const fatalErrors: string[] = [];
  const sectionBStarts: Array<{ label: string; maxMarks: number; index: number }> = [];
  const state = { mainKey: null as string | null, partKey: null as string | null };

  for (const line of lines) {
    const sectionAEntry = parseSectionAMarkSchemeLine(line);

    if (!sectionAEntry) {
      continue;
    }

    blocks.set(sectionAEntry.label, {
      label: sectionAEntry.label,
      maxMarks: 1,
      markSchemeText: sectionAEntry.answer,
    });
  }

  for (const [index, line] of lines.entries()) {
    const start = parseMarkSchemeStart(line, state);

    if (!start || start.maxMarks <= 0) {
      continue;
    }

    sectionBStarts.push({ ...start, index });
  }

  for (const [index, start] of sectionBStarts.entries()) {
    const nextStart = sectionBStarts[index + 1];
    const blockLines = lines.slice(start.index, nextStart?.index ?? lines.length);
    const markSchemeText = blockLines.map((line) => line.contentText).filter(Boolean).join("\n");

    if (start.maxMarks <= 0) {
      fatalErrors.push(`no positive max mark extracted for ${start.label}`);
    }

    if (blocks.has(start.label)) {
      fatalErrors.push(`duplicate mark scheme block for ${start.label}`);
    }

    blocks.set(start.label, {
      label: start.label,
      maxMarks: start.maxMarks,
      markSchemeText,
    });
  }

  return {
    blocks,
    fatalErrors,
  };
}

function isQuestionPaperBoilerplate(line: Line) {
  const text = line.rawText.toLowerCase();

  return (
    text === "pmt" ||
    text.includes("do not write outside") ||
    text.includes("turn over") ||
    text.includes("please do not write on this page") ||
    text === "blank page" ||
    text === "section a" ||
    text === "section b" ||
    text.includes("extra answer space") ||
    text.includes("end of question paper") ||
    text.includes("copyright information") ||
    text.includes("oxford cambridge and rsa") ||
    /^©\s*ocr\s*2024/i.test(line.rawText) ||
    /^\*\s*j\s*2\s*0\s*4\s*0\s*[12]\s*\*$/i.test(line.rawText) ||
    /^\*\s*\d(?:\s*\d)+\s*\*$/.test(line.rawText) ||
    /^\d+$/.test(line.rawText)
  );
}

function buildQuestionText(lines: Line[], contextLines: Line[]) {
  const joinedLines = [...contextLines, ...lines];
  const seen = new Set<string>();

  return joinedLines
    .filter((line) => !isQuestionPaperBoilerplate(line))
    .map((line) => line.contentText)
    .filter(Boolean)
    .filter((text) => {
      if (seen.has(text)) {
        return false;
      }

      seen.add(text);
      return true;
    })
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

  const maxY = Math.max(...visibleItems.map((item) => item.y + item.height));
  const minY = Math.min(...visibleItems.map((item) => item.y));
  const top = Math.min(QUESTION_PAGE_TOP_LIMIT, maxY + QUESTION_TOP_PADDING);
  const bottom = Math.max(
    QUESTION_PAGE_BOTTOM_LIMIT,
    Math.min(nextQuestionBottom ?? minY - QUESTION_BOTTOM_PADDING, top - MIN_BOX_HEIGHT),
  );

  return {
    left: QUESTION_CROP_LEFT,
    right: QUESTION_CROP_RIGHT,
    top,
    bottom,
  };
}

function findQuestionLabels(questionLines: Line[]) {
  const labels: QuestionLabel[] = [];
  const state = { mainKey: null as string | null, partKey: null as string | null };

  for (const [index, line] of questionLines.entries()) {
    const parsed = parseQuestionPaperLabel(line, state);

    if (!parsed) {
      continue;
    }

    labels.push({
      ...parsed,
      line,
      index,
    });
  }

  return labels;
}

function getMainContextLines(questionLines: Line[], labels: QuestionLabel[], mainKey: string) {
  const mainLabel = labels.find((label) => label.mainKey === mainKey && label.partKey === null);
  const firstAnswerableLabel = labels.find((label) => label.mainKey === mainKey && label.partKey !== null);

  if (!mainLabel || !firstAnswerableLabel) {
    return [];
  }

  return questionLines
    .slice(mainLabel.index, firstAnswerableLabel.index)
    .filter((line) => !isQuestionPaperBoilerplate(line));
}

function getContextStartIndex(
  labels: QuestionLabel[],
  start: QuestionLabel,
  previousAnswerableStart: QuestionLabel | null,
) {
  const candidateIndexes: number[] = [start.index];

  if (!previousAnswerableStart || previousAnswerableStart.mainKey !== start.mainKey) {
    const mainContext = [...labels]
      .reverse()
      .find((label) => label.mainKey === start.mainKey && label.partKey === null && label.index < start.index);

    if (mainContext) {
      candidateIndexes.push(mainContext.index);
    }
  }

  if (
    start.romanKey &&
    (!previousAnswerableStart ||
      previousAnswerableStart.mainKey !== start.mainKey ||
      previousAnswerableStart.partKey !== start.partKey)
  ) {
    const partContext = [...labels]
      .reverse()
      .find(
        (label) =>
          label.mainKey === start.mainKey &&
          label.partKey === start.partKey &&
          label.romanKey === null &&
          label.index < start.index,
      );

    if (partContext) {
      candidateIndexes.push(partContext.index);
    }
  }

  return Math.min(...candidateIndexes);
}

function buildQuestionDrafts(
  config: BusinessPaperConfig,
  questionLines: Line[],
  markSchemeBlocks: Map<string, MarkSchemeBlock>,
) {
  const labels = findQuestionLabels(questionLines);
  const answerableStarts = labels.filter((label) => markSchemeBlocks.has(label.label));
  const paperEndIndex = questionLines.findIndex((line) =>
    /^(end of question paper|extra answer space)$/i.test(line.contentText),
  );
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();
  const drafts: QuestionDraft[] = [];

  for (const [displayIndex, start] of answerableStarts.entries()) {
    const markSchemeBlock = markSchemeBlocks.get(start.label);
    const previousAnswerableStart = answerableStarts[displayIndex - 1] ?? null;
    const nextAnswerableStart = answerableStarts[displayIndex + 1] ?? null;
    const contextStartIndex = getContextStartIndex(labels, start, previousAnswerableStart);
    const nextBoundaryIndex = nextAnswerableStart
      ? getContextStartIndex(labels, nextAnswerableStart, start)
      : paperEndIndex >= 0
        ? paperEndIndex
        : questionLines.length;
    const nextBoundaryLine = nextAnswerableStart ? questionLines[nextBoundaryIndex] : null;
    const textLines = questionLines.slice(contextStartIndex, nextBoundaryIndex);
    const visualLines = questionLines
      .slice(contextStartIndex, nextBoundaryIndex)
      .filter((line) => line.contentText.length > 0 && !isQuestionPaperBoilerplate(line));
    const contextLines =
      Number(start.mainKey) > SECTION_A_QUESTION_COUNT
        ? getMainContextLines(questionLines, labels, start.mainKey)
        : [];

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
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: buildQuestionText(textLines, contextLines),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: "",
      pageStart,
      pageEnd,
      primaryPdfBox: buildPageBandPdfBox(primaryLines, nextBoundaryLine?.pageNumber === pageStart ? nextBoundaryLine : null),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey: config.key,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: contextLines[0]?.contentText ?? null,
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

  if (drafts.length !== config.expectedQuestionCount) {
    fatalErrors.push(`expected ${config.expectedQuestionCount} questions but detected ${drafts.length}`);
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", `OCR GCSE Business ${config.component} extraction failed`, {
      problems: fatalErrors,
    });
  }

  return drafts;
}

function createOcrGcseBusinessAdapter(config: BusinessPaperConfig): PaperImportAdapter {
  return {
    key: config.key,
    importVersion: "2026-05-07.1",
    detectQuestionDrafts({ questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
      const questionLines = groupItemsIntoLines(questionItems);
      const markSchemeLines = groupItemsIntoLines(markSchemeItems);
      const { blocks, fatalErrors } = buildMarkSchemeBlocks(markSchemeLines);

      if (fatalErrors.length > 0) {
        throw new ImportFailure("adapter", `OCR GCSE Business ${config.component} mark scheme extraction failed`, {
          problems: fatalErrors,
        });
      }

      return buildQuestionDrafts(config, questionLines, blocks);
    },
  };
}

export const ocrGcseBusinessPaper1Adapter = createOcrGcseBusinessAdapter({
  key: "ocr-gcse-business-paper-1",
  component: "01",
  expectedQuestionCount: 31,
});

export const ocrGcseBusinessPaper2Adapter = createOcrGcseBusinessAdapter({
  key: "ocr-gcse-business-paper-2",
  component: "02",
  expectedQuestionCount: 36,
});
