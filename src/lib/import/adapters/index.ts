import type { PaperImportAdapter } from "@/lib/import/adapters/base";
import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";
import { aqaGcseComputerSciencePaper1BPythonAdapter } from "@/lib/import/adapters/aqa-gcse-computer-science-paper-1b-python";

export const adapters: Record<string, PaperImportAdapter> = {
  [aqaCombinedSciencePhysicsPaper1HigherAdapter.key]:
    aqaCombinedSciencePhysicsPaper1HigherAdapter,
  [aqaGcseComputerSciencePaper1BPythonAdapter.key]:
    aqaGcseComputerSciencePaper1BPythonAdapter,
};

export function getAdapter(key: string) {
  return adapters[key] ?? null;
}

export { aqaCombinedSciencePhysicsPaper1HigherAdapter };
export { aqaGcseComputerSciencePaper1BPythonAdapter };
