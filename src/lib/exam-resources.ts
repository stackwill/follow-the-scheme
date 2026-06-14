export const AQA_GCSE_PHYSICS_2026_EQUATION_SHEET_URL =
  "https://cdn.sanity.io/files/p28bar15/green/6b5358e1159b1b6cc2d622fc5eb894320d6fb763.pdf";

export const AQA_COMBINED_SCIENCE_PHYSICS_2026_EQUATION_SHEET_URL =
  "https://www.aqa.org.uk/files/resources.science.AQA-8464-8465-FS-INS-2025_PDF/c4fac749855e8fefcd6ff58bd7b9cb701309df9b.pdf";

export function getAqaPhysicsEquationSheetUrl(paper: {
  examBoard: string;
  qualification: string;
  subject: string;
  paperNumber: number;
  specCode: string;
}) {
  if (paper.examBoard !== "AQA" || paper.subject !== "Physics") {
    return null;
  }

  if (paper.qualification === "GCSE Physics" && paper.specCode === "8463") {
    return AQA_GCSE_PHYSICS_2026_EQUATION_SHEET_URL;
  }

  if (paper.qualification === "GCSE Combined Science Trilogy" && paper.specCode === "8464") {
    return AQA_COMBINED_SCIENCE_PHYSICS_2026_EQUATION_SHEET_URL;
  }

  return null;
}
