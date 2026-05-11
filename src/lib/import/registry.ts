import { getPaperDir, getPaperDirForAdapter } from "@/lib/import/core/storage";
import {
  discoverAqaBiologyPaper1Higher,
  discoverAqaBiologyPaper2Higher,
  discoverAqaChemistryPaper1Higher,
  discoverAqaChemistryPaper2Higher,
  discoverAqaGcseComputerSciencePaper1BPython,
  discoverAqaPhysicsPaper1Higher,
  discoverOcrGcseBusinessPaper1,
  discoverOcrGcseBusinessPaper2,
} from "@/lib/import/pmt/discovery";

export const DEFAULT_SOURCE_PROVIDER = "PMT";
export const DEFAULT_SUBJECT_INDEX_URL = "https://www.physicsandmathstutor.com/past-papers/";
export const AQA_SCIENCE_FAMILY_PAGE_URL = "https://www.physicsandmathstutor.com/past-papers/gcse-science/";

export const AQA_PHYSICS_PAPER_1_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-physics-paper-1-higher";
export const AQA_BIOLOGY_PAPER_1_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-biology-paper-1-higher";
export const AQA_BIOLOGY_PAPER_2_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-biology-paper-2-higher";
export const AQA_CHEMISTRY_PAPER_1_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-chemistry-paper-1-higher";
export const AQA_CHEMISTRY_PAPER_2_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-chemistry-paper-2-higher";
export const AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_ADAPTER_KEY =
  "aqa-gcse-computer-science-paper-1b-python";
export const OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY = "ocr-gcse-business-paper-1";
export const OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY = "ocr-gcse-business-paper-2";

export type SupportedImportYear = 2021 | 2022 | 2023 | 2024;
export type BiologyBenchmarkYear = 2021 | 2022 | 2023 | 2024;
export type ChemistryBenchmarkYear = 2023 | 2024;
export type ComputerScienceBenchmarkYear = 2024;
export type OcrBusinessBenchmarkYear = 2023 | 2024;

export type SupportedPaperCandidate =
  | Awaited<ReturnType<typeof discoverAqaPhysicsPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaBiologyPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaBiologyPaper2Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaChemistryPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaChemistryPaper2Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaGcseComputerSciencePaper1BPython>>[number]
  | Awaited<ReturnType<typeof discoverOcrGcseBusinessPaper1>>[number]
  | Awaited<ReturnType<typeof discoverOcrGcseBusinessPaper2>>[number];

export type SupportedPaperDefinition<Year extends SupportedImportYear = SupportedImportYear> = {
  adapterKey: string;
  sourceProvider?: string;
  subjectIndexUrl?: string;
  familyPageUrl: string;
  specCode: string;
  title: (candidate: SupportedPaperCandidate) => string;
  totalMarks: Record<Year, number>;
  discover: () => Promise<SupportedPaperCandidate[]>;
  paperDir: (year: Year) => string;
};

const BIOLOGY_TOTAL_MARKS: Record<BiologyBenchmarkYear, number> = {
  2021: 70,
  2022: 70,
  2023: 70,
  2024: 70,
};

const SCIENCE_TOTAL_MARKS: Record<2023 | 2024, number> = {
  2023: 70,
  2024: 70,
};

const COMPUTER_SCIENCE_TOTAL_MARKS: Record<ComputerScienceBenchmarkYear, number> = {
  2024: 90,
};

const OCR_BUSINESS_TOTAL_MARKS: Record<OcrBusinessBenchmarkYear, number> = {
  2023: 80,
  2024: 80,
};

export const AQA_PHYSICS_PAPER_1_HIGHER_DEFINITION = {
  adapterKey: AQA_PHYSICS_PAPER_1_HIGHER_ADAPTER_KEY,
  familyPageUrl: AQA_SCIENCE_FAMILY_PAGE_URL,
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Physics Paper 1 Higher ${candidate.sessionLabel}`,
  totalMarks: SCIENCE_TOTAL_MARKS,
  discover: discoverAqaPhysicsPaper1Higher,
  paperDir: getPaperDir,
} satisfies SupportedPaperDefinition;

export const AQA_BIOLOGY_PAPER_1_HIGHER_DEFINITION = {
  adapterKey: AQA_BIOLOGY_PAPER_1_HIGHER_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-1/",
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Biology Paper 1 Higher ${candidate.sessionLabel}`,
  totalMarks: BIOLOGY_TOTAL_MARKS,
  discover: discoverAqaBiologyPaper1Higher,
  paperDir: (year) => getPaperDirForAdapter(AQA_BIOLOGY_PAPER_1_HIGHER_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<BiologyBenchmarkYear>;

export const AQA_BIOLOGY_PAPER_2_HIGHER_DEFINITION = {
  adapterKey: AQA_BIOLOGY_PAPER_2_HIGHER_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-2/",
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Biology Paper 2 Higher ${candidate.sessionLabel}`,
  totalMarks: BIOLOGY_TOTAL_MARKS,
  discover: discoverAqaBiologyPaper2Higher,
  paperDir: (year) => getPaperDirForAdapter(AQA_BIOLOGY_PAPER_2_HIGHER_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<BiologyBenchmarkYear>;

export const AQA_CHEMISTRY_PAPER_1_HIGHER_DEFINITION = {
  adapterKey: AQA_CHEMISTRY_PAPER_1_HIGHER_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-1/",
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Chemistry Paper 1 Higher ${candidate.sessionLabel}`,
  totalMarks: SCIENCE_TOTAL_MARKS,
  discover: discoverAqaChemistryPaper1Higher,
  paperDir: (year) => getPaperDirForAdapter(AQA_CHEMISTRY_PAPER_1_HIGHER_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<ChemistryBenchmarkYear>;

export const AQA_CHEMISTRY_PAPER_2_HIGHER_DEFINITION = {
  adapterKey: AQA_CHEMISTRY_PAPER_2_HIGHER_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-2/",
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Chemistry Paper 2 Higher ${candidate.sessionLabel}`,
  totalMarks: SCIENCE_TOTAL_MARKS,
  discover: discoverAqaChemistryPaper2Higher,
  paperDir: (year) => getPaperDirForAdapter(AQA_CHEMISTRY_PAPER_2_HIGHER_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<ChemistryBenchmarkYear>;

export const AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_DEFINITION = {
  adapterKey: AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1",
  specCode: "8525",
  title: (candidate) => `AQA GCSE Computer Science Paper 1B Python ${candidate.sessionLabel}`,
  totalMarks: COMPUTER_SCIENCE_TOTAL_MARKS,
  discover: discoverAqaGcseComputerSciencePaper1BPython,
  paperDir: (year) => getPaperDirForAdapter(AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<ComputerScienceBenchmarkYear>;

export const OCR_GCSE_BUSINESS_PAPER_1_DEFINITION = {
  adapterKey: OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY,
  sourceProvider: "OCR",
  subjectIndexUrl: "https://www.ocr.org.uk/qualifications/past-paper-finder/",
  familyPageUrl: "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
  specCode: "J204",
  title: (candidate) => `OCR GCSE Business Paper 1: Business activity, marketing and people ${candidate.sessionLabel}`,
  totalMarks: OCR_BUSINESS_TOTAL_MARKS,
  discover: discoverOcrGcseBusinessPaper1,
  paperDir: (year) => getPaperDirForAdapter(OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<OcrBusinessBenchmarkYear>;

export const OCR_GCSE_BUSINESS_PAPER_2_DEFINITION = {
  adapterKey: OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY,
  sourceProvider: "OCR",
  subjectIndexUrl: "https://www.ocr.org.uk/qualifications/past-paper-finder/",
  familyPageUrl: "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
  specCode: "J204",
  title: (candidate) => `OCR GCSE Business Paper 2: Operations, finance and influences on business ${candidate.sessionLabel}`,
  totalMarks: OCR_BUSINESS_TOTAL_MARKS,
  discover: discoverOcrGcseBusinessPaper2,
  paperDir: (year) => getPaperDirForAdapter(OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<OcrBusinessBenchmarkYear>;

export const supportedPaperDefinitions = [
  AQA_PHYSICS_PAPER_1_HIGHER_DEFINITION,
  AQA_BIOLOGY_PAPER_1_HIGHER_DEFINITION,
  AQA_BIOLOGY_PAPER_2_HIGHER_DEFINITION,
  AQA_CHEMISTRY_PAPER_1_HIGHER_DEFINITION,
  AQA_CHEMISTRY_PAPER_2_HIGHER_DEFINITION,
  AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_DEFINITION,
  OCR_GCSE_BUSINESS_PAPER_1_DEFINITION,
  OCR_GCSE_BUSINESS_PAPER_2_DEFINITION,
] as const;

export function yearsForDefinition<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
) {
  return Object.keys(definition.totalMarks).map(Number) as Year[];
}
