import Link from "next/link";
import type { Route } from "next";

import { ScrollCue } from "@/components/scroll-cue";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

function paperHref(paperId: string) {
  return `/papers/${paperId}` as const;
}

function subjectHref(subject: string) {
  return `/?subject=${encodeURIComponent(subject)}` as Route;
}

function subjectPaperHref(subject: string, paperNumber: number) {
  return `/?subject=${encodeURIComponent(subject)}&paper=${paperNumber}` as Route;
}

function paperChoiceDisplayName(subject: string, paperNumber: number) {
  if (subject === "Religious Studies") {
    if (paperNumber === 2) {
      return "Christianity";
    }

    if (paperNumber === 4) {
      return "Judaism";
    }

    if (paperNumber === 5) {
      return "Themes";
    }
  }

  return `Paper ${paperNumber}`;
}

function subjectDisplayParts(subject: string) {
  if (["Biology", "Chemistry", "Physics"].includes(subject)) {
    return {
      name: subject,
      detail: "combined science",
    };
  }

  if (subject === "Computer Science") {
    return {
      name: "Computer Science",
      detail: null,
    };
  }

  if (subject === "Business") {
    return {
      name: "Business",
      detail: null,
    };
  }

  return {
    name: subject,
    detail: null,
  };
}

function subjectDisplayName(subject: string) {
  const parts = subjectDisplayParts(subject);

  return parts.detail ? `${parts.name} ${parts.detail}` : parts.name;
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

function currentStudyNote() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutesSinceMidnight = hour * 60 + minute;
  const isNight = minutesSinceMidnight >= 22 * 60 || minutesSinceMidnight < 6 * 60 + 30;
  const isEarly = minutesSinceMidnight >= 6 * 60 + 30 && minutesSinceMidnight < 9 * 60;
  const isLateAfternoon = minutesSinceMidnight >= 16 * 60 && minutesSinceMidnight < 19 * 60;

  if (isNight) {
    return {
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      title: "It is late",
      note: "Sleep is probably worth more than another rushed paper. Do a short question if you must, then stop.",
    };
  }

  if (isEarly) {
    return {
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      title: "Morning reset",
      note: "Good time for one focused question before the day gets busy.",
    };
  }

  if (isLateAfternoon) {
    return {
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      title: "After-school slot",
      note: "Pick one paper section and get it marked before you switch off.",
    };
  }

  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    title: "Study window",
    note: "Choose one subject and finish a marked question group.",
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[]; paper?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const subjectParam = resolvedSearchParams?.subject;
  const paperParam = resolvedSearchParams?.paper;
  const selectedSubject = Array.isArray(subjectParam) ? subjectParam[0] : subjectParam;
  const selectedPaperNumberValue = Array.isArray(paperParam) ? paperParam[0] : paperParam;
  const selectedPaperNumber = selectedPaperNumberValue ? Number(selectedPaperNumberValue) : null;
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
    ? papers.filter(
        (paper) =>
          paper.subject === selectedSubject &&
          selectedPaperNumber !== null &&
          paper.paperNumber === selectedPaperNumber,
      )
    : [];
  const selectedSubjectPapers = selectedSubject ? papers.filter((paper) => paper.subject === selectedSubject) : [];
  const availablePaperNumbers = [
    ...new Set(selectedSubjectPapers.map((paper) => paper.paperNumber)),
  ].sort((left, right) => left - right);
  const shouldChoosePaperNumber = selectedSubject && selectedPaperNumber === null;
  const selectedSubjectParts = selectedSubject ? subjectDisplayParts(selectedSubject) : null;
  const studyNote = currentStudyNote();

  return (
    <main className="page-shell learning-page">
      <nav className="app-topbar" aria-label="App navigation">
        <Link className="brand-mark" href="/">
          <span className="brand-spark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>ihategcse</strong>
        </Link>
        <div className="app-topbar__actions">
          <span className="xp-chip">{papers.length} papers</span>
          <ThemeToggle />
        </div>
      </nav>

      <header className="course-hero">
        <div className="course-hero__icon" aria-hidden="true">
          {selectedSubject ? selectedSubject.slice(0, 2).toUpperCase() : "😡"}
        </div>
        <div className="course-hero__copy">
          <div className="breadcrumb-line">
            <Link href="/">Home</Link>
            {selectedSubject ? <span>/ {subjectDisplayName(selectedSubject)}</span> : <span>/ Past papers</span>}
          </div>
          <div className="course-title-row">
            <h1>
              {selectedSubjectParts ? (
                <>
                  {selectedSubjectParts.name}
                  {selectedSubjectParts.detail ? (
                    <span className="title-muted"> {selectedSubjectParts.detail}</span>
                  ) : null}
                </>
              ) : (
                "We'll mark it for you"
              )}
            </h1>
            <span className="active-course-pill">ihategcse</span>
          </div>
          <p className="page-description">
            {selectedSubject
              ? "Choose a paper, answer it in chunks, and get marking that stays close to the real mark scheme."
              : "Choose your subject, open a paper, and we'll use the actual mark scheme to mark your answers."}
          </p>
        </div>
        <aside className="study-callout time-callout">
          <span className="time-callout__time">{studyNote.time}</span>
          <strong>{studyNote.title}</strong>
          <span>{studyNote.note}</span>
        </aside>
      </header>

      {!selectedSubject ? <ScrollCue targetId="subject-library" /> : null}

      {selectedSubject ? (
        shouldChoosePaperNumber ? (
          <section className="paper-choice-panel" aria-label={`${subjectDisplayName(selectedSubject)} paper choices`}>
            <div className="library-subnav">
              <Link className="subtle-link" href="/">
                All subjects
              </Link>
              <span>Choose a paper</span>
            </div>
            <div className="paper-choice-grid">
              {availablePaperNumbers.map((paperNumber) => {
                const matchingPapers = selectedSubjectPapers.filter((paper) => paper.paperNumber === paperNumber);
                const latestYear = Math.max(...matchingPapers.map((paper) => paper.year));
                const totalMarks = matchingPapers.reduce((sum, paper) => sum + paper.totalMarks, 0);

                return (
                  <Link className="paper-choice-card" href={subjectPaperHref(selectedSubject, paperNumber)} key={paperNumber}>
                    <span>{paperChoiceDisplayName(selectedSubject, paperNumber)}</span>
                    <strong>{matchingPapers.length} papers</strong>
                    <small className="metric-list">
                      <span>latest {latestYear}</span>
                      <span>{totalMarks} marks</span>
                    </small>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : visiblePapers.length > 0 ? (
          <section className="paper-table-wrap" aria-label={`${subjectDisplayName(selectedSubject)} papers`}>
            <div className="library-subnav">
              <Link className="subtle-link" href={subjectHref(selectedSubject)}>
                Change paper
              </Link>
              <span className="metric-list">
                <span>
                  {selectedPaperNumber === null
                    ? "Paper"
                    : paperChoiceDisplayName(selectedSubject, selectedPaperNumber)}
                </span>
                <span>{visiblePapers.length} papers</span>
              </span>
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
                      <span className="metric-list">
                        <span>{paper.examBoard}</span>
                        <span>{paper.qualification}</span>
                        <span>{paper.tier}</span>
                      </span>
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
            <h2>No papers for {subjectDisplayName(selectedSubject)}</h2>
            <p>Choose a subject from the library.</p>
            <Link className="button-link" href="/">
              All subjects
            </Link>
          </section>
        )
      ) : papers.length > 0 ? (
        <section className="subject-list-panel" id="subject-library" aria-label="Subjects">
          <div className="subject-library-heading">
            <div>
              <h2>Subject library</h2>
              <p>Pick a course to see available papers.</p>
            </div>
            <span>{subjects.length} subjects</span>
          </div>
          <ol className="subject-list">
            {subjects.map((subject) => {
              const subjectPapers = papers.filter((paper) => paper.subject === subject);
              const latestYear = Math.max(...subjectPapers.map((paper) => paper.year));
              const totalMarks = subjectPapers.reduce((sum, paper) => sum + paper.totalMarks, 0);

              return (
                <li key={subject}>
                  <Link href={subjectHref(subject)}>
                    <span className="subject-list__name">
                      {subjectDisplayParts(subject).name}
                      {subjectDisplayParts(subject).detail ? (
                        <span className="subject-list__detail"> {subjectDisplayParts(subject).detail}</span>
                      ) : null}
                    </span>
                    <span className="subject-list__meta">
                      <span>{subjectPapers.length} papers</span>
                      <span>Latest {latestYear}</span>
                      <span>{totalMarks} marks</span>
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
