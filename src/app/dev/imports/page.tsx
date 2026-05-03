import { ImportStatusTable } from "@/components/dev/import-status-table";
import { importBenchmarkPaper } from "@/app/dev/imports/actions";

export const dynamic = "force-dynamic";

export default async function DevImportsPage() {
  const { db } = await import("@/lib/db");
  const sources = await db.paperSource.findMany({
    where: {
      examBoard: "AQA",
      subject: "Combined Science Trilogy Physics",
      paperNumber: 1,
      tier: "Higher",
      year: {
        in: [2023, 2024],
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
        },
      },
    },
    orderBy: [{ year: "desc" }],
  });

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
          <ImportStatusTable sources={sources} />
        </section>
      </div>
    </main>
  );
}
