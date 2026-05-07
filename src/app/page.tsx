import Link from "next/link";
import type { Route } from "next";

import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

function paperHref(paperId: string) {
  return `/papers/${paperId}` as const;
}

function subjectHref(subject: string) {
  return `/?subject=${encodeURIComponent(subject)}` as Route;
}

function paperDisplayName(paper: {
  subject: string;
  paperNumber: number;
  tier: string;
  year: number;
}) {
  const shouldShowTier =
    paper.subject !== "Business" &&
    paper.tier.length > 0 &&
    paper.tier !== "Default";
  const tierLabel = shouldShowTier ? ` ${paper.tier}` : "";

  return `Paper ${paper.paperNumber}${tierLabel} ${paper.year}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const subjectParam = resolvedSearchParams?.subject;
  const selectedSubject = Array.isArray(subjectParam) ? subjectParam[0] : subjectParam;
  const { db } = await import("@/lib/db");
  const papers = await db.paper.findMany({
    include: {
      _count: {
        select: {
          questions: true,
        },
      },
    },
    orderBy: [{ year: "desc" }, { sessionLabel: "desc" }],
  });
  const subjects = [...new Set(papers.map((paper) => paper.subject))].sort((left, right) =>
    left.localeCompare(right),
  );
  const visiblePapers = selectedSubject
    ? papers.filter((paper) => paper.subject === selectedSubject)
    : [];

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="page-header__top">
          <p className="eyebrow">FollowTheScheme</p>
          <ThemeToggle />
        </div>
        <h1>{selectedSubject ? selectedSubject : "Paper library"}</h1>
        <p className="page-description">
          {selectedSubject
            ? "Choose a paper for this subject. The paper list keeps board and tier details in the metadata below each title."
            : "Choose a subject, then open a paper for one-group-at-a-time practice with deterministic question crops and mark schemes."}
        </p>
      </header>

      {selectedSubject ? (
        visiblePapers.length > 0 ? (
          <section className="paper-table-wrap" aria-label={`${selectedSubject} papers`}>
            <div className="library-subnav">
              <Link className="subtle-link" href="/">
                All subjects
              </Link>
              <span>{visiblePapers.length} papers</span>
            </div>
            <table className="paper-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Board</th>
                  <th>Session</th>
                  <th>Questions</th>
                  <th>Marks</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePapers.map((paper) => (
                  <tr key={paper.id}>
                    <td>
                      <strong>{paperDisplayName(paper)}</strong>
                      <span>{paper.examBoard} | {paper.qualification} | {paper.tier}</span>
                    </td>
                    <td>{paper.examBoard}</td>
                    <td>{paper.sessionLabel}</td>
                    <td>{paper._count.questions}</td>
                    <td>{paper.totalMarks}</td>
                    <td>
                      <Link className="table-action" href={paperHref(paper.id)}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state">
            <h2>No papers for {selectedSubject}</h2>
            <p>Choose a subject from the library.</p>
            <Link className="button-link" href="/">
              All subjects
            </Link>
          </section>
        )
      ) : papers.length > 0 ? (
        <section className="subject-list-panel" aria-label="Subjects">
          <ol className="subject-list">
            {subjects.map((subject) => {
              const subjectPapers = papers.filter((paper) => paper.subject === subject);
              const latestYear = Math.max(...subjectPapers.map((paper) => paper.year));
              const totalMarks = subjectPapers.reduce((sum, paper) => sum + paper.totalMarks, 0);

              return (
                <li key={subject}>
                  <Link href={subjectHref(subject)}>
                    <span className="subject-list__name">{subject}</span>
                    <span className="subject-list__meta">
                      {subjectPapers.length} papers | latest {latestYear} | {totalMarks} marks
                    </span>
                    <span className="subject-list__action">Open</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <section className="empty-state">
          <h2>No imported papers yet</h2>
          <p>Use the developer import screen to import one of the supported benchmark papers.</p>
          <Link className="button-link" href="/dev/imports">
            Open developer imports
          </Link>
        </section>
      )}
    </main>
  );
}
