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

/**
 * Notes for future Codex adapter work:
 * - Keep adapters deterministic. Do not use AI during import; AI belongs in marking after a
 *   question has been imported and answered.
 * - Start from real PDF text extraction output for the target paper/mark scheme. AQA, OCR,
 *   Edexcel, and subject families all place labels, marks, tables, and continuation text
 *   differently.
 * - Treat an adapter as three separate contracts: question-start detection, mark-scheme block
 *   pairing, and crop-box construction. Add tests for each contract before trusting a new paper.
 * - Preserve visual context generously for code grids, figures, tables, circuits, graphs, and
 *   source material. It is better for the UI to show extra official paper context than to omit a
 *   line needed to answer.
 * - Validate total marks and fail fast on missing/unused mark-scheme blocks. Silent partial
 *   imports make marking untrustworthy.
 * - Keep board/subject-specific heuristics inside the adapter file unless two adapters genuinely
 *   share the same PDF format.
 */
