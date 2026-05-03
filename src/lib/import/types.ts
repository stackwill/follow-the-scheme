export type ImportStatus = "discovered" | "importing" | "ready" | "failed";

export type PmtPaperCandidate = {
  paperPageUrl: string;
  questionPaperUrl: string;
  markSchemeUrl: string;
  examBoard: "AQA";
  qualification: string;
  subject: string;
  paperNumber: 1;
  tier: string;
  sessionLabel: string;
  year: number;
};
