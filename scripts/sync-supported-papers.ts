import { db } from "@/lib/db";
import {
  importAllSupportedPapers,
  type SupportedPaperFilter,
} from "@/lib/import/core/import-supported";
import type { SupportedImportYear } from "@/lib/import/registry";

function parseYear(value: string): SupportedImportYear {
  const year = Number(value);

  if (![2021, 2022, 2023, 2024].includes(year)) {
    throw new Error(`Unsupported import year: ${value}`);
  }

  return year as SupportedImportYear;
}

function parseArgs(argv: string[]): SupportedPaperFilter {
  const filter: SupportedPaperFilter = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--adapter" && next) {
      filter.adapters = [...(filter.adapters ?? []), next];
      index += 1;
    } else if (arg === "--year" && next) {
      filter.years = [...(filter.years ?? []), parseYear(next)];
      index += 1;
    } else if (arg === "--paper" && next) {
      const separatorIndex = next.lastIndexOf(":");

      if (separatorIndex <= 0 || separatorIndex === next.length - 1) {
        throw new Error(`Invalid --paper filter. Expected adapter-key:year, received: ${next}`);
      }

      filter.papers = [
        ...(filter.papers ?? []),
        {
          adapterKey: next.slice(0, separatorIndex),
          year: parseYear(next.slice(separatorIndex + 1)),
        },
      ];
      index += 1;
    } else if (arg === "--force") {
      filter.force = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return filter;
}

function printHelpAndExit(): never {
  console.log(`Usage: bun run import:sync -- [filters]

Filters:
  --adapter aqa-gcse-chemistry-paper-2-higher
  --year 2023
  --paper aqa-gcse-chemistry-paper-2-higher:2023
  --force

By default, sync is incremental and skips papers that are already current.
Use --force to rebuild selected papers even when they look unchanged.
`);
  process.exit(0);
}

const results = await importAllSupportedPapers(parseArgs(process.argv.slice(2)));

for (const result of results) {
  if (result.action === "skipped") {
    console.log(
      `Skipped ${result.adapterKey}/${result.year} (${result.reason}): ${result.paperId}`,
    );
  } else {
    console.log(
      `Synced ${result.adapterKey}/${result.year} paper ${result.paperId}: ${result.questionCount} questions, ${result.totalMarks} marks`,
    );
  }
}

await db.$disconnect();
