export function ResultPanel(props: {
  awardedMarks: number;
  maxMarks: number;
  reasoning: string;
  feedback: string;
  submittedAnswer: string;
  createdAt: Date;
}) {
  return (
    <section className="result-panel" aria-labelledby="latest-result-heading">
      <p className="eyebrow">Latest attempt</p>
      <h2 id="latest-result-heading">
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
