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
        years: [2021, 2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-physics-paper-2-higher",
        years: [2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        years: [2021, 2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-biology-paper-2-higher",
        years: [2021, 2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-chemistry-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-chemistry-paper-2-higher",
        years: [2021, 2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-chemistry-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-chemistry-paper-2-higher",
        years: [2022, 2023],
      },
      {
        adapterKey: "aqa-gcse-computer-science-paper-1b-python",
        years: [2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-computer-science-paper-2",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-religious-studies-short-course-christianity",
        years: [2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-religious-studies-short-course-judaism",
        years: [2022, 2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-religious-studies-short-course-themes",
        years: [2022, 2023, 2024],
      },
      {
        adapterKey: "edexcel-a-geography-paper-1-physical-environment",
        years: [2023, 2024],
      },
      {
        adapterKey: "edexcel-gcse-english-literature-paper-2-jekyll-conflict",
        years: [2023, 2024],
      },
      {
        adapterKey: "caie-igcse-english-language-paper-2",
        years: [2024],
      },
      {
        adapterKey: "edexcel-gcse-maths-paper-2-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "edexcel-gcse-maths-paper-2-higher-november-2024",
        years: [2024],
      },
      {
        adapterKey: "edexcel-gcse-history-paper-1-medicine",
        years: [2023, 2024],
      },
      {
        adapterKey: "edexcel-gcse-history-paper-2-cold-war-elizabeth",
        years: [2022, 2023, 2024],
      },
      {
        adapterKey: "edexcel-gcse-history-paper-3-germany",
        years: [2022, 2023, 2024],
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
