export type ImportStatus = "discovered" | "importing" | "ready" | "failed";

export type PmtPaperCandidate = {
  paperPageUrl: string;
  questionPaperUrl: string;
  markSchemeUrl: string;
  examBoard: "AQA";
  qualification: "GCSE Combined Science Trilogy";
  subject: "Physics";
  paperNumber: 1;
  tier: "Higher";
  sessionLabel: string;
  year: number;
};
