import Image from "next/image";

type QuestionViewerProps = {
  groupKey: string;
  questions: Array<{
    id: string;
    questionKey: string;
    maxMarks: number;
    imagePath: string;
    supportingImagePaths: string[];
    text: string;
    paperOnlyReason: string | null;
  }>;
};

function assetUrl(assetPath: string) {
  return `/api/assets?path=${encodeURIComponent(assetPath)}`;
}

export function QuestionViewer(props: QuestionViewerProps) {
  const totalMarks = props.questions.reduce((sum, question) => sum + question.maxMarks, 0);

  return (
    <section className="question-card" aria-labelledby="question-heading">
      <div className="question-card__header">
        <p className="eyebrow">Question group {props.groupKey}</p>
        <p className="marks-pill">{totalMarks} marks</p>
      </div>
      <h2 id="question-heading" className="sr-only">
        Question group {props.groupKey}
      </h2>

      <div className="question-group-stack">
        {props.questions.map((question, questionIndex) => (
          <article className="question-part-view" key={question.id}>
            <div className="question-part-view__heading">
              <h3>Question {question.questionKey}</h3>
              <span>{question.maxMarks} marks</span>
            </div>
            {question.paperOnlyReason ? <p className="paper-only-chip">{question.paperOnlyReason}</p> : null}
            <figure className="question-image-frame">
              <Image
                src={assetUrl(question.imagePath)}
                alt={`Question ${question.questionKey} crop`}
                width={1400}
                height={900}
                sizes="(max-width: 900px) 100vw, 840px"
                unoptimized
              />
            </figure>
            {question.supportingImagePaths.length > 0 ? (
              <details className="supporting-crops">
                <summary>Additional source material</summary>
                {question.supportingImagePaths.map((imagePath, index) => (
                  <figure className="question-image-frame" key={imagePath}>
                    <Image
                      src={assetUrl(imagePath)}
                      alt={`Question ${question.questionKey} additional crop ${index + 1}`}
                      width={1400}
                      height={900}
                      sizes="(max-width: 900px) 100vw, 840px"
                      unoptimized
                    />
                  </figure>
                ))}
              </details>
            ) : null}
            <details className="extracted-text">
              <summary>{questionIndex === 0 ? "Extracted text" : `Extracted text for ${question.questionKey}`}</summary>
              <p>{question.text}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
