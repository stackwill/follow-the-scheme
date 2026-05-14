import { getPaperDir, getPaperDirForAdapter } from "@/lib/import/core/storage";
import {
  discoverAqaBiologyPaper1Higher,
  discoverAqaBiologyPaper2Higher,
  discoverAqaChemistryPaper1Higher,
  discoverAqaChemistryPaper2Higher,
  discoverAqaGcseComputerSciencePaper1BPython,
  discoverAqaReligiousStudiesShortCourseChristianity,
  discoverAqaReligiousStudiesShortCourseJudaism,
  discoverAqaReligiousStudiesShortCourseThemes,
  discoverAqaPhysicsPaper1Higher,
  discoverAqaPhysicsPaper2Higher,
  discoverEdexcelAGeographyPaper1,
  discoverEdexcelGcseHistoryPaper1Medicine,
  discoverOcrGcseBusinessPaper1,
  discoverOcrGcseBusinessPaper2,
} from "@/lib/import/pmt/discovery";

export const DEFAULT_SOURCE_PROVIDER = "PMT";
export const DEFAULT_SUBJECT_INDEX_URL = "https://www.physicsandmathstutor.com/past-papers/";
export const AQA_SCIENCE_FAMILY_PAGE_URL = "https://www.physicsandmathstutor.com/past-papers/gcse-science/";

export const AQA_PHYSICS_PAPER_1_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-physics-paper-1-higher";
export const AQA_PHYSICS_PAPER_2_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-physics-paper-2-higher";
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
export const AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_CHRISTIANITY_ADAPTER_KEY =
  "aqa-gcse-religious-studies-short-course-christianity";
export const AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_JUDAISM_ADAPTER_KEY =
  "aqa-gcse-religious-studies-short-course-judaism";
export const AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_ADAPTER_KEY =
  "aqa-gcse-religious-studies-short-course-themes";
export const EDEXCEL_A_GEOGRAPHY_PAPER_1_ADAPTER_KEY =
  "edexcel-a-geography-paper-1-physical-environment";
export const EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_ADAPTER_KEY =
  "edexcel-gcse-history-paper-1-medicine";
export const OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY = "ocr-gcse-business-paper-1";
export const OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY = "ocr-gcse-business-paper-2";

export type SupportedImportYear = 2021 | 2022 | 2023 | 2024;
export type PhysicsBenchmarkYear = 2022 | 2023 | 2024;
export type PhysicsPaper2BenchmarkYear = 2022 | 2023 | 2024;
export type BiologyBenchmarkYear = 2021 | 2022 | 2023 | 2024;
export type ChemistryBenchmarkYear = 2023 | 2024;
export type ComputerScienceBenchmarkYear = 2022 | 2023 | 2024;
export type EdexcelAGeographyPaper1Year = 2023 | 2024;
export type EdexcelGcseHistoryPaper1MedicineYear = 2023 | 2024;
export type OcrBusinessBenchmarkYear = 2023 | 2024;
export type AqaReligiousStudiesShortCourseYear = 2024;

export type SupportedPaperCandidate =
  | Awaited<ReturnType<typeof discoverAqaPhysicsPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaPhysicsPaper2Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaBiologyPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaBiologyPaper2Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaChemistryPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaChemistryPaper2Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaGcseComputerSciencePaper1BPython>>[number]
  | Awaited<ReturnType<typeof discoverAqaReligiousStudiesShortCourseChristianity>>[number]
  | Awaited<ReturnType<typeof discoverAqaReligiousStudiesShortCourseJudaism>>[number]
  | Awaited<ReturnType<typeof discoverAqaReligiousStudiesShortCourseThemes>>[number]
  | Awaited<ReturnType<typeof discoverEdexcelAGeographyPaper1>>[number]
  | Awaited<ReturnType<typeof discoverEdexcelGcseHistoryPaper1Medicine>>[number]
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

const SCIENCE_TOTAL_MARKS: Record<PhysicsBenchmarkYear, number> = {
  2022: 70,
  2023: 70,
  2024: 70,
};

const PHYSICS_PAPER_2_TOTAL_MARKS: Record<PhysicsPaper2BenchmarkYear, number> = {
  2022: 70,
  2023: 70,
  2024: 70,
};

const COMPUTER_SCIENCE_TOTAL_MARKS: Record<ComputerScienceBenchmarkYear, number> = {
  2022: 90,
  2023: 90,
  2024: 90,
};

const EDEXCEL_A_GEOGRAPHY_PAPER_1_TOTAL_MARKS: Record<EdexcelAGeographyPaper1Year, number> = {
  2023: 102,
  2024: 102,
};

const EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_TOTAL_MARKS: Record<
  EdexcelGcseHistoryPaper1MedicineYear,
  number
> = {
  2023: 72,
  2024: 72,
};

const OCR_BUSINESS_TOTAL_MARKS: Record<OcrBusinessBenchmarkYear, number> = {
  2023: 80,
  2024: 80,
};

const AQA_RELIGIOUS_STUDIES_SHORT_COURSE_RELIGION_TOTAL_MARKS: Record<
  AqaReligiousStudiesShortCourseYear,
  number
> = {
  2024: 27,
};

const AQA_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_TOTAL_MARKS: Record<
  AqaReligiousStudiesShortCourseYear,
  number
> = {
  2024: 48,
};

export const AQA_PHYSICS_PAPER_1_HIGHER_DEFINITION = {
  adapterKey: AQA_PHYSICS_PAPER_1_HIGHER_ADAPTER_KEY,
  familyPageUrl: AQA_SCIENCE_FAMILY_PAGE_URL,
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Physics Paper 1 Higher ${candidate.sessionLabel}`,
  totalMarks: SCIENCE_TOTAL_MARKS,
  discover: discoverAqaPhysicsPaper1Higher,
  paperDir: getPaperDir,
} satisfies SupportedPaperDefinition<PhysicsBenchmarkYear>;

export const AQA_PHYSICS_PAPER_2_HIGHER_DEFINITION = {
  adapterKey: AQA_PHYSICS_PAPER_2_HIGHER_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-2/",
  specCode: "8464",
  title: (candidate) => `AQA Combined Science Trilogy Physics Paper 2 Higher ${candidate.sessionLabel}`,
  totalMarks: PHYSICS_PAPER_2_TOTAL_MARKS,
  discover: discoverAqaPhysicsPaper2Higher,
  paperDir: (year) => getPaperDirForAdapter(AQA_PHYSICS_PAPER_2_HIGHER_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<PhysicsPaper2BenchmarkYear>;

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

export const AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_CHRISTIANITY_DEFINITION = {
  adapterKey: AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_CHRISTIANITY_ADAPTER_KEY,
  sourceProvider: "AQA",
  subjectIndexUrl: "https://www.aqa.org.uk/past-papers-and-mark-schemes-finder",
  familyPageUrl:
    "https://www.aqa.org.uk/subjects/religious-studies/gcse/religious-studies-short-course-8061/assessment-resources",
  specCode: "8061",
  title: (candidate) =>
    `AQA GCSE Religious Studies Short Course Section 2 Christianity ${candidate.sessionLabel}`,
  totalMarks: AQA_RELIGIOUS_STUDIES_SHORT_COURSE_RELIGION_TOTAL_MARKS,
  discover: discoverAqaReligiousStudiesShortCourseChristianity,
  paperDir: (year) =>
    getPaperDirForAdapter(AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_CHRISTIANITY_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<AqaReligiousStudiesShortCourseYear>;

export const AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_JUDAISM_DEFINITION = {
  adapterKey: AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_JUDAISM_ADAPTER_KEY,
  sourceProvider: "AQA",
  subjectIndexUrl: "https://www.aqa.org.uk/past-papers-and-mark-schemes-finder",
  familyPageUrl:
    "https://www.aqa.org.uk/subjects/religious-studies/gcse/religious-studies-short-course-8061/assessment-resources",
  specCode: "8061",
  title: (candidate) =>
    `AQA GCSE Religious Studies Short Course Section 4 Judaism ${candidate.sessionLabel}`,
  totalMarks: AQA_RELIGIOUS_STUDIES_SHORT_COURSE_RELIGION_TOTAL_MARKS,
  discover: discoverAqaReligiousStudiesShortCourseJudaism,
  paperDir: (year) =>
    getPaperDirForAdapter(AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_JUDAISM_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<AqaReligiousStudiesShortCourseYear>;

export const AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_DEFINITION = {
  adapterKey: AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_ADAPTER_KEY,
  sourceProvider: "AQA",
  subjectIndexUrl: "https://www.aqa.org.uk/past-papers-and-mark-schemes-finder",
  familyPageUrl:
    "https://www.aqa.org.uk/subjects/religious-studies/gcse/religious-studies-short-course-8061/assessment-resources",
  specCode: "8061",
  title: (candidate) =>
    `AQA GCSE Religious Studies Short Course Section 5 Themes ${candidate.sessionLabel}`,
  totalMarks: AQA_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_TOTAL_MARKS,
  discover: discoverAqaReligiousStudiesShortCourseThemes,
  paperDir: (year) =>
    getPaperDirForAdapter(AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<AqaReligiousStudiesShortCourseYear>;

export const EDEXCEL_A_GEOGRAPHY_PAPER_1_DEFINITION = {
  adapterKey: EDEXCEL_A_GEOGRAPHY_PAPER_1_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-geography/edexcel-a-paper-1/",
  specCode: "1GA0/01",
  title: (candidate) => `Edexcel A GCSE Geography Paper 1: The Physical Environment ${candidate.sessionLabel}`,
  totalMarks: EDEXCEL_A_GEOGRAPHY_PAPER_1_TOTAL_MARKS,
  discover: discoverEdexcelAGeographyPaper1,
  paperDir: (year) => getPaperDirForAdapter(EDEXCEL_A_GEOGRAPHY_PAPER_1_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<EdexcelAGeographyPaper1Year>;

export const EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_DEFINITION = {
  adapterKey: EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_ADAPTER_KEY,
  familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-history/edexcel-paper-1/",
  specCode: "1HI0/11",
  title: (candidate) =>
    `Edexcel GCSE History Paper 1: Medicine in Britain and the British sector of the Western Front ${candidate.sessionLabel}`,
  totalMarks: EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_TOTAL_MARKS,
  discover: discoverEdexcelGcseHistoryPaper1Medicine,
  paperDir: (year) =>
    getPaperDirForAdapter(EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_ADAPTER_KEY, year),
} satisfies SupportedPaperDefinition<EdexcelGcseHistoryPaper1MedicineYear>;

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
  AQA_PHYSICS_PAPER_2_HIGHER_DEFINITION,
  AQA_BIOLOGY_PAPER_1_HIGHER_DEFINITION,
  AQA_BIOLOGY_PAPER_2_HIGHER_DEFINITION,
  AQA_CHEMISTRY_PAPER_1_HIGHER_DEFINITION,
  AQA_CHEMISTRY_PAPER_2_HIGHER_DEFINITION,
  AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_DEFINITION,
  AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_CHRISTIANITY_DEFINITION,
  AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_JUDAISM_DEFINITION,
  AQA_GCSE_RELIGIOUS_STUDIES_SHORT_COURSE_THEMES_DEFINITION,
  EDEXCEL_A_GEOGRAPHY_PAPER_1_DEFINITION,
  EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_DEFINITION,
  OCR_GCSE_BUSINESS_PAPER_1_DEFINITION,
  OCR_GCSE_BUSINESS_PAPER_2_DEFINITION,
] as const;

export function yearsForDefinition<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
) {
  return Object.keys(definition.totalMarks).map(Number) as Year[];
}
