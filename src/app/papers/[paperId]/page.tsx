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
    <main className="page-shell">
      <header className="page-header">
        <div className="page-header__top">
          <Link className="subtle-link" href="/">
            Back to library
          </Link>
          <ThemeToggle />
        </div>
        <p className="eyebrow">{paper.sessionLabel}</p>
        <h1>{paper.title}</h1>
        <p className="page-description">
          {paper.examBoard} {paper.qualification} | Paper {paper.paperNumber} | {paper.tier} |{" "}
          {paper.totalMarks} marks
        </p>
        {firstQuestion ? (
          <Link className="button-link" href={questionHref(paper.id, firstQuestion.id)}>
            Start paper
          </Link>
        ) : null}
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
