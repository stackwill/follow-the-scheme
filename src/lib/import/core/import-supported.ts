import { access } from "node:fs/promises";

import { dataRootPathForAsset } from "@/lib/assets/paths";
import { db } from "@/lib/db";
import { getAdapter } from "@/lib/import/adapters";
import { importSupportedPaper, type ImportPaperResult } from "@/lib/import/core/import-paper";
import {
  supportedPaperDefinitions,
  yearsForDefinition,
  type SupportedImportYear,
  type SupportedPaperDefinition,
} from "@/lib/import/registry";

export type SupportedPaperFilter = {
  adapters?: string[];
  years?: SupportedImportYear[];
  papers?: Array<{ adapterKey: string; year: SupportedImportYear }>;
  force?: boolean;
};

export type SyncSupportedPaperResult =
  | (ImportPaperResult & {
      action: "imported";
      adapterKey: string;
      year: SupportedImportYear;
    })
  | {
      action: "skipped";
      adapterKey: string;
      year: SupportedImportYear;
      paperId: string;
      reason: string;
    };

type ExistingPaperForSync = NonNullable<Awaited<ReturnType<typeof findExistingPaper>>>;

async function fileExists(assetPath: string) {
  try {
    await access(dataRootPathForAsset(assetPath));
    return true;
  } catch {
    return false;
  }
}

function isPaperSelected(adapterKey: string, year: SupportedImportYear, filter: SupportedPaperFilter) {
  if (filter.adapters && !filter.adapters.includes(adapterKey)) {
    return false;
  }

  if (filter.years && !filter.years.includes(year)) {
    return false;
  }

  if (
    filter.papers &&
    !filter.papers.some((paper) => paper.adapterKey === adapterKey && paper.year === year)
  ) {
    return false;
  }

  return true;
}

function selectedDefinitionYears<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  filter: SupportedPaperFilter,
) {
  return yearsForDefinition(definition).filter((year) =>
    isPaperSelected(definition.adapterKey, year, filter),
  ) as Year[];
}

async function findExistingPaper(adapterKey: string, year: SupportedImportYear) {
  return db.paper.findFirst({
    where: {
      adapterKey,
      year,
    },
    include: {
      source: true,
      questions: {
        select: {
          maxMarks: true,
          primaryCropPath: true,
          supportingAssetPaths: true,
        },
      },
    },
  });
}

async function missingAssetReason(existingPaper: ExistingPaperForSync) {
  const paperAssets = [
    ["question paper", existingPaper.questionPaperAssetPath],
    ["mark scheme", existingPaper.markSchemeAssetPath],
  ] as const;

  for (const [label, assetPath] of paperAssets) {
    if (!(await fileExists(assetPath))) {
      return `missing ${label} asset`;
    }
  }

  for (const question of existingPaper.questions) {
    if (!(await fileExists(question.primaryCropPath))) {
      return "missing question crop asset";
    }

    const supportingAssetPaths = JSON.parse(question.supportingAssetPaths) as string[];

    for (const assetPath of supportingAssetPaths) {
      if (!(await fileExists(assetPath))) {
        return "missing supporting crop asset";
      }
    }
  }

  return null;
}

async function currentPaperSkipReason<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  year: Year,
) {
  const adapter = getAdapter(definition.adapterKey);

  if (!adapter) {
    throw new Error(`Missing import adapter ${definition.adapterKey}`);
  }

  const candidates = await definition.discover();
  const candidate = candidates.find((entry) => entry.year === year);

  if (!candidate) {
    return null;
  }

  const existingPaper = await findExistingPaper(definition.adapterKey, year);

  if (!existingPaper) {
    return null;
  }

  const totalQuestionMarks = existingPaper.questions.reduce(
    (sum, question) => sum + question.maxMarks,
    0,
  );

  if (existingPaper.status !== "ready" || existingPaper.source.status !== "ready") {
    return null;
  }

  if (existingPaper.importVersion !== adapter.importVersion) {
    return null;
  }

  if (existingPaper.totalMarks !== definition.totalMarks[year]) {
    return null;
  }

  if (totalQuestionMarks !== definition.totalMarks[year]) {
    return null;
  }

  if (
    existingPaper.source.questionPaperUrl !== candidate.questionPaperUrl ||
    existingPaper.source.markSchemeUrl !== candidate.markSchemeUrl
  ) {
    return null;
  }

  const missingReason = await missingAssetReason(existingPaper);

  if (missingReason) {
    return null;
  }

  return {
    paperId: existingPaper.id,
    reason: "already current",
  };
}

export async function importOneSupportedPaper<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  year: Year,
): Promise<ImportPaperResult> {
  return importSupportedPaper(definition, year);
}

export async function syncOneSupportedPaper<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  year: Year,
  filter: SupportedPaperFilter = {},
): Promise<SyncSupportedPaperResult> {
  if (!filter.force) {
    const skip = await currentPaperSkipReason(definition, year);

    if (skip) {
      return {
        action: "skipped",
        adapterKey: definition.adapterKey,
        year,
        paperId: skip.paperId,
        reason: skip.reason,
      };
    }
  }

  return {
    ...(await importOneSupportedPaper(definition, year)),
    action: "imported",
    adapterKey: definition.adapterKey,
    year,
  };
}

export async function importAllSupportedPapers(
  filter: SupportedPaperFilter = {},
): Promise<SyncSupportedPaperResult[]> {
  const results: SyncSupportedPaperResult[] = [];

  for (const definition of supportedPaperDefinitions) {
    const syncDefinition = definition as unknown as SupportedPaperDefinition<SupportedImportYear>;

    for (const year of selectedDefinitionYears(syncDefinition, filter)) {
      results.push(await syncOneSupportedPaper(syncDefinition, year, filter));
    }
  }

  return results;
}
