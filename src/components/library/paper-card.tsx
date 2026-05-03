import type { Paper } from "@prisma/client";

export function PaperCard({ paper }: { paper: Paper }) {
  return (
    <article className="paper-card">
      <div>
        <p className="paper-card__meta">
          <span>{paper.examBoard}</span>
          <span>{paper.qualification}</span>
          <span>{paper.tier}</span>
        </p>
        <h2>{paper.title}</h2>
      </div>
      <p className="paper-card__details">
        {paper.sessionLabel} | Paper {paper.paperNumber} | {paper.totalMarks} marks
      </p>
      <span className="paper-card__link paper-card__link--disabled" aria-disabled="true">
        Paper view arrives in Task 7
      </span>
    </article>
  );
}
