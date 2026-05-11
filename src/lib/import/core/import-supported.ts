import {
  supportedPaperDefinitions,
  yearsForDefinition,
  type SupportedImportYear,
  type SupportedPaperDefinition,
} from "@/lib/import/registry";

import { importSupportedPaper, type ImportPaperResult } from "@/lib/import/core/import-paper";

export async function importOneSupportedPaper<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  year: Year,
): Promise<ImportPaperResult> {
  return importSupportedPaper(definition, year);
}

export async function importAllSupportedPapers(): Promise<ImportPaperResult[]> {
  const results: ImportPaperResult[] = [];

  for (const definition of supportedPaperDefinitions) {
    for (const year of yearsForDefinition(definition)) {
      results.push(await importOneSupportedPaper(definition, year));
    }
  }

  return results;
}
