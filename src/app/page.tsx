import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

function paperHref(paperId: string) {
  return `/papers/${paperId}` as const;
}

export default async function HomePage() {
  const { db } = await import("@/lib/db");
  const papers = await db.paper.findMany({
    include: {
      _count: {
        select: {
          questions: true,
          attempts: true,
        },
      },
    },
    orderBy: [{ year: "desc" }, { sessionLabel: "desc" }],
  });

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="page-header__top">
          <p className="eyebrow">FollowTheScheme</p>
          <ThemeToggle />
        </div>
        <h1>Paper library</h1>
        <p className="page-description">
          Imported PMT papers with deterministic question crops, mark schemes, and a one-group-at-a-time practice flow.
        </p>
      </header>

      {papers.length > 0 ? (
        <section className="paper-table-wrap" aria-label="Imported papers">
          <table className="paper-table">
            <thead>
              <tr>
                <th>Paper</th>
                <th>Board</th>
                <th>Session</th>
                <th>Questions</th>
                <th>Marks</th>
                <th>Attempts</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr key={paper.id}>
                  <td>
                    <strong>{paper.subject} Paper {paper.paperNumber}</strong>
                    <span>{paper.qualification} | {paper.tier}</span>
                  </td>
                  <td>{paper.examBoard}</td>
                  <td>{paper.sessionLabel}</td>
                  <td>{paper._count.questions}</td>
                  <td>{paper.totalMarks}</td>
                  <td>{paper._count.attempts}</td>
                  <td>
                    <Link className="table-action" href={paperHref(paper.id)}>
                      Start paper
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="empty-state">
          <h2>No imported papers yet</h2>
          <p>Use the developer import screen to import one of the supported AQA benchmark papers.</p>
          <Link className="button-link" href="/dev/imports">
            Open developer imports
          </Link>
        </section>
      )}
    </main>
  );
}
