export type MarkSchemeLineKind = "plain" | "bullet" | "guidance" | "heading" | "level" | "marks";

export type FormattedMarkSchemeLine = {
  kind: MarkSchemeLineKind;
  text: string;
};

export type FormattedMarkSchemeSection = {
  title: string | null;
  lines: FormattedMarkSchemeLine[];
};

const HEADING_PATTERNS = [
  /^Question\b/i,
  /^any\s+(?:one|two|three|\d+)\s+from:?$/i,
  /^Target\s*:/i,
  /^Level\s+Mark\s+Descriptor\b/i,
  /^Marking instructions\b/i,
  /^Indicative content(?: guidance)?\b/i,
  /^Relevant points may include:?$/i,
  /^Responses may include:?$/i,
  /^Reward all valid points\.?$/i,
  /^General Marking Guidance\b/i,
  /^How to award marks\b/i,
  /^\d+\.\s+Finding (?:the right level|a mark within a level)\b/i,
  /^Comparative points:?$/i,
  /^The (?:ideas|poets?' use|second poem)\b.*:?$/i,
  /^Poem\s+\d+\s*:/i,
  /^Context points\b/i,
];

function normalizeMarkSchemeLines(markSchemeText: string) {
  return markSchemeText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isCompactHeading(line: string) {
  return /^[A-Z][A-Za-z0-9()[\]'’.,\s/-]{2,88}:$/.test(line) && !/^allow\b|^ignore\b|^accept\b/i.test(line);
}

function isHeadingLine(line: string) {
  return HEADING_PATTERNS.some((pattern) => pattern.test(line)) || isCompactHeading(line);
}

function kindForLine(line: string): MarkSchemeLineKind {
  if (isHeadingLine(line)) {
    return "heading";
  }

  if (/^(?:[•●*-]|o)\s+/.test(line)) {
    return "bullet";
  }

  if (/^(?:Level\s*)?\d+\s+\d+\s*[–-]\s*\d+\b/i.test(line) || /^\d+\s+No rewardable material\.?$/i.test(line)) {
    return "level";
  }

  if (/^(?:allow|ignore|accept|reject|do not accept|note|nb)\b/i.test(line)) {
    return "guidance";
  }

  if (/\bAO\d\b/i.test(line) || /\b\d+\s*marks?\b/i.test(line) || /^\(?\d+\s*marks?\)?$/i.test(line)) {
    return "marks";
  }

  return "plain";
}

export function formatMarkSchemeText(markSchemeText: string): FormattedMarkSchemeSection[] {
  const lines = normalizeMarkSchemeLines(markSchemeText);

  if (lines.length === 0) {
    return [
      {
        title: null,
        lines: [{ kind: "plain", text: "No mark scheme text is available for this question yet." }],
      },
    ];
  }

  const sections: FormattedMarkSchemeSection[] = [];
  let currentSection: FormattedMarkSchemeSection = { title: null, lines: [] };

  for (const line of lines) {
    const kind = kindForLine(line);

    if (kind === "heading" && (currentSection.title !== null || currentSection.lines.length > 0)) {
      sections.push(currentSection);
      currentSection = { title: line, lines: [] };
      continue;
    }

    if (kind === "heading" && currentSection.title === null && currentSection.lines.length === 0) {
      currentSection = { title: line, lines: [] };
      continue;
    }

    currentSection.lines.push({ kind, text: line });
  }

  sections.push(currentSection);

  return sections;
}
