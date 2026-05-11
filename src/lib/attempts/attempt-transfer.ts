export type PaperAttemptIdentity = {
  adapterKey: string;
  year: number;
  sessionLabel: string;
  paperNumber: number;
  tier: string;
};

export type AttemptExportInput = {
  mode: string;
  startedAt: Date;
  completedAt: Date | null;
  paper: PaperAttemptIdentity;
  answers: Array<{
    question: {
      questionKey: string;
    };
    submittedAnswer: string;
    userNotes: string;
    awardedMarks: number;
    maxMarks: number;
    gradingReasoning: string;
    feedback: string;
    rawModelResponse: string;
    promptVersion: string;
    createdAt: Date;
  }>;
};

export type AttemptExport = {
  exportedAt: string;
  attempts: Array<{
    mode: string;
    startedAt: string;
    completedAt: string | null;
    paperIdentity: PaperAttemptIdentity;
    answers: Array<{
      questionKey: string;
      submittedAnswer: string;
      userNotes: string;
      awardedMarks: number;
      maxMarks: number;
      gradingReasoning: string;
      feedback: string;
      rawModelResponse: string;
      promptVersion: string;
      createdAt: string;
    }>;
  }>;
};

export function buildAttemptExport(attempts: AttemptExportInput[]): AttemptExport {
  return {
    exportedAt: new Date().toISOString(),
    attempts: attempts.map((attempt) => ({
      mode: attempt.mode,
      startedAt: attempt.startedAt.toISOString(),
      completedAt: attempt.completedAt?.toISOString() ?? null,
      paperIdentity: attempt.paper,
      answers: attempt.answers.map((answer) => ({
        questionKey: answer.question.questionKey,
        submittedAnswer: answer.submittedAnswer,
        userNotes: answer.userNotes,
        awardedMarks: answer.awardedMarks,
        maxMarks: answer.maxMarks,
        gradingReasoning: answer.gradingReasoning,
        feedback: answer.feedback,
        rawModelResponse: answer.rawModelResponse,
        promptVersion: answer.promptVersion,
        createdAt: answer.createdAt.toISOString(),
      })),
    })),
  };
}

export function findPaperForAttemptImport<T extends PaperAttemptIdentity>(
  papers: T[],
  identity: PaperAttemptIdentity,
) {
  return (
    papers.find(
      (paper) =>
        paper.adapterKey === identity.adapterKey &&
        paper.year === identity.year &&
        paper.sessionLabel === identity.sessionLabel &&
        paper.paperNumber === identity.paperNumber &&
        paper.tier === identity.tier,
    ) ?? null
  );
}
