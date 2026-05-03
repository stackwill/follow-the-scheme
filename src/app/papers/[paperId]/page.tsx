import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

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
        include: {
          _count: {
            select: {
              attempts: true,
            },
          },
        },
      },
    },
  });

  if (!paper) {
    notFound();
  }

  const firstQuestion = paper.questions[0];

  return (
    <main className="page-shell">
      <header className="page-header">
        <Link className="subtle-link" href="/">
          Back to library
        </Link>
        <p className="eyebrow">{paper.sessionLabel}</p>
        <h1>{paper.title}</h1>
        <p className="page-description">
          {paper.examBoard} {paper.qualification} | Paper {paper.paperNumber} | {paper.tier} |{" "}
          {paper.totalMarks} marks
        </p>
        {firstQuestion ? (
          <Link className="button-link" href={questionHref(paper.id, firstQuestion.id)}>
            Start first question
          </Link>
        ) : null}
      </header>

      <section className="dev-panel">
        <div className="section-heading">
          <h2>Questions</h2>
          <p>{paper.questions.length} imported question parts</p>
        </div>
        {paper.questions.length > 0 ? (
          <ol className="question-list">
            {paper.questions.map((question) => (
              <li key={question.id}>
                <Link href={questionHref(paper.id, question.id)}>
                  <span>Question {question.questionKey}</span>
                  <span>
                    {question.maxMarks} marks | {question._count.attempts} attempts
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p>No questions were imported for this paper.</p>
        )}
      </section>
    </main>
  );
}
