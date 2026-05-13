export type ImportStatus = "discovered" | "importing" | "ready" | "failed";

export type PmtPaperCandidate = {
  paperPageUrl: string;
  questionPaperUrl: string;
  markSchemeUrl: string;
  examBoard: "AQA" | "Edexcel" | "OCR";
  qualification: string;
  subject: string;
  paperNumber: number;
  tier: string;
  sessionLabel: string;
  year: number;
};
