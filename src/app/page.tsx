import { PaperCard } from "@/components/library/paper-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { db } = await import("@/lib/db");
  const papers = await db.paper.findMany({
    orderBy: [{ year: "desc" }, { sessionLabel: "desc" }],
  });

  return (
    <main className="page-shell">
      <header className="page-header">
        <p>FollowTheScheme</p>
        <h1>Imported Papers</h1>
        <p className="page-description">
          A plain working library of imported benchmark papers, ready for internal review and practice flows.
        </p>
      </header>

      {papers.length > 0 ? (
        <section className="paper-grid" aria-label="Imported papers">
          {papers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No imported papers yet</h2>
          <p>Use the developer import screen to import one of the supported AQA benchmark papers.</p>
          <a className="button-link" href="/dev/imports">
            Open developer imports
          </a>
        </section>
      )}
    </main>
  );
}
