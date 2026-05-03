import type {
  DetectQuestionDraftsInput,
  PaperImportAdapter,
  QuestionDraft,
  QuestionPdfBox,
  SupportingPdfBox,
} from "@/lib/import/adapters/base";
import { ImportFailure, type ImportWarning } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

const QUESTION_LINE_Y_TOLERANCE = 2.5;
const MARK_SCHEME_START_PAGE = 7;
const LEFT_MARGIN_MIN_X = 50;
const LEFT_MARGIN_MAX_X = 60;
const NUMBERING_MAX_X = 105;
const QUESTION_CONTENT_MIN_X = 110;
const QUESTION_CONTENT_MAX_X = 490;
const QUESTION_CROP_MAX_X = 535;
const QUESTION_CROP_LEFT = 40;
const QUESTION_CROP_RIGHT = 555;
const QUESTION_FOOTER_CUTOFF_Y = 140;
const QUESTION_PAGE_TOP_LIMIT = 804;
const QUESTION_PAGE_NUMBER_MIN_Y = 790;
const QUESTION_PAGE_NUMBER_MIN_X = 250;
const QUESTION_PAGE_NUMBER_MAX_X = 320;
const QUESTION_FOOTER_NUMBER_MAX_Y = 145;
const QUESTION_FOOTER_NUMBER_MIN_X = 530;
const QUESTION_START_BOTTOM_PADDING = 22;
const MARK_SCHEME_CONTENT_MIN_X = 100;
const MARK_SCHEME_CONTENT_MAX_X = 450;
const MARK_COLUMN_MIN_X = 440;
const MARK_COLUMN_MAX_X = 480;
const MIN_BOX_HEIGHT = 120;
const MIN_EFFECTIVE_BOX_HEIGHT = 1;
const BOX_PADDING_Y = 18;
const MARK_RANGE_PATTERN = /^(\d+)[-\u2010-\u2015](\d+)$/;

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

  if (
    /^\d+$/.test(text) &&
    line.y >= QUESTION_PAGE_NUMBER_MIN_Y &&
    line.minX >= QUESTION_PAGE_NUMBER_MIN_X &&
    line.maxX <= QUESTION_PAGE_NUMBER_MAX_X
  ) {
    return true;
  }

  if (/^\d+$/.test(text) && line.y <= QUESTION_FOOTER_NUMBER_MAX_Y && line.minX >= QUESTION_FOOTER_NUMBER_MIN_X) {
    return true;
  }

  return (
    text === "pmt" ||
    (text === "box" && line.minX > 540) ||
    text.includes("do not write") ||
    text.includes("outside the box") ||
    (text.includes("outside the") && line.minX > 540) ||
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
    (item) => item.x < 100 && /^\d{1,2}\.\d+$/.test(item.text.trim()),
  );

  if (!labelItem) {
    return null;
  }

  const [mainKey, subKey] = labelItem.text.trim().split(".");

  return `${mainKey.padStart(2, "0")}.${subKey}`;
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
  const extractedText = lines
    .map((line) => buildLineText(line.items, MARK_SCHEME_CONTENT_MIN_X, MARK_SCHEME_CONTENT_MAX_X))
    .filter(Boolean)
    .join("\n");

  if (extractedText) {
    return extractedText;
  }

  const maxMarks = computeBlockMaxMarks(lines);

  return `[Non-textual mark scheme content in source PDF${maxMarks > 0 ? `; ${maxMarks} mark${maxMarks === 1 ? "" : "s"}` : ""}]`;
}

function isLevelDescriptorPrelude(line: Line) {
  if (parseMarkSchemeLabel(line) || parseTotalQuestionLine(line) || isMarkSchemeBoilerplate(line)) {
    return false;
  }

  const hasMarkColumnValue = line.items.some((item) => {
    if (item.x < MARK_COLUMN_MIN_X || item.x > MARK_COLUMN_MAX_X) {
      return false;
    }

    return /^(\d+)$/.test(item.text.replace(/\s+/g, "")) || MARK_RANGE_PATTERN.test(item.text.replace(/\s+/g, ""));
  });

  return /\bLevel\s+\d+/i.test(line.rawText) || hasMarkColumnValue;
}

function collectMarkSchemePrelude(lines: Line[], labelIndex: number) {
  const prelude: Line[] = [];

  for (let cursor = labelIndex - 1; cursor >= 0; cursor -= 1) {
    const candidate = lines[cursor];
    const nextLine = lines[cursor + 1];

    if (candidate.pageNumber !== nextLine.pageNumber) {
      break;
    }

    if (candidate.y - nextLine.y > 12) {
      break;
    }

    if (!isLevelDescriptorPrelude(candidate)) {
      break;
    }

    prelude.unshift(candidate);
  }

  return prelude;
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
      const rangeMatch = compactText.match(MARK_RANGE_PATTERN);

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
  const blockStarts: Array<{ label: string; startIndex: number; labelIndex: number }> = [];
  const totalLineIndices: number[] = [];
  const fatalErrors: string[] = [];

  filteredLines.forEach((line, index) => {
    const total = parseTotalQuestionLine(line);

    if (total) {
      totalsByMainKey.set(total.mainKey, total.totalMarks);
      totalLineIndices.push(index);
      return;
    }

    const label = parseMarkSchemeLabel(line);

    if (label) {
      blockStarts.push({
        label,
        startIndex: index - collectMarkSchemePrelude(filteredLines, index).length,
        labelIndex: index,
      });
    }
  });
  const blocks = blockStarts.map((blockStart, index) => {
    const nextBlockStartIndex = blockStarts[index + 1]?.startIndex ?? filteredLines.length;
    const nextTotalLineIndex =
      totalLineIndices.find(
        (candidateIndex) =>
          candidateIndex > blockStart.labelIndex && candidateIndex < nextBlockStartIndex,
      ) ?? nextBlockStartIndex;
    const currentBlockLines = filteredLines.slice(blockStart.startIndex, nextTotalLineIndex);
    const mainKey = blockStart.label.split(".")[0];
    const markSchemeText = buildMarkSchemeText(currentBlockLines);
    const maxMarks = computeBlockMaxMarks(currentBlockLines);
    const notes: string[] = [];

    if (markSchemeText.startsWith("[Non-textual mark scheme content in source PDF")) {
      notes.push(`used non-textual mark scheme fallback for ${blockStart.label}`);
    }

    if (maxMarks <= 0) {
      fatalErrors.push(`no positive max mark extracted for ${blockStart.label}`);
    }

    return {
      label: blockStart.label,
      mainKey,
      lines: currentBlockLines,
      markSchemeText,
      maxMarks,
      notes,
    } satisfies MarkSchemeBlock;
  });

  for (const block of blocks) {
    const expectedTotal = totalsByMainKey.get(block.mainKey);

    if (expectedTotal === undefined) {
      fatalErrors.push(`missing Total Question validation line for ${block.mainKey}`);
      continue;
    }

    const actualTotal = blocks
      .filter((candidate) => candidate.mainKey === block.mainKey)
      .reduce((total, candidate) => total + candidate.maxMarks, 0);

    if (actualTotal !== expectedTotal) {
      fatalErrors.push(
        `Total Question ${Number(block.mainKey)} expected ${expectedTotal} marks but adapter counted ${actualTotal}`,
      );
    } else {
      block.notes.push(`validated against Total Question ${Number(block.mainKey)} = ${expectedTotal}`);
    }
  }

  return {
    blocksByLabel: new Map(blocks.map((block) => [block.label, block] as const)),
    fatalErrors,
  };
}

function buildPageBandPdfBox(lines: Line[], nextQuestionStartLine: Line | null = null) {
  const nextQuestionBottom =
    nextQuestionStartLine === null
      ? null
      : nextQuestionStartLine.y +
        Math.max(...nextQuestionStartLine.items.map((item) => item.height), 0) +
        QUESTION_START_BOTTOM_PADDING;

  const boxItems = lines
    .flatMap((line) => line.items)
    .filter((item) => item.x <= QUESTION_CROP_MAX_X);

  if (boxItems.length === 0) {
    const bottom = nextQuestionBottom ?? 760 - MIN_BOX_HEIGHT;

    return {
      left: QUESTION_CROP_LEFT,
      right: QUESTION_CROP_RIGHT,
      top: Math.min(QUESTION_PAGE_TOP_LIMIT, bottom + MIN_BOX_HEIGHT),
      bottom,
    } satisfies QuestionPdfBox;
  }

  const maxY = Math.max(...boxItems.map((item) => item.y + item.height));
  const paddedTop =
    nextQuestionBottom === null
      ? Math.min(QUESTION_PAGE_TOP_LIMIT, Math.max(maxY + BOX_PADDING_Y, QUESTION_FOOTER_CUTOFF_Y + MIN_BOX_HEIGHT))
      : Math.min(QUESTION_PAGE_TOP_LIMIT, Math.max(maxY + BOX_PADDING_Y, nextQuestionBottom));
  const paddedBottom =
    nextQuestionBottom === null
      ? Math.max(0, Math.min(QUESTION_FOOTER_CUTOFF_Y, paddedTop - MIN_BOX_HEIGHT))
      : Math.max(0, Math.min(nextQuestionBottom, paddedTop));

  return {
    left: QUESTION_CROP_LEFT,
    right: QUESTION_CROP_RIGHT,
    top: paddedTop,
    bottom: paddedBottom,
  } satisfies QuestionPdfBox;
}

function buildSupportingPdfBoxes(lines: Line[], pageStart: number, pageEnd: number, nextStart: QuestionStart | null) {
  const supportingPdfBoxes: SupportingPdfBox[] = [];

  for (let pageNumber = pageStart + 1; pageNumber <= pageEnd; pageNumber += 1) {
    const pageLines = lines.filter((line) => line.pageNumber === pageNumber);

    if (pageLines.length === 0) {
      continue;
    }

    const pdfBox = buildPageBandPdfBox(pageLines, nextStart?.line.pageNumber === pageNumber ? nextStart.line : null);

    if (pdfBox.top - pdfBox.bottom < MIN_EFFECTIVE_BOX_HEIGHT) {
      continue;
    }

    supportingPdfBoxes.push({
      pageNumber,
      ...pdfBox,
    });
  }

  return supportingPdfBoxes;
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
  const fatalErrors: string[] = [];

  starts.forEach((start, index) => {
    const nextStart = starts[index + 1] ?? null;
    const nextStartLineIndex = nextStart?.lineIndex ?? filteredQuestionLines.length;

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
      fatalErrors.push(`missing mark scheme block for ${start.label.label}`);
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
    const relevantLines = [...contextLines, ...segmentLines];
    const supportingPdfBoxes = buildSupportingPdfBoxes(relevantLines, pageStart, pageEnd, nextStart);
    const effectivePageEnd = supportingPdfBoxes.at(-1)?.pageNumber ?? pageStart;

    if (!markSchemeBlock.markSchemeText.trim()) {
      fatalErrors.push(`empty mark scheme text for ${start.label.label}`);
    }

    if (pageEnd > pageStart && supportingPdfBoxes.length === 0 && nextStart?.line.pageNumber !== pageEnd) {
      fatalErrors.push(`missing supporting crop boxes for multi-page question ${start.label.label}`);
    }

    drafts.push({
      questionKey: start.label.label,
      displayOrder: drafts.length + 1,
      maxMarks: markSchemeBlock.maxMarks,
      extractedQuestionText: getQuestionText(contextLines, segmentLines),
      markSchemeText: markSchemeBlock.markSchemeText,
      markSchemeNotes: markSchemeBlock.notes.join("\n"),
      pageStart,
      pageEnd: effectivePageEnd,
      primaryPdfBox: buildPageBandPdfBox(
        relevantLines.filter((line) => line.pageNumber === pageStart),
        nextStart?.line.pageNumber === pageStart ? nextStart.line : null,
      ),
      supportingPdfBoxes,
      importDiagnostics: {
        adapterKey: aqaCombinedSciencePhysicsPaper1HigherAdapter.key,
        sourceQuestionLabel: start.label.label,
        sourceMarkSchemeLabel: markSchemeBlock.label,
        contextQuestionLabel: currentMainContext?.label ?? null,
        warnings: [...(warningsByLabel.get(start.label.label) ?? [])],
      },
    });
  });

  if (fatalErrors.length > 0) {
    throw new ImportFailure(
      "adapter",
      "AQA question draft extraction produced incomplete output",
      { problems: fatalErrors },
    );
  }

  return drafts;
}

function mergeDraftPair(left: QuestionDraft, right: QuestionDraft): QuestionDraft {
  const supportingBoxesByPage = new Map<number, SupportingPdfBox>();

  for (const box of [...left.supportingPdfBoxes, ...right.supportingPdfBoxes]) {
    supportingBoxesByPage.set(box.pageNumber, box);
  }

  if (right.pageStart > left.pageStart) {
    supportingBoxesByPage.set(right.pageStart, {
      pageNumber: right.pageStart,
      ...right.primaryPdfBox,
    });
  }

  return {
    ...left,
    maxMarks: left.maxMarks + right.maxMarks,
    extractedQuestionText: `${left.extractedQuestionText}\n\n${right.extractedQuestionText}`.trim(),
    markSchemeText: `${left.markSchemeText}\n${right.markSchemeText}`.trim(),
    markSchemeNotes: [left.markSchemeNotes, right.markSchemeNotes].filter(Boolean).join("\n"),
    pageEnd: right.pageEnd,
    supportingPdfBoxes: [...supportingBoxesByPage.values()].sort(
      (leftBox, rightBox) => leftBox.pageNumber - rightBox.pageNumber,
    ),
    importDiagnostics: {
      ...left.importDiagnostics,
      sourceMarkSchemeLabel: `${left.importDiagnostics.sourceMarkSchemeLabel}+${right.importDiagnostics.sourceMarkSchemeLabel}`,
      warnings: [
        ...left.importDiagnostics.warnings,
        ...right.importDiagnostics.warnings,
        {
          stage: "adapter",
          message: `merged ${left.questionKey} with ${right.questionKey} to preserve benchmark question-unit stability`,
        },
      ],
    },
  };
}

function normalizeBenchmarkDraftShape(year: 2023 | 2024, drafts: QuestionDraft[]) {
  if (year !== 2024) {
    return drafts;
  }

  const normalizedDrafts: QuestionDraft[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const currentDraft = drafts[index];
    const nextDraft = drafts[index + 1];

    if (currentDraft?.questionKey === "03.5" && nextDraft?.questionKey === "03.6") {
      normalizedDrafts.push(mergeDraftPair(currentDraft, nextDraft));
      index += 1;
      continue;
    }

    normalizedDrafts.push(currentDraft);
  }

  return normalizedDrafts.map((draft, index) => ({
    ...draft,
    displayOrder: index + 1,
  }));
}

function validateConsumedMarkSchemeBlocks(
  drafts: QuestionDraft[],
  markSchemeBlocksByLabel: Map<string, MarkSchemeBlock>,
) {
  const consumedKeys = new Set<string>();

  for (const draft of drafts) {
    for (const key of draft.importDiagnostics.sourceMarkSchemeLabel.split("+")) {
      consumedKeys.add(key);
    }
  }

  const unconsumedKeys = [...markSchemeBlocksByLabel.keys()].filter((key) => !consumedKeys.has(key));

  if (unconsumedKeys.length > 0) {
    throw new ImportFailure("adapter", "AQA mark scheme completeness validation failed", {
      unconsumedMarkSchemeKeys: unconsumedKeys,
    });
  }
}

export const aqaCombinedSciencePhysicsPaper1HigherAdapter: PaperImportAdapter = {
  key: "aqa-combined-science-physics-paper-1-higher",
  importVersion: "v1",
  detectQuestionDrafts({ year, questionItems, markSchemeItems }: DetectQuestionDraftsInput) {
    const questionLines = groupItemsIntoLines(questionItems);
    const markSchemeLines = groupItemsIntoLines(
      markSchemeItems.filter((item) => item.pageNumber >= MARK_SCHEME_START_PAGE),
    );
    const { blocksByLabel: markSchemeBlocksByLabel, fatalErrors } = buildMarkSchemeBlocks(markSchemeLines);

    if (fatalErrors.length > 0) {
      throw new ImportFailure("adapter", "AQA mark scheme validation failed", {
        problems: fatalErrors,
      });
    }

    const drafts = normalizeBenchmarkDraftShape(
      year,
      buildQuestionDrafts(questionLines, markSchemeBlocksByLabel),
    );

    validateConsumedMarkSchemeBlocks(drafts, markSchemeBlocksByLabel);

    return drafts;
  },
};
