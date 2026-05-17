import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { ExamCountdown } from "@/components/exam-countdown";
import { ScrollCue } from "@/components/scroll-cue";
import { SubjectPreferencesModal } from "@/components/subjects/subject-preferences-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { nextExamFromSchedule } from "@/lib/exam-schedule";
import {
  buildSubjectPreferenceOptions,
  selectedCourseKeysFromPreferenceIds,
  selectedSubjectPreferenceIds,
  subjectPreferenceMetadata,
  subjectPreferencesCompleted,
} from "@/lib/subjects/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function paperHref(paperId: string) {
  return `/papers/${paperId}` as const;
}

function loginHref(nextPath?: string) {
  const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";

  return `/login${suffix}` as Route;
}

function gatedHref(path: string, authenticated: boolean) {
  return (authenticated ? path : loginHref(path)) as Route;
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

function firstNameFromUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null) {
  const metadataName =
    typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null;
  const fallbackName = user?.email?.split("@")[0] ?? "there";
  const name = metadataName?.trim() || fallbackName;

  return name.split(/\s+/)[0] || "there";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[]; paper?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const subjectParam = resolvedSearchParams?.subject;
  const paperParam = resolvedSearchParams?.paper;
  const selectedCourseKey = Array.isArray(subjectParam) ? subjectParam[0] : subjectParam;
  const selectedPaperNumberValue = Array.isArray(paperParam) ? paperParam[0] : paperParam;
  const selectedPaperNumber = selectedPaperNumberValue ? Number(selectedPaperNumberValue) : null;
  const { db } = await import("@/lib/db");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authenticated = Boolean(user);
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
  const subjectPreferenceOptions = buildSubjectPreferenceOptions(courses);
  const selectedPreferenceIds = selectedSubjectPreferenceIds(user?.user_metadata);
  const selectedCourseKeys = selectedCourseKeysFromPreferenceIds(selectedPreferenceIds, subjectPreferenceOptions);
  const hasCompletedSubjectPreferences = subjectPreferencesCompleted(user?.user_metadata);
  const shouldFilterSubjects = authenticated && hasCompletedSubjectPreferences && selectedCourseKeys.size > 0;
  const coursesForHome = shouldFilterSubjects
    ? courses.filter((course) => selectedCourseKeys.has(course.key))
    : courses;
  const papersForHome = shouldFilterSubjects
    ? papers.filter((paper) => selectedCourseKeys.has(courseKey(paper)))
    : papers;
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

  async function saveSubjectPreferences(formData: FormData) {
    "use server";

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect(loginHref("/") as Route);
    }

    const preferenceIds = formData
      .getAll("preferenceIds")
      .map((value) => String(value))
      .filter((value) => subjectPreferenceOptions.some((option) => option.id === value));

    if (preferenceIds.length === 0) {
      return;
    }

    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        ...subjectPreferenceMetadata(preferenceIds),
      },
    });

    redirect("/" as Route);
  }

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
          {authenticated ? (
            <SubjectPreferencesModal
              action={saveSubjectPreferences}
              initialOpen={!hasCompletedSubjectPreferences}
              initialSelectedIds={selectedPreferenceIds}
              options={subjectPreferenceOptions}
            />
          ) : null}
          <span className="xp-chip">{papersForHome.length} papers</span>
          <ThemeToggle />
          <Link className="auth-nav-link" href={authenticated ? "/logout" : loginHref()}>
            {authenticated ? "Log out" : "Log in"}
          </Link>
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
                authenticated ? `Hey, ${firstNameFromUser(user)}` : "We'll mark it for you"
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
            <div className="library-subnav">
              <Link className="subtle-link" href="/">
                All subjects
              </Link>
              <span>Choose a paper</span>
            </div>
            <div className="paper-choice-grid">
              {availablePaperNumbers.map((paperNumber) => {
                const matchingPapers = selectedCoursePapers.filter((paper) => paper.paperNumber === paperNumber);
                const latestYear = Math.max(...matchingPapers.map((paper) => paper.year));
                const totalMarks = matchingPapers.reduce((sum, paper) => sum + paper.totalMarks, 0);

                return (
                  <Link
                    className="paper-choice-card"
                    href={gatedHref(coursePaperHref(selectedCourse, paperNumber), authenticated)}
                    key={paperNumber}
                  >
                    <span>{paperChoiceDisplayName(selectedCourse, paperNumber)}</span>
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
                      <Link className="table-action" href={gatedHref(paperHref(paper.id), authenticated)}>
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
            <span>{coursesForHome.length} subjects</span>
          </div>
          <ol className="subject-list">
            {coursesForHome.map((course) => {
              const latestYear = Math.max(...course.papers.map((paper) => paper.year));
              const totalMarks = course.papers.reduce((sum, paper) => sum + paper.totalMarks, 0);
              const displayParts = courseDisplayParts(course);

              return (
                <li key={course.key}>
                  <Link href={gatedHref(courseHref(course), authenticated)}>
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
