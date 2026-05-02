import type { QuestionImportDiagnostics } from "@/lib/import/core/diagnostics";
import type { TextItem } from "@/lib/import/core/pdf-text";

export type QuestionPdfBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type SupportingPdfBox = QuestionPdfBox & {
  pageNumber: number;
};

export type QuestionDraft = {
  questionKey: string;
  displayOrder: number;
  maxMarks: number;
  extractedQuestionText: string;
  markSchemeText: string;
  markSchemeNotes: string;
  pageStart: number;
  pageEnd: number;
  primaryPdfBox: QuestionPdfBox;
  supportingPdfBoxes: SupportingPdfBox[];
  importDiagnostics: QuestionImportDiagnostics;
};

export type DetectQuestionDraftsInput = {
  year: 2023 | 2024;
  questionItems: TextItem[];
  markSchemeItems: TextItem[];
};

export type PaperImportAdapter = {
  key: string;
  importVersion: string;
  detectQuestionDrafts(input: DetectQuestionDraftsInput): QuestionDraft[];
};
