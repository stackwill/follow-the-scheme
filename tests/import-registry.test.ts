import { describe, expect, it } from "vitest";

import { supportedPaperDefinitions, yearsForDefinition } from "@/lib/import/registry";

describe("supported paper registry", () => {
  it("has unique adapter/year pairs", () => {
    const keys = supportedPaperDefinitions.flatMap((definition) =>
      yearsForDefinition(definition).map((year) => `${definition.adapterKey}:${year}`),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps every supported paper discoverable by local sync", () => {
    expect(
      supportedPaperDefinitions.map((definition) => ({
        adapterKey: definition.adapterKey,
        years: yearsForDefinition(definition),
      })),
    ).toEqual([
      {
        adapterKey: "aqa-combined-science-physics-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-biology-paper-2-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-chemistry-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-chemistry-paper-2-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-computer-science-paper-1b-python",
        years: [2024],
      },
      {
        adapterKey: "ocr-gcse-business-paper-1",
        years: [2023, 2024],
      },
      {
        adapterKey: "ocr-gcse-business-paper-2",
        years: [2023, 2024],
      },
    ]);
  });
});
