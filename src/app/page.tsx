import Link from "next/link";
import type { Route } from "next";

import { ExamCountdown } from "@/components/exam-countdown";
import { DemoNotice } from "@/components/demo/demo-notice";
import { ScrollCue } from "@/components/scroll-cue";
import { ThemeToggle } from "@/components/theme-toggle";
import { nextExamFromSchedule } from "@/lib/exam-schedule";

export const dynamic = "force-dynamic";

function paperHref(paperId: string) {
  return `/papers/${paperId}` as const;
}

type CoursePaper = {
  subject: string;
  qualification: string;
  paperNumber: number;
  tier: string;
  year: number;
  totalMarks: number;
};

type Course = {
  key: string;
  subject: string;
  qualification: string;
  papers: CoursePaper[];
};

function courseKey(paper: { subject: string; qualification: string }) {
  return `${paper.subject}::${paper.qualification}`;
}

function courseHref(course: Course) {
  return `/?subject=${encodeURIComponent(course.key)}` as Route;
}

function coursePaperHref(course: Course, paperNumber: number) {
  return `/?subject=${encodeURIComponent(course.key)}&paper=${paperNumber}` as Route;
}

function paperChoiceDisplayName(course: Course, paperNumber: number) {
  if (course.subject === "Religious Studies") {
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

function courseDisplayParts(course: { subject: string; qualification: string }) {
  if (["Biology", "Chemistry", "Physics"].includes(course.subject)) {
    return {
      name: course.subject,
      detail: course.qualification === "GCSE Chemistry" ? "(triple award)" : "combined science",
    };
  }

  if (course.subject === "Computer Science") {
    return {
      name: "Computer Science",
      detail: null,
    };
  }

  if (course.subject === "Business") {
    return {
      name: "Business",
      detail: null,
    };
  }

  return {
    name: course.subject,
    detail: null,
  };
}

function courseDisplayName(course: { subject: string; qualification: string }) {
  const parts = courseDisplayParts(course);

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

function subjectSortValue(subject: string) {
  const preferredOrder = [
    "English Language",
    "English Literature",
    "Biology",
    "Chemistry",
    "Physics",
  ];
  const preferredIndex = preferredOrder.indexOf(subject);

  return preferredIndex === -1 ? Number.POSITIVE_INFINITY : preferredIndex;
}

function sortCourses(left: Course, right: Course) {
  const leftSortValue = subjectSortValue(left.subject);
  const rightSortValue = subjectSortValue(right.subject);

  if (leftSortValue !== rightSortValue) {
    return leftSortValue - rightSortValue;
  }

  const subjectOrder = left.subject.localeCompare(right.subject);

  if (subjectOrder !== 0) {
    return subjectOrder;
  }

  return left.qualification.localeCompare(right.qualification);
}

function buildCourses(papers: CoursePaper[]) {
  const coursesByKey = new Map<string, Course>();

  for (const paper of papers) {
    const key = courseKey(paper);
    const course = coursesByKey.get(key);

    if (course) {
      course.papers.push(paper);
    } else {
      coursesByKey.set(key, {
        key,
        subject: paper.subject,
        qualification: paper.qualification,
        papers: [paper],
      });
    }
  }

  return [...coursesByKey.values()].sort(sortCourses);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string | string[]; subject?: string | string[]; paper?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const subjectParam = resolvedSearchParams?.subject;
  const paperParam = resolvedSearchParams?.paper;
  const selectedCourseKey = Array.isArray(subjectParam) ? subjectParam[0] : subjectParam;
  const selectedPaperNumberValue = Array.isArray(paperParam) ? paperParam[0] : paperParam;
  const selectedPaperNumber = selectedPaperNumberValue ? Number(selectedPaperNumberValue) : null;
  const demoParam = Array.isArray(resolvedSearchParams?.demo)
    ? resolvedSearchParams.demo[0]
    : resolvedSearchParams?.demo;
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
  const courses = buildCourses(papers);
  const selectedCourse = selectedCourseKey
    ? courses.find((course) => course.key === selectedCourseKey) ??
      courses.find((course) => course.subject === selectedCourseKey)
    : null;
  const visiblePapers = selectedCourse
    ? papers.filter(
        (paper) =>
          courseKey(paper) === selectedCourse.key &&
          selectedPaperNumber !== null &&
          paper.paperNumber === selectedPaperNumber,
      )
    : [];
  const selectedCoursePapers = selectedCourse ? papers.filter((paper) => courseKey(paper) === selectedCourse.key) : [];
  const availablePaperNumbers = [
    ...new Set(selectedCoursePapers.map((paper) => paper.paperNumber)),
  ].sort((left, right) => left - right);
  const shouldChoosePaperNumber = selectedCourse && selectedPaperNumber === null;
  const selectedCourseParts = selectedCourse ? courseDisplayParts(selectedCourse) : null;
  const initialNow = Date.now();
  const nextExam = nextExamFromSchedule(new Date(initialNow));

  return (
    <main className="page-shell learning-page">
      {demoParam === "portfolio" ? <DemoNotice /> : null}
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
          {selectedCourse ? selectedCourse.subject.slice(0, 2).toUpperCase() : "😡"}
        </div>
        <div className="course-hero__copy">
          <div className="breadcrumb-line">
            <Link href="/">Home</Link>
            {selectedCourse ? <span>/ {courseDisplayName(selectedCourse)}</span> : <span>/ Past papers</span>}
          </div>
          <div className="course-title-row">
            <h1>
              {selectedCourseParts ? (
                <>
                  {selectedCourseParts.name}
                  {selectedCourseParts.detail ? (
                    <span className="title-muted"> {selectedCourseParts.detail}</span>
                  ) : null}
                </>
              ) : (
                "We'll mark it for you"
              )}
            </h1>
          </div>
          <p className="page-description">
            {selectedCourse
              ? "Choose a paper, answer it in chunks, and get marking that stays close to the real mark scheme."
              : "Choose your subject, open a paper, and we'll use the actual mark scheme to mark your answers."}
          </p>
        </div>
        <ExamCountdown exam={nextExam} initialNow={initialNow} />
      </header>

      {!selectedCourse ? <ScrollCue targetId="subject-library" /> : null}

      {selectedCourse ? (
        shouldChoosePaperNumber ? (
          <section className="paper-choice-panel" aria-label={`${courseDisplayName(selectedCourse)} paper choices`}>
            <div className="paper-choice-heading">
              <div>
                <Link className="subtle-link" href="/">
                  All subjects
                </Link>
                <h2>Choose a paper</h2>
              </div>
            </div>
            <ol className="paper-choice-list">
              {availablePaperNumbers.map((paperNumber) => {
                return (
                  <li key={paperNumber}>
                    <Link className="paper-choice-row" href={coursePaperHref(selectedCourse, paperNumber)}>
                      <span className="paper-choice-row__title">
                        <strong>{paperChoiceDisplayName(selectedCourse, paperNumber)}</strong>
                      </span>
                      <span className="paper-choice-row__action">Open</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : visiblePapers.length > 0 ? (
          <section className="paper-table-wrap" aria-label={`${courseDisplayName(selectedCourse)} papers`}>
            <div className="library-subnav">
              <Link className="subtle-link" href={courseHref(selectedCourse)}>
                Change paper
              </Link>
              <span className="metric-list">
                <span>
                  {selectedPaperNumber === null
                    ? "Paper"
                    : paperChoiceDisplayName(selectedCourse, selectedPaperNumber)}
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
            <h2>No papers for {courseDisplayName(selectedCourse)}</h2>
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
            <span>{courses.length} subjects</span>
          </div>
          <ol className="subject-list">
            {courses.map((course) => {
              const latestYear = Math.max(...course.papers.map((paper) => paper.year));
              const totalMarks = course.papers.reduce((sum, paper) => sum + paper.totalMarks, 0);
              const displayParts = courseDisplayParts(course);

              return (
                <li key={course.key}>
                  <Link href={courseHref(course)}>
                    <span className="subject-list__name">
                      {displayParts.name}
                      {displayParts.detail ? (
                        <span className="subject-list__detail"> {displayParts.detail}</span>
                      ) : null}
                    </span>
                    <span className="subject-list__meta">
                      <span>{course.papers.length} papers</span>
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
