import { afterEach, describe, expect, it, vi } from "vitest";

import {
  paperAttemptsStorageKey,
  readLocalPaperAttempts,
  saveLocalQuestionAttempts,
  type LocalQuestionAttempt,
} from "@/lib/questions/local-attempts";

function stubLocalStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  });

  return values;
}

describe("local question attempts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores malformed stored attempts", () => {
    stubLocalStorage({
      [paperAttemptsStorageKey("paper-1")]: JSON.stringify({
        version: 1,
        questions: {
          "question-1": {
            attempts: [{ id: "attempt-1" }],
          },
        },
      }),
    });

    expect(readLocalPaperAttempts("paper-1")).toEqual({
      version: 1,
      questions: {},
    });
  });

  it("stores valid attempts newest-first", () => {
    const values = stubLocalStorage();
    const attempt = {
      id: "attempt-1",
      questionId: "question-1",
      questionKey: "1.a",
      submittedAnswer: "answer",
      awardedMarks: 2,
      maxMarks: 3,
      reasoning: "reasoning",
      feedback: "feedback",
      createdAt: "2026-05-16T12:00:00.000Z",
    } satisfies LocalQuestionAttempt;

    expect(saveLocalQuestionAttempts("paper-1", [attempt])).toEqual({
      version: 1,
      questions: {
        "question-1": {
          attempts: [attempt],
        },
      },
    });
    expect(values.get(paperAttemptsStorageKey("paper-1"))).toBe(
      JSON.stringify({
        version: 1,
        questions: {
          "question-1": {
            attempts: [attempt],
          },
        },
      }),
    );
  });
});
