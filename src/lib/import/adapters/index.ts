import type { PaperImportAdapter } from "@/lib/import/adapters/base";
import {
  aqaCombinedScienceBiologyPaper1HigherAdapter,
  aqaCombinedScienceBiologyPaper2HigherAdapter,
  aqaCombinedScienceChemistryPaper1HigherAdapter,
  aqaCombinedScienceChemistryPaper2HigherAdapter,
  aqaGcseChemistryPaper1HigherAdapter,
  aqaGcseChemistryPaper2HigherAdapter,
  aqaGcsePhysicsPaper2HigherAdapter,
} from "@/lib/import/adapters/aqa-combined-science-biology-paper-higher";
import {
  aqaCombinedSciencePhysicsPaper1HigherAdapter,
  aqaCombinedSciencePhysicsPaper2HigherAdapter,
} from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";
import {
  aqaGcseComputerSciencePaper1BPythonAdapter,
  aqaGcseComputerSciencePaper2Adapter,
} from "@/lib/import/adapters/aqa-gcse-computer-science-paper-1b-python";
import {
  aqaGcseReligiousStudiesShortCourseChristianityAdapter,
  aqaGcseReligiousStudiesShortCourseJudaismAdapter,
  aqaGcseReligiousStudiesShortCourseThemesAdapter,
} from "@/lib/import/adapters/aqa-gcse-religious-studies-short-course";
import { caieIgcseEnglishLanguagePaper2Adapter } from "@/lib/import/adapters/caie-igcse-english-language-paper-2";
import { edexcelAGeographyPaper1Adapter } from "@/lib/import/adapters/edexcel-a-geography-paper-1";
import { edexcelGcseEnglishLiteraturePaper2JekyllConflictAdapter } from "@/lib/import/adapters/edexcel-english-literature-paper-2-jekyll-conflict";
import { edexcelGcseHistoryPaper1MedicineAdapter } from "@/lib/import/adapters/edexcel-history-paper-1-medicine";
import {
  edexcelGcseHistoryPaper2ColdWarElizabethAdapter,
  edexcelGcseHistoryPaper3GermanyAdapter,
} from "@/lib/import/adapters/edexcel-history-papers-2-and-3";
import {
  edexcelGcseMathsPaper2HigherAdapter,
  edexcelGcseMathsPaper2HigherNovember2024Adapter,
} from "@/lib/import/adapters/edexcel-gcse-maths-paper-2-higher";
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
  [aqaGcseChemistryPaper1HigherAdapter.key]: aqaGcseChemistryPaper1HigherAdapter,
  [aqaGcseChemistryPaper2HigherAdapter.key]: aqaGcseChemistryPaper2HigherAdapter,
  [aqaGcsePhysicsPaper2HigherAdapter.key]: aqaGcsePhysicsPaper2HigherAdapter,
  [aqaCombinedSciencePhysicsPaper1HigherAdapter.key]:
    aqaCombinedSciencePhysicsPaper1HigherAdapter,
  [aqaCombinedSciencePhysicsPaper2HigherAdapter.key]:
    aqaCombinedSciencePhysicsPaper2HigherAdapter,
  [aqaGcseComputerSciencePaper1BPythonAdapter.key]:
    aqaGcseComputerSciencePaper1BPythonAdapter,
  [aqaGcseComputerSciencePaper2Adapter.key]: aqaGcseComputerSciencePaper2Adapter,
  [aqaGcseReligiousStudiesShortCourseChristianityAdapter.key]:
    aqaGcseReligiousStudiesShortCourseChristianityAdapter,
  [aqaGcseReligiousStudiesShortCourseJudaismAdapter.key]:
    aqaGcseReligiousStudiesShortCourseJudaismAdapter,
  [aqaGcseReligiousStudiesShortCourseThemesAdapter.key]:
    aqaGcseReligiousStudiesShortCourseThemesAdapter,
  [caieIgcseEnglishLanguagePaper2Adapter.key]: caieIgcseEnglishLanguagePaper2Adapter,
  [edexcelAGeographyPaper1Adapter.key]: edexcelAGeographyPaper1Adapter,
  [edexcelGcseEnglishLiteraturePaper2JekyllConflictAdapter.key]:
    edexcelGcseEnglishLiteraturePaper2JekyllConflictAdapter,
  [edexcelGcseHistoryPaper1MedicineAdapter.key]: edexcelGcseHistoryPaper1MedicineAdapter,
  [edexcelGcseHistoryPaper2ColdWarElizabethAdapter.key]:
    edexcelGcseHistoryPaper2ColdWarElizabethAdapter,
  [edexcelGcseHistoryPaper3GermanyAdapter.key]: edexcelGcseHistoryPaper3GermanyAdapter,
  [edexcelGcseMathsPaper2HigherAdapter.key]: edexcelGcseMathsPaper2HigherAdapter,
  [edexcelGcseMathsPaper2HigherNovember2024Adapter.key]:
    edexcelGcseMathsPaper2HigherNovember2024Adapter,
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
  aqaGcseChemistryPaper1HigherAdapter,
  aqaGcseChemistryPaper2HigherAdapter,
  aqaGcsePhysicsPaper2HigherAdapter,
};
export {
  aqaCombinedSciencePhysicsPaper1HigherAdapter,
  aqaCombinedSciencePhysicsPaper2HigherAdapter,
};
export { aqaGcseComputerSciencePaper1BPythonAdapter, aqaGcseComputerSciencePaper2Adapter };
export {
  aqaGcseReligiousStudiesShortCourseChristianityAdapter,
  aqaGcseReligiousStudiesShortCourseJudaismAdapter,
  aqaGcseReligiousStudiesShortCourseThemesAdapter,
};
export { caieIgcseEnglishLanguagePaper2Adapter };
export { edexcelAGeographyPaper1Adapter };
export { edexcelGcseEnglishLiteraturePaper2JekyllConflictAdapter };
export { edexcelGcseHistoryPaper1MedicineAdapter };
export {
  edexcelGcseHistoryPaper2ColdWarElizabethAdapter,
  edexcelGcseHistoryPaper3GermanyAdapter,
};
export { edexcelGcseMathsPaper2HigherAdapter };
export { edexcelGcseMathsPaper2HigherNovember2024Adapter };
export { ocrGcseBusinessPaper1Adapter, ocrGcseBusinessPaper2Adapter };
