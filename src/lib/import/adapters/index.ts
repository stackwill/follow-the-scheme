import type { PaperImportAdapter } from "@/lib/import/adapters/base";
import {
  aqaCombinedScienceBiologyPaper1HigherAdapter,
  aqaCombinedScienceBiologyPaper2HigherAdapter,
  aqaCombinedScienceChemistryPaper1HigherAdapter,
  aqaCombinedScienceChemistryPaper2HigherAdapter,
} from "@/lib/import/adapters/aqa-combined-science-biology-paper-higher";
import {
  aqaCombinedSciencePhysicsPaper1HigherAdapter,
  aqaCombinedSciencePhysicsPaper2HigherAdapter,
} from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";
import { aqaGcseComputerSciencePaper1BPythonAdapter } from "@/lib/import/adapters/aqa-gcse-computer-science-paper-1b-python";
import {
  aqaGcseReligiousStudiesShortCourseChristianityAdapter,
  aqaGcseReligiousStudiesShortCourseJudaismAdapter,
  aqaGcseReligiousStudiesShortCourseThemesAdapter,
} from "@/lib/import/adapters/aqa-gcse-religious-studies-short-course";
import { edexcelAGeographyPaper1Adapter } from "@/lib/import/adapters/edexcel-a-geography-paper-1";
import {
  ocrGcseBusinessPaper1Adapter,
  ocrGcseBusinessPaper2Adapter,
} from "@/lib/import/adapters/ocr-gcse-business";

export const adapters: Record<string, PaperImportAdapter> = {
  [aqaCombinedScienceBiologyPaper1HigherAdapter.key]:
    aqaCombinedScienceBiologyPaper1HigherAdapter,
  [aqaCombinedScienceBiologyPaper2HigherAdapter.key]:
    aqaCombinedScienceBiologyPaper2HigherAdapter,
  [aqaCombinedScienceChemistryPaper1HigherAdapter.key]:
    aqaCombinedScienceChemistryPaper1HigherAdapter,
  [aqaCombinedScienceChemistryPaper2HigherAdapter.key]:
    aqaCombinedScienceChemistryPaper2HigherAdapter,
  [aqaCombinedSciencePhysicsPaper1HigherAdapter.key]:
    aqaCombinedSciencePhysicsPaper1HigherAdapter,
  [aqaCombinedSciencePhysicsPaper2HigherAdapter.key]:
    aqaCombinedSciencePhysicsPaper2HigherAdapter,
  [aqaGcseComputerSciencePaper1BPythonAdapter.key]:
    aqaGcseComputerSciencePaper1BPythonAdapter,
  [aqaGcseReligiousStudiesShortCourseChristianityAdapter.key]:
    aqaGcseReligiousStudiesShortCourseChristianityAdapter,
  [aqaGcseReligiousStudiesShortCourseJudaismAdapter.key]:
    aqaGcseReligiousStudiesShortCourseJudaismAdapter,
  [aqaGcseReligiousStudiesShortCourseThemesAdapter.key]:
    aqaGcseReligiousStudiesShortCourseThemesAdapter,
  [edexcelAGeographyPaper1Adapter.key]: edexcelAGeographyPaper1Adapter,
  [ocrGcseBusinessPaper1Adapter.key]: ocrGcseBusinessPaper1Adapter,
  [ocrGcseBusinessPaper2Adapter.key]: ocrGcseBusinessPaper2Adapter,
};

export function getAdapter(key: string) {
  return adapters[key] ?? null;
}

export {
  aqaCombinedScienceBiologyPaper1HigherAdapter,
  aqaCombinedScienceBiologyPaper2HigherAdapter,
  aqaCombinedScienceChemistryPaper1HigherAdapter,
  aqaCombinedScienceChemistryPaper2HigherAdapter,
};
export {
  aqaCombinedSciencePhysicsPaper1HigherAdapter,
  aqaCombinedSciencePhysicsPaper2HigherAdapter,
};
export { aqaGcseComputerSciencePaper1BPythonAdapter };
export {
  aqaGcseReligiousStudiesShortCourseChristianityAdapter,
  aqaGcseReligiousStudiesShortCourseJudaismAdapter,
  aqaGcseReligiousStudiesShortCourseThemesAdapter,
};
export { edexcelAGeographyPaper1Adapter };
export { ocrGcseBusinessPaper1Adapter, ocrGcseBusinessPaper2Adapter };
