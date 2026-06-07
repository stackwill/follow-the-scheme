import { describe, expect, it } from "vitest";

import { formatMarkSchemeText } from "@/lib/mark-schemes/format";

describe("formatMarkSchemeText", () => {
  it("groups common mark scheme headings without removing text", () => {
    const text = [
      "any two from:",
      "• accurate point one",
      "allow equivalent wording",
      "ignore vague responses",
      "2 marks",
    ].join("\n");

    const sections = formatMarkSchemeText(text);
    const displayedLines = sections.flatMap((section) => [
      ...(section.title ? [section.title] : []),
      ...section.lines.map((line) => line.text),
    ]);

    expect(displayedLines.join("\n")).toBe(text);
    expect(sections[0]).toMatchObject({
      title: "any two from:",
      lines: [
        { kind: "bullet", text: "• accurate point one" },
        { kind: "guidance", text: "allow equivalent wording" },
        { kind: "guidance", text: "ignore vague responses" },
        { kind: "marks", text: "2 marks" },
      ],
    });
  });

  it("keeps long level-based schemes split into readable sections", () => {
    const sections = formatMarkSchemeText(
      [
        "Level Mark Descriptor",
        "0 No rewardable material.",
        "Level 1 1 – 4 • The response is simple with little personal response.",
        "Level 2 5 – 8 • The response may be largely narrative.",
        "Indicative content guidance",
        "Relevant points may include:",
        "• a valid example",
      ].join("\n"),
    );

    expect(sections.map((section) => section.title)).toEqual([
      "Level Mark Descriptor",
      "Indicative content guidance",
      "Relevant points may include:",
    ]);
    expect(sections[0].lines.map((line) => line.kind)).toEqual(["level", "level", "level"]);
    expect(sections[2].lines).toEqual([{ kind: "bullet", text: "• a valid example" }]);
  });
});
