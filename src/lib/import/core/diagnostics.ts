export type ImportStage =
  | "discovery"
  | "fixtures"
  | "pdf-text"
  | "adapter"
  | "render"
  | "crop"
  | "persist";

export type ImportWarning = {
  stage: ImportStage;
  message: string;
};

export type QuestionImportDiagnostics = {
  adapterKey: string;
  sourceQuestionLabel: string;
  sourceMarkSchemeLabel: string;
  contextQuestionLabel: string | null;
  warnings: ImportWarning[];
};

export class ImportFailure extends Error {
  readonly name = "ImportFailure";
  readonly stage: ImportStage;
  readonly details: Record<string, unknown>;

  constructor(
    stage: ImportStage,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.stage = stage;
    this.details = details;
  }
}

export function serializeImportDiagnostics(diagnostics: QuestionImportDiagnostics) {
  return JSON.stringify(diagnostics);
}
