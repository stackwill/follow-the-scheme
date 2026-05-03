import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

function questionHref(paperId: string, questionId: string) {
  return `/papers/${paperId}/questions/${questionId}` as Route;
}

function questionGroupKey(questionKey: string) {
  return questionKey.split(".")[0] ?? questionKey;
}

export default async function PaperOverviewPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  const { db } = await import("@/lib/db");
  const paper = await db.paper.findUnique({
    where: { id: paperId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
        include: {
          _count: {
            select: {
              attempts: true,
            },
          },
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!paper) {
    notFound();
  }

  const firstQuestion = paper.questions[0];
  const groupedQuestions = paper.questions.reduce<Array<{ key: string; questions: typeof paper.questions }>>(
    (groups, question) => {
      const key = questionGroupKey(question.questionKey);
      const existingGroup = groups.at(-1);

      if (existingGroup?.key === key) {
        existingGroup.questions.push(question);
      } else {
        groups.push({ key, questions: [question] });
      }

      return groups;
    },
    [],
  );

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

      <section className="question-map-panel">
        <div className="section-heading">
          <h2>Question map</h2>
          <p>{groupedQuestions.length} groups | {paper.questions.length} imported parts</p>
        </div>
        {groupedQuestions.length > 0 ? (
          <ol className="question-group-list">
            {groupedQuestions.map((group) => {
              const groupMarks = group.questions.reduce((sum, question) => sum + question.maxMarks, 0);
              const groupAttempts = group.questions.reduce((sum, question) => sum + question._count.attempts, 0);
              const latestAttempts = group.questions.flatMap((question) => question.attempts);
              const awardedMarks = latestAttempts.reduce((sum, attempt) => sum + attempt.awardedMarks, 0);
              const attemptedMarks = latestAttempts.reduce((sum, attempt) => sum + attempt.maxMarks, 0);
              const scoreLabel =
                latestAttempts.length > 0
                  ? `Latest: ${awardedMarks}/${attemptedMarks} marked`
                  : "Not marked yet";

              return (
                <li key={group.key}>
                  <Link href={questionHref(paper.id, group.questions[0].id)}>
                    <span className="question-group-list__number">{group.key}</span>
                    <span className="question-group-list__body">
                      <strong>{group.questions.map((question) => question.questionKey).join(", ")}</strong>
                      <span>{group.questions.length} parts | {groupMarks} marks | {groupAttempts} attempts</span>
                    </span>
                    <span className="question-group-list__score">{scoreLabel}</span>
                    <span className="question-group-list__action">Open</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p>No questions were imported for this paper.</p>
        )}
      </section>
    </main>
  );
}
