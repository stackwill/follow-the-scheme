export type ImportStatus = "discovered" | "importing" | "ready" | "failed";

export type PmtPaperCandidate = {
  paperPageUrl: string;
  questionPaperUrl: string;
  insertUrl?: string;
  markSchemeUrl: string;
  markSchemeInsertUrl?: string;
  examBoard: "AQA" | "CAIE" | "Edexcel" | "OCR";
  qualification: string;
  subject: string;
  paperNumber: number;
  tier: string;
  sessionLabel: string;
  year: number;
};
