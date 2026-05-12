import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { PaperProgressOverview } from "@/components/questions/paper-progress-overview";
import { ThemeToggle } from "@/components/theme-toggle";
import { uniqueQuestionGroups } from "@/lib/questions/groups";

export const dynamic = "force-dynamic";

function questionHref(paperId: string, questionId: string) {
  return `/papers/${paperId}/questions/${questionId}` as Route;
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

export default async function PaperOverviewPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  const { db } = await import("@/lib/db");
  const paper = await db.paper.findUnique({
    where: { id: paperId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!paper) {
    notFound();
  }

  const firstQuestion = paper.questions[0];
  const groupedQuestions = uniqueQuestionGroups(paper, paper.questions);
  const progressGroups = groupedQuestions.map((group) => ({
    key: group.key,
    questions: group.questions.map((groupQuestion) => ({
      id: groupQuestion.id,
      questionKey: groupQuestion.questionKey,
      maxMarks: groupQuestion.maxMarks,
    })),
  }));

  return (
    <main className="page-shell learning-page">
      <nav className="app-topbar" aria-label="App navigation">
        <Link className="brand-mark" href="/">
          <span className="brand-spark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>reallycool.lol</strong>
        </Link>
        <div className="app-topbar__actions">
          <span className="xp-chip">{paper.questions.length} parts</span>
          <ThemeToggle />
        </div>
      </nav>

      <header className="course-hero paper-hero">
        <div className="course-hero__icon" aria-hidden="true">
          {paper.subject.slice(0, 2).toUpperCase()}
        </div>
        <div className="course-hero__copy">
          <div className="breadcrumb-line">
            <Link href="/">Home</Link>
            <span>/ {subjectDisplayName(paper.subject)}</span>
            <span>/ {paper.year}</span>
          </div>
          <p className="eyebrow">{paper.sessionLabel}</p>
          <h1>{paper.title}</h1>
          <p className="page-description metric-list">
            <span>{paper.examBoard} {paper.qualification}</span>
            <span>Paper {paper.paperNumber}</span>
            <span>{paper.tier}</span>
          </p>
          <div className="hero-actions">
            {firstQuestion ? (
              <Link className="button-link" href={questionHref(paper.id, firstQuestion.id)}>
                Start paper
              </Link>
            ) : null}
            <Link className="button-link button-link--secondary" href="/">
              Back to library
            </Link>
          </div>
        </div>
        <aside className="paper-stat-card">
          <span>Total marks</span>
          <strong>{paper.totalMarks}</strong>
          <span>{groupedQuestions.length} question groups</span>
        </aside>
      </header>

      <PaperProgressOverview
        paperId={paper.id}
        totalMarks={paper.totalMarks}
        questionCount={paper.questions.length}
        groups={progressGroups}
      />
    </main>
  );
}
