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
const QUESTION_PAGE_TOP_LIMIT = 805;
const QUESTION_PAGE_BOTTOM_LIMIT = 58;
const QUESTION_TOP_PADDING = 14;
const QUESTION_START_BOTTOM_PADDING = 8;
const MIN_BOX_HEIGHT = 72;

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

type ReligiousStudiesShortCourseConfig = {
  key: string;
  title: string;
  expectedQuestionCount: number;
  expectedTotalMarks: number;
  includeSpagOnEvaluation: boolean;
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

function parseQuestionLabel(text: string) {
  const match = text.match(/^0\s*([12])\s*\.\s*([1-5])\b/);

  return match ? `0${match[1]}.${match[2]}` : null;
}

function findQuestionLabels(questionLines: Line[]) {
  const labels: QuestionLabel[] = [];

  for (const [index, line] of questionLines.entries()) {
    if (line.y < 70 || line.y > QUESTION_PAGE_TOP_LIMIT) {
      continue;
    }

    if (!line.items.some((item) => item.x >= 45 && item.x <= 70)) {
      continue;
    }

    const label = parseQuestionLabel(line.contentText);

    if (!label || labels.some((entry) => entry.label === label)) {
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

function maxMarksForLabel(label: string, includeSpagOnEvaluation: boolean) {
  const part = label.split(".")[1];

  if (part === "1") {
    return 1;
  }

  if (part === "2") {
    return 2;
  }

  if (part === "3") {
    return 4;
  }

  if (part === "4") {
    return 5;
  }

  if (part === "5") {
    return includeSpagOnEvaluation ? 15 : 12;
  }

  return 0;
}

function isMarkSchemeStart(line: Line) {
  if (line.y < 55 || line.y > QUESTION_PAGE_TOP_LIMIT) {
    return null;
  }

  if (!line.items.some((item) => item.x >= 35 && item.x <= 75)) {
    return null;
  }

  return parseQuestionLabel(line.contentText);
}

function buildMarkSchemeBlocks(lines: Line[], includeSpagOnEvaluation: boolean) {
  const starts = lines
    .map((line, index) => {
      const label = isMarkSchemeStart(line);

      return label ? { label, index } : null;
    })
    .filter((entry): entry is { label: string; index: number } => entry !== null);
  const blocks = new Map<string, MarkSchemeBlock>();
  const fatalErrors: string[] = [];

  for (const [index, start] of starts.entries()) {
    const nextStart = starts[index + 1];
    const maxMarks = maxMarksForLabel(start.label, includeSpagOnEvaluation);
    const blockLines = lines.slice(start.index, nextStart?.index ?? lines.length);
    const markSchemeText = blockLines.map((line) => line.contentText).filter(Boolean).join("\n").trim();

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

function isQuestionPaperBoilerplate(line: Line) {
  const text = line.rawText.toLowerCase();

  return (
    text === "pmt" ||
    text === "outside the" ||
    text === "box" ||
    text.includes("do not write") ||
    text.includes("turn over") ||
    /^question\s+\d+\s+continues\s+on\s+the\s+next\s+page$/i.test(line.rawText) ||
    text.includes("there are no questions printed on this page") ||
    text.includes("do not write on this page") ||
    text.includes("answer in the spaces provided") ||
    text.includes("additional page, if required") ||
    text.includes("end of questions") ||
    text.includes("centre number") ||
    text.includes("candidate number") ||
    text.includes("surname") ||
    text.includes("forename") ||
    text.includes("candidate signature") ||
    text.includes("i declare this is my own work") ||
    text.includes("for examiner") ||
    /^\*\s*\d+\s*\*$/.test(text.replace(/\s+/g, "")) ||
    /^\*jun\d+\*$/.test(text) ||
    /^ib\/[a-z]\/jun\d+\/8061\//.test(text) ||
    /^\d+$/.test(text)
  );
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

  const maxY = Math.max(...visibleItems.map((item) => item.y + item.height));
  const top = Math.min(QUESTION_PAGE_TOP_LIMIT, maxY + QUESTION_TOP_PADDING);
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
  config: ReligiousStudiesShortCourseConfig,
  questionLines: Line[],
  markSchemeBlocks: Map<string, MarkSchemeBlock>,
) {
  const labels = findQuestionLabels(questionLines);
  const answerableStarts = labels.filter((label) => markSchemeBlocks.has(label.label));
  const paperEndIndex = questionLines.findIndex((line) => /^(end of questions|question\s+additional page)/i.test(line.contentText));
  const fatalErrors: string[] = [];
  const consumedMarkSchemeLabels = new Set<string>();
  const drafts: QuestionDraft[] = [];

  for (const [displayIndex, start] of answerableStarts.entries()) {
    const markSchemeBlock = markSchemeBlocks.get(start.label);
    const nextStart = answerableStarts[displayIndex + 1] ?? null;
    const nextPageBoundaryIndex =
      nextStart && nextStart.line.pageNumber > start.line.pageNumber
        ? questionLines.findIndex(
            (line, index) => index > start.index && line.pageNumber === nextStart.line.pageNumber,
          )
        : -1;
    const nextBoundaryIndex =
      nextPageBoundaryIndex >= 0
        ? nextPageBoundaryIndex
        : nextStart?.index ?? (paperEndIndex >= 0 ? paperEndIndex : questionLines.length);
    const nextBoundaryLine = nextStart ? questionLines[nextBoundaryIndex] : null;
    const questionChunk = questionLines.slice(start.index, nextBoundaryIndex);
    const visualLines = questionChunk.filter(
      (line) => line.contentText.length > 0 && !isQuestionPaperBoilerplate(line),
    );

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
        supportingPdfBoxes.push({
          pageNumber,
          left: QUESTION_CROP_LEFT,
          right: QUESTION_CROP_RIGHT,
          top: QUESTION_PAGE_TOP_LIMIT,
          bottom: QUESTION_PAGE_BOTTOM_LIMIT,
        });
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
      extractedQuestionText: buildQuestionText(questionChunk),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes:
        config.includeSpagOnEvaluation && start.label.endsWith(".5")
          ? "Maximum includes 12 content marks plus 3 SPaG marks."
          : "",
      pageStart,
      pageEnd,
      primaryPdfBox: buildPageBandPdfBox(
        primaryLines,
        nextBoundaryLine?.pageNumber === pageStart ? nextBoundaryLine : null,
      ),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey: config.key,
        sourceQuestionLabel: start.label,
        sourceMarkSchemeLabel: start.label,
        contextQuestionLabel: null,
        warnings: [],
      },
    });
  }

  const unconsumedMarkSchemeLabels = [...markSchemeBlocks.keys()].filter((label) => !consumedMarkSchemeLabels.has(label));
  const totalMarks = drafts.reduce((sum, draft) => sum + draft.maxMarks, 0);

  if (unconsumedMarkSchemeLabels.length > 0) {
    fatalErrors.push(`unconsumed mark scheme blocks: ${unconsumedMarkSchemeLabels.join(", ")}`);
  }

  if (drafts.length !== config.expectedQuestionCount) {
    fatalErrors.push(`expected ${config.expectedQuestionCount} questions but detected ${drafts.length}`);
  }

  if (totalMarks !== config.expectedTotalMarks) {
    fatalErrors.push(`expected ${config.expectedTotalMarks} total marks but counted ${totalMarks}`);
  }

  if (fatalErrors.length > 0) {
    throw new ImportFailure("adapter", `${config.title} extraction failed`, {
      problems: fatalErrors,
    });
  }

  return drafts;
}

function createAqaReligiousStudiesShortCourseAdapter(
  config: ReligiousStudiesShortCourseConfig,
): PaperImportAdapter {
  return {
    key: config.key,
    importVersion: "2026-05-19.1",
    detectQuestionDrafts({ questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
      const questionLines = groupItemsIntoLines(questionItems);
      const markSchemeLines = groupItemsIntoLines(markSchemeItems);
      const { blocks, fatalErrors } = buildMarkSchemeBlocks(
        markSchemeLines,
        config.includeSpagOnEvaluation,
      );

      if (fatalErrors.length > 0) {
        throw new ImportFailure("adapter", `${config.title} mark scheme extraction failed`, {
          problems: fatalErrors,
        });
      }

      return buildQuestionDrafts(config, questionLines, blocks);
    },
  };
}

export const aqaGcseReligiousStudiesShortCourseChristianityAdapter =
  createAqaReligiousStudiesShortCourseAdapter({
    key: "aqa-gcse-religious-studies-short-course-christianity",
    title: "AQA GCSE Religious Studies Short Course Christianity",
    expectedQuestionCount: 5,
    expectedTotalMarks: 27,
    includeSpagOnEvaluation: true,
  });

export const aqaGcseReligiousStudiesShortCourseJudaismAdapter =
  createAqaReligiousStudiesShortCourseAdapter({
    key: "aqa-gcse-religious-studies-short-course-judaism",
    title: "AQA GCSE Religious Studies Short Course Judaism",
    expectedQuestionCount: 5,
    expectedTotalMarks: 27,
    includeSpagOnEvaluation: true,
  });

export const aqaGcseReligiousStudiesShortCourseThemesAdapter =
  createAqaReligiousStudiesShortCourseAdapter({
    key: "aqa-gcse-religious-studies-short-course-themes",
    title: "AQA GCSE Religious Studies Short Course Themes",
    expectedQuestionCount: 10,
    expectedTotalMarks: 48,
    includeSpagOnEvaluation: false,
  });
