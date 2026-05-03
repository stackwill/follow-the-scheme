export function ResultPanel(props: {
  questionKey: string;
  awardedMarks: number;
  maxMarks: number;
  reasoning: string;
  feedback: string;
  submittedAnswer: string;
  createdAt: Date;
}) {
  const headingId = `latest-result-${props.questionKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <section className="result-panel" aria-labelledby={headingId}>
      <p className="eyebrow">Latest attempt | Question {props.questionKey}</p>
      <h2 id={headingId}>
        {props.awardedMarks} / {props.maxMarks} marks
      </h2>
      <dl className="result-panel__details">
        <div>
          <dt>Submitted</dt>
          <dd>{props.submittedAnswer}</dd>
        </div>
        <div>
          <dt>Reasoning</dt>
          <dd>{props.reasoning}</dd>
        </div>
        <div>
          <dt>Feedback</dt>
          <dd>{props.feedback}</dd>
        </div>
      </dl>
      <p className="result-panel__time">Marked {props.createdAt.toLocaleString("en-GB")}</p>
    </section>
  );
}
