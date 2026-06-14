export const AQA_GCSE_PHYSICS_2026_EQUATION_SHEET_URL =
  "https://cdn.sanity.io/files/p28bar15/green/6b5358e1159b1b6cc2d622fc5eb894320d6fb763.pdf";

export function shouldShowAqaGcsePhysicsEquationSheet(paper: {
  examBoard: string;
  qualification: string;
  subject: string;
  paperNumber: number;
  specCode: string;
}) {
  return (
    paper.examBoard === "AQA" &&
    paper.qualification === "GCSE Physics" &&
    paper.subject === "Physics" &&
    paper.paperNumber === 2 &&
    paper.specCode === "8463"
  );
}
