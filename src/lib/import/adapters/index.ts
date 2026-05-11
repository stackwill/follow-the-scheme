import type { PaperImportAdapter } from "@/lib/import/adapters/base";
import {
  aqaCombinedScienceBiologyPaper1HigherAdapter,
  aqaCombinedScienceBiologyPaper2HigherAdapter,
  aqaCombinedScienceChemistryPaper1HigherAdapter,
  aqaCombinedScienceChemistryPaper2HigherAdapter,
} from "@/lib/import/adapters/aqa-combined-science-biology-paper-higher";
import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";
import { aqaGcseComputerSciencePaper1BPythonAdapter } from "@/lib/import/adapters/aqa-gcse-computer-science-paper-1b-python";
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
  [aqaGcseComputerSciencePaper1BPythonAdapter.key]:
    aqaGcseComputerSciencePaper1BPythonAdapter,
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
export { aqaCombinedSciencePhysicsPaper1HigherAdapter };
export { aqaGcseComputerSciencePaper1BPythonAdapter };
export { ocrGcseBusinessPaper1Adapter, ocrGcseBusinessPaper2Adapter };
