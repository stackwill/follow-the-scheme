import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
} from "@/lib/import/adapters/base";
import type { ImportWarning } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const QUESTION_LINE_Y_TOLERANCE = 2.5;
const MARK_SCHEME_START_PAGE = 7;
const LEFT_MARGIN_MIN_X = 50;
const LEFT_MARGIN_MAX_X = 60;
const NUMBERING_MAX_X = 105;
const QUESTION_CONTENT_MIN_X = 110;
const QUESTION_CONTENT_MAX_X = 490;
const QUESTION_CROP_MAX_X = 535;
const MARK_SCHEME_CONTENT_MIN_X = 100;
const MARK_SCHEME_CONTENT_MAX_X = 450;
const MARK_COLUMN_MIN_X = 440;
const MARK_COLUMN_MAX_X = 480;
const MIN_BOX_WIDTH = 280;
const MIN_BOX_HEIGHT = 120;
const BOX_PADDING_X = 18;
const BOX_PADDING_Y = 18;

type Line = {
  pageNumber: number;
  y: number;
  items: TextItem[];
  rawText: string;
  contentText: string;
  minX: number;
  maxX: number;
};

type QuestionLabel = {
  label: string;
  mainKey: string;
  subKey: number | null;
};

type QuestionStart = {
  lineIndex: number;
  line: Line;
  label: QuestionLabel;
  kind: "main" | "sub";
};

type MarkSchemeBlock = {
  label: string;
  mainKey: string;
  lines: Line[];
  markSchemeText: string;
  maxMarks: number;
  notes: string[];
  warnings: string[];
};

function normalizeWhitespace(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([([{"'])\s+/g, "$1")
    .trim();
}

function buildLineText(items: TextItem[], minX = Number.NEGATIVE_INFINITY, maxX = Number.POSITIVE_INFINITY) {
  return normalizeWhitespace(
    items
      .filter((item) => item.x >= minX && item.x < maxX)
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(""),
  );
}

function groupItemsIntoLines(items: TextItem[], tolerance = QUESTION_LINE_Y_TOLERANCE) {
  const linesByPage = new Map<number, Array<{ y: number; items: TextItem[] }>>();

  for (const item of items) {
    const pageLines = linesByPage.get(item.pageNumber) ?? [];
    const existing = pageLines.find((line) => Math.abs(line.y - item.y) <= tolerance);

    if (existing) {
      existing.items.push(item);
      existing.y = (existing.y * (existing.items.length - 1) + item.y) / existing.items.length;
    } else {
      pageLines.push({
        y: item.y,
        items: [item],
      });
    }

    linesByPage.set(item.pageNumber, pageLines);
  }

  return [...linesByPage.entries()]
    .sort(([leftPage], [rightPage]) => leftPage - rightPage)
    .flatMap(([pageNumber, pageLines]) =>
      pageLines
        .map((line) => {
          const sortedItems = line.items.sort((left, right) => left.x - right.x);
          const xs = sortedItems.map((item) => item.x);

          return {
            pageNumber,
            y: line.y,
            items: sortedItems,
            rawText: buildLineText(sortedItems),
            contentText: buildLineText(sortedItems, QUESTION_CONTENT_MIN_X, QUESTION_CONTENT_MAX_X),
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
          } satisfies Line;
        })
        .sort((left, right) => right.y - left.y),
    );
}

function isQuestionPaperBoilerplate(line: Line) {
  if (line.y < 120) {
    return true;
  }

  const text = line.rawText.toLowerCase();

  if (!text) {
    return true;
  }

  return (
    text.includes("do not write") ||
    text.includes("outside the box") ||
    text.includes("turn over") ||
    text.includes("question ") && text.includes("continues on the next page") ||
    text.includes("copyright") ||
    text.includes("answer in the spaces provided") ||
    text.includes("there are no questions printed on this page") ||
    text.includes("physics paper 1h") ||
    text.includes("the maximum mark for this paper") ||
    text.includes("jun23") ||
    text.includes("jun24") ||
    /^thursday \d+/.test(text)
  );
}

function parseQuestionLabel(line: Line) {
  if (line.minX < LEFT_MARGIN_MIN_X || line.minX > LEFT_MARGIN_MAX_X) {
    return null;
  }

  const numbering = line.items
    .filter((item) => item.x <= NUMBERING_MAX_X)
    .map((item) => item.text)
    .join("")
    .replace(/\s+/g, "")
    .replace(/[^0-9.]/g, "");

  if (/^\d{2}$/.test(numbering)) {
    return {
      label: numbering,
      mainKey: numbering,
      subKey: null,
    } satisfies QuestionLabel;
  }

  if (/^\d{2}\.\d+$/.test(numbering)) {
    const [mainKey, subKey] = numbering.split(".");

    return {
      label: numbering,
      mainKey,
      subKey: Number(subKey),
    } satisfies QuestionLabel;
  }

  if (/^\d{3,4}$/.test(numbering)) {
    const mainKey = numbering.slice(0, 2);
    const subKey = Number(numbering.slice(2));

    return {
      label: `${mainKey}.${subKey}`,
      mainKey,
      subKey,
    } satisfies QuestionLabel;
  }

  return null;
}

function compareQuestionLabels(left: QuestionLabel, right: QuestionLabel) {
  const leftMain = Number(left.mainKey);
  const rightMain = Number(right.mainKey);

  if (leftMain !== rightMain) {
    return leftMain - rightMain;
  }

  if (left.subKey === null && right.subKey === null) {
    return 0;
  }

  if (left.subKey === null) {
    return -1;
  }

  if (right.subKey === null) {
    return 1;
  }

  return left.subKey - right.subKey;
}

function getQuestionStarts(lines: Line[]) {
  const starts: QuestionStart[] = [];
  let previousAccepted: QuestionLabel | null = null;
  const warningsByLabel = new Map<string, ImportWarning[]>();

  function pushWarning(label: string, message: string) {
    const warnings = warningsByLabel.get(label) ?? [];
    warnings.push({
      stage: "adapter",
      message,
    });
    warningsByLabel.set(label, warnings);
  }

  lines.forEach((line, lineIndex) => {
    if (isQuestionPaperBoilerplate(line)) {
      return;
    }

    const label = parseQuestionLabel(line);

    if (!label) {
      return;
    }

    if (previousAccepted && compareQuestionLabels(label, previousAccepted) <= 0) {
      pushWarning(label.label, `ignored out-of-order question label ${label.label}`);
      return;
    }

    if (previousAccepted && label.mainKey === previousAccepted.mainKey) {
      if (label.subKey !== null && previousAccepted.subKey !== null && label.subKey !== previousAccepted.subKey + 1) {
        pushWarning(
          label.label,
          `subquestion numbering jumped from ${previousAccepted.label} to ${label.label}`,
        );
      }
    } else if (previousAccepted && Number(label.mainKey) > Number(previousAccepted.mainKey) + 1) {
      pushWarning(
        label.label,
        `main question numbering jumped from ${previousAccepted.mainKey} to ${label.mainKey}`,
      );
    }

    starts.push({
      lineIndex,
      line,
      label,
      kind: label.subKey === null ? "main" : "sub",
    });
    previousAccepted = label;
  });

  return {
    starts,
    warningsByLabel,
  };
}

function isMarkSchemeBoilerplate(line: Line) {
  if (line.pageNumber < MARK_SCHEME_START_PAGE) {
    return true;
  }

  const text = line.rawText.toLowerCase();

  if (!text) {
    return true;
  }

  return (
    text.includes("mark scheme") ||
    text.includes("question answers extra information mark") ||
    text === "ao /" ||
    text === "spec. ref." ||
    text === "pmt"
  );
}

function parseMarkSchemeLabel(line: Line) {
  const labelItem = line.items.find(
    (item) => item.x < 100 && /^\d{2}\.\d+$/.test(item.text.trim()),
  );

  return labelItem?.text.trim() ?? null;
}

function parseTotalQuestionLine(line: Line) {
  const match = line.rawText.match(/Total Question\s+(\d+)\s+(\d+)/i);

  if (!match) {
    return null;
  }

  return {
    mainKey: match[1].padStart(2, "0"),
    totalMarks: Number(match[2]),
  };
}

function buildMarkSchemeText(lines: Line[]) {
  return lines
    .map((line) => buildLineText(line.items, MARK_SCHEME_CONTENT_MIN_X, MARK_SCHEME_CONTENT_MAX_X))
    .filter(Boolean)
    .join("\n");
}

function computeBlockMaxMarks(lines: Line[]) {
  const rangeMarks: number[] = [];
  const singleMarks: number[] = [];

  for (const line of lines) {
    for (const item of line.items) {
      if (item.x < MARK_COLUMN_MIN_X || item.x > MARK_COLUMN_MAX_X) {
        continue;
      }

      const compactText = item.text.replace(/\s+/g, "");
      const rangeMatch = compactText.match(/^(\d+)[-\u2013](\d+)$/);

      if (rangeMatch) {
        rangeMarks.push(Number(rangeMatch[2]));
        continue;
      }

      if (/^\d+$/.test(compactText)) {
        const value = Number(compactText);

        if (value <= 9) {
          singleMarks.push(value);
        }
      }
    }
  }

  if (rangeMarks.length > 0) {
    return Math.max(...rangeMarks);
  }

  return singleMarks.reduce((total, value) => total + value, 0);
}

function buildMarkSchemeBlocks(lines: Line[]) {
  const filteredLines = lines.filter((line) => !isMarkSchemeBoilerplate(line));
  const totalsByMainKey = new Map<string, number>();
  const blocks: MarkSchemeBlock[] = [];
  let currentBlockLabel: string | null = null;
  let currentBlockLines: Line[] = [];

  function flushCurrentBlock() {
    if (!currentBlockLabel) {
      return;
    }

    const mainKey = currentBlockLabel.split(".")[0];
    const markSchemeText = buildMarkSchemeText(currentBlockLines);
    const maxMarks = computeBlockMaxMarks(currentBlockLines);
    const warnings: string[] = [];

    if (!markSchemeText) {
      warnings.push(`no mark scheme text extracted for ${currentBlockLabel}`);
    }

    if (maxMarks <= 0) {
      warnings.push(`no positive max mark extracted for ${currentBlockLabel}`);
    }

    blocks.push({
      label: currentBlockLabel,
      mainKey,
      lines: currentBlockLines,
      markSchemeText,
      maxMarks,
      notes: [],
      warnings,
    });

    currentBlockLabel = null;
    currentBlockLines = [];
  }

  for (const line of filteredLines) {
    const total = parseTotalQuestionLine(line);

    if (total) {
      totalsByMainKey.set(total.mainKey, total.totalMarks);
      flushCurrentBlock();
      continue;
    }

    const label = parseMarkSchemeLabel(line);

    if (label) {
      flushCurrentBlock();
      currentBlockLabel = label;
      currentBlockLines = [line];
      continue;
    }

    if (currentBlockLabel) {
      currentBlockLines.push(line);
    }
  }

  flushCurrentBlock();

  for (const block of blocks) {
    const expectedTotal = totalsByMainKey.get(block.mainKey);

    if (expectedTotal === undefined) {
      block.warnings.push(`missing Total Question validation line for ${block.mainKey}`);
      continue;
    }

    const actualTotal = blocks
      .filter((candidate) => candidate.mainKey === block.mainKey)
      .reduce((total, candidate) => total + candidate.maxMarks, 0);

    if (actualTotal !== expectedTotal) {
      block.warnings.push(
        `Total Question ${Number(block.mainKey)} expected ${expectedTotal} marks but adapter counted ${actualTotal}`,
      );
    } else {
      block.notes.push(`validated against Total Question ${Number(block.mainKey)} = ${expectedTotal}`);
    }
  }

  return new Map(blocks.map((block) => [block.label, block] as const));
}

function buildPrimaryPdfBox(lines: Line[], pageNumber: number) {
  const boxItems = lines
    .filter((line) => line.pageNumber === pageNumber)
    .flatMap((line) => line.items)
    .filter((item) => item.x <= QUESTION_CROP_MAX_X);

  if (boxItems.length === 0) {
    return {
      left: 48,
      right: 48 + MIN_BOX_WIDTH,
      top: 760,
      bottom: 760 - MIN_BOX_HEIGHT,
    } satisfies QuestionPdfBox;
  }

  const minX = Math.min(...boxItems.map((item) => item.x));
  const maxX = Math.max(...boxItems.map((item) => item.x + item.width));
  const minY = Math.min(...boxItems.map((item) => item.y));
  const maxY = Math.max(...boxItems.map((item) => item.y + item.height));
  const paddedLeft = Math.max(0, minX - BOX_PADDING_X);
  const paddedRight = Math.max(paddedLeft + MIN_BOX_WIDTH, maxX + BOX_PADDING_X);
  const paddedBottom = Math.max(0, minY - BOX_PADDING_Y);
  const paddedTop = Math.max(paddedBottom + MIN_BOX_HEIGHT, maxY + BOX_PADDING_Y);

  return {
    left: paddedLeft,
    right: paddedRight,
    top: paddedTop,
    bottom: paddedBottom,
  } satisfies QuestionPdfBox;
}

function getContextText(lines: Line[]) {
  return lines.map((line) => line.contentText).filter(Boolean);
}

function getQuestionText(contextLines: Line[], segmentLines: Line[]) {
  return [...getContextText(contextLines), ...getContextText(segmentLines)].join("\n");
}

function buildQuestionDrafts(
  questionLines: Line[],
  markSchemeBlocksByLabel: Map<string, MarkSchemeBlock>,
) {
  const filteredQuestionLines = questionLines.filter((line) => !isQuestionPaperBoilerplate(line));
  const { starts, warningsByLabel } = getQuestionStarts(filteredQuestionLines);
  const drafts: QuestionDraft[] = [];
  let currentMainContext: { label: string; lines: Line[] } | null = null;

  starts.forEach((start, index) => {
    const nextStartLineIndex = starts[index + 1]?.lineIndex ?? filteredQuestionLines.length;

    if (start.kind === "main") {
      currentMainContext = {
        label: start.label.label,
        lines: filteredQuestionLines
          .slice(start.lineIndex, nextStartLineIndex)
          .filter((line) => !parseQuestionLabel(line)),
      };
      currentMainContext.lines.unshift(start.line);
      return;
    }

    const markSchemeBlock = markSchemeBlocksByLabel.get(start.label.label);

    if (!markSchemeBlock) {
      return;
    }

    const segmentLines = filteredQuestionLines.slice(start.lineIndex, nextStartLineIndex);
    const pageStart = segmentLines[0]?.pageNumber ?? start.line.pageNumber;
    const pageEnd = segmentLines.at(-1)?.pageNumber ?? pageStart;
    const contextLines =
      currentMainContext?.label === start.label.mainKey &&
      currentMainContext.lines.every((line) => line.pageNumber === pageStart)
        ? currentMainContext.lines
        : [];
    const warnings = [
      ...(warningsByLabel.get(start.label.label) ?? []),
      ...markSchemeBlock.warnings.map((message) => ({
        stage: "adapter" as const,
        message,
      })),
    ];

    drafts.push({
      questionKey: start.label.label,
      displayOrder: drafts.length + 1,
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: getQuestionText(contextLines, segmentLines),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: markSchemeBlock.notes.join("\n"),
      pageStart,
      pageEnd,
      primaryPdfBox: buildPrimaryPdfBox([...contextLines, ...segmentLines], pageStart),
      supportingPdfBoxes: [],
      importDiagnostics: {
        adapterKey: aqaCombinedSciencePhysicsPaper1HigherAdapter.key,
        sourceQuestionLabel: start.label.label,
        sourceMarkSchemeLabel: markSchemeBlock.label,
        contextQuestionLabel: currentMainContext?.label ?? null,
        warnings,
      },
    });
  });

  return drafts;
}

export const aqaCombinedSciencePhysicsPaper1HigherAdapter: PaperImportAdapter = {
  key: "aqa-combined-science-physics-paper-1-higher",
  importVersion: "v1",
  detectQuestionDrafts({ questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
    const questionLines = groupItemsIntoLines(questionItems);
    const markSchemeLines = groupItemsIntoLines(
      markSchemeItems.filter((item) => item.pageNumber >= MARK_SCHEME_START_PAGE),
    );
    const markSchemeBlocksByLabel = buildMarkSchemeBlocks(markSchemeLines);

    return buildQuestionDrafts(questionLines, markSchemeBlocksByLabel);
  },
};
