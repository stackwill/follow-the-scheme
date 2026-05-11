import { describe, expect, it } from "vitest";

import {
  buildAttemptExport,
  findPaperForAttemptImport,
  type AttemptExportInput,
} from "@/lib/attempts/attempt-transfer";

describe("data release attempt preservation", () => {
  it("exports attempts keyed by stable paper and question identity", () => {
    const input = [
      {
        mode: "practice",
        startedAt: new Date("2026-05-11T10:00:00.000Z"),
        completedAt: new Date("2026-05-11T10:05:00.000Z"),
        paper: {
          adapterKey: "aqa-combined-science-biology-paper-1-higher",
          year: 2024,
          sessionLabel: "June 2024",
          paperNumber: 1,
          tier: "Higher",
        },
        answers: [
          {
            question: {
              questionKey: "07.2",
            },
            submittedAnswer: "No clear zone around C or E.",
            userNotes: "",
            awardedMarks: 2,
            maxMarks: 2,
            gradingReasoning: "Matches resistance evidence.",
            feedback: "Good evidence.",
            rawModelResponse: "{}",
            promptVersion: "v1",
            createdAt: new Date("2026-05-11T10:04:00.000Z"),
          },
        ],
      },
    ] satisfies AttemptExportInput[];

    expect(buildAttemptExport(input)).toEqual({
      exportedAt: expect.any(String),
      attempts: [
        {
          mode: "practice",
          startedAt: "2026-05-11T10:00:00.000Z",
          completedAt: "2026-05-11T10:05:00.000Z",
          paperIdentity: {
            adapterKey: "aqa-combined-science-biology-paper-1-higher",
            year: 2024,
            sessionLabel: "June 2024",
            paperNumber: 1,
            tier: "Higher",
          },
          answers: [
            {
              questionKey: "07.2",
              submittedAnswer: "No clear zone around C or E.",
              userNotes: "",
              awardedMarks: 2,
              maxMarks: 2,
              gradingReasoning: "Matches resistance evidence.",
              feedback: "Good evidence.",
              rawModelResponse: "{}",
              promptVersion: "v1",
              createdAt: "2026-05-11T10:04:00.000Z",
            },
          ],
        },
      ],
    });
  });

  it("finds the refreshed paper row without depending on generated IDs", () => {
    const papers = [
      {
        id: "new-paper-id",
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        year: 2024,
        sessionLabel: "June 2024",
        paperNumber: 1,
        tier: "Higher",
      },
    ];

    expect(
      findPaperForAttemptImport(papers, {
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        year: 2024,
        sessionLabel: "June 2024",
        paperNumber: 1,
        tier: "Higher",
      }),
    ).toEqual(papers[0]);
  });
});
