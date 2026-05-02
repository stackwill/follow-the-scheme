import type { PaperImportAdapter } from "@/lib/import/adapters/base";
import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";

export const adapters: Record<string, PaperImportAdapter> = {
  [aqaCombinedSciencePhysicsPaper1HigherAdapter.key]:
    aqaCombinedSciencePhysicsPaper1HigherAdapter,
};

export function getAdapter(key: string) {
  return adapters[key] ?? null;
}

export { aqaCombinedSciencePhysicsPaper1HigherAdapter };
