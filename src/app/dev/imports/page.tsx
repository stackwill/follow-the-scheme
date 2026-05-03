import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImportStatusTable } from "@/components/dev/import-status-table";
import { importBenchmarkPaper } from "@/app/dev/imports/actions";
import { logsRoot } from "@/lib/paths";

export const dynamic = "force-dynamic";

const BENCHMARK_YEARS = [2024, 2023] as const;
const ADAPTER_KEY = "aqa-combined-science-physics-paper-1-higher";

async function readFailureDiagnostics(year: (typeof BENCHMARK_YEARS)[number]) {
  const diagnosticsPath = path.join(logsRoot, "imports", `${ADAPTER_KEY}-${year}-failure.json`);

  try {
    return JSON.parse(await readFile(diagnosticsPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    return {
      stage: "diagnostics",
      message: "Unable to read stored import failure diagnostics.",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function DevImportsPage() {
  const { db } = await import("@/lib/db");
  const [sources, failureDiagnostics] = await Promise.all([
    db.paperSource.findMany({
      where: {
        examBoard: "AQA",
        subject: "Combined Science Trilogy Physics",
        paperNumber: 1,
        tier: "Higher",
        year: {
          in: [...BENCHMARK_YEARS],
        },
      },
      include: {
        paper: {
          select: {
            id: true,
            title: true,
            status: true,
            importedAt: true,
            totalMarks: true,
            questions: {
              select: {
                questionKey: true,
                importDiagnostics: true,
              },
              orderBy: [{ displayOrder: "asc" }],
            },
          },
        },
      },
      orderBy: [{ year: "desc" }],
    }),
    Promise.all(BENCHMARK_YEARS.map(async (year) => [year, await readFailureDiagnostics(year)] as const)),
  ]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Internal tool</p>
        <h1>Developer Imports</h1>
        <p className="page-description">
          Import or refresh the supported AQA Combined Science Trilogy Physics Paper 1 Higher benchmark papers.
        </p>
      </header>

      <div className="dev-stack">
        <section className="dev-panel">
          <h2>Benchmark imports</h2>
          <p>These actions are intentionally narrow so we only import reviewed benchmark years.</p>
          <form className="import-form" action={importBenchmarkPaper}>
            <button name="year" value="2023">
              Import June 2023
            </button>
            <button name="year" value="2024">
              Import June 2024
            </button>
          </form>
        </section>

        <section className="dev-panel">
          <h2>Import status</h2>
          <p>Shows the latest database status, saved failure report, and question-level importer warnings.</p>
          <ImportStatusTable sources={sources} failureDiagnostics={Object.fromEntries(failureDiagnostics)} />
        </section>
      </div>
    </main>
  );
}
