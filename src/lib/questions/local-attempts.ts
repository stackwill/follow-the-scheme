"use client";

export type LocalQuestionAttempt = {
  id: string;
  questionId: string;
  questionKey: string;
  submittedAnswer: string;
  awardedMarks: number;
  maxMarks: number;
  reasoning: string;
  feedback: string;
  createdAt: string;
};

export type LocalPaperAttempts = {
  version: 1;
  questions: Record<
    string,
    {
      attempts: LocalQuestionAttempt[];
    }
  >;
};

const STORAGE_PREFIX = "followthescheme:paper-attempts:v1";
const MAX_ATTEMPTS_PER_QUESTION = 20;

export function paperAttemptsStorageKey(paperId: string) {
  return `${STORAGE_PREFIX}:${paperId}`;
}

function emptyPaperAttempts(): LocalPaperAttempts {
  return {
    version: 1,
    questions: {},
  };
}

export function readLocalPaperAttempts(paperId: string): LocalPaperAttempts {
  if (typeof window === "undefined") {
    return emptyPaperAttempts();
  }

  const rawValue = window.localStorage.getItem(paperAttemptsStorageKey(paperId));

  if (!rawValue) {
    return emptyPaperAttempts();
  }

  try {
    const parsed = JSON.parse(rawValue) as LocalPaperAttempts;

    if (parsed.version === 1 && parsed.questions && typeof parsed.questions === "object") {
      return parsed;
    }
  } catch {
    return emptyPaperAttempts();
  }

  return emptyPaperAttempts();
}

export function latestLocalAttempt(attempts: LocalPaperAttempts, questionId: string) {
  return attempts.questions[questionId]?.attempts[0] ?? null;
}

export function localAttemptCount(attempts: LocalPaperAttempts, questionId: string) {
  return attempts.questions[questionId]?.attempts.length ?? 0;
}

export function saveLocalQuestionAttempts(paperId: string, nextAttempts: LocalQuestionAttempt[]) {
  if (typeof window === "undefined" || nextAttempts.length === 0) {
    return emptyPaperAttempts();
  }

  const stored = readLocalPaperAttempts(paperId);

  for (const attempt of nextAttempts) {
    const existingAttempts = stored.questions[attempt.questionId]?.attempts ?? [];

    stored.questions[attempt.questionId] = {
      attempts: [attempt, ...existingAttempts].slice(0, MAX_ATTEMPTS_PER_QUESTION),
    };
  }

  window.localStorage.setItem(paperAttemptsStorageKey(paperId), JSON.stringify(stored));

  return stored;
}
