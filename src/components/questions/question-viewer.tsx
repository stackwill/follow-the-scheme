import Image from "next/image";

type QuestionViewerProps = {
  questionKey: string;
  maxMarks: number;
  imagePath: string;
  supportingImagePaths: string[];
  text: string;
};

function assetUrl(assetPath: string) {
  return `/api/assets?path=${encodeURIComponent(assetPath)}`;
}

export function QuestionViewer(props: QuestionViewerProps) {
  return (
    <section className="question-card" aria-labelledby="question-heading">
      <div className="question-card__header">
        <p className="eyebrow">Question {props.questionKey}</p>
        <p className="marks-pill">{props.maxMarks} marks</p>
      </div>
      <h2 id="question-heading" className="sr-only">
        Question {props.questionKey}
      </h2>
      <figure className="question-image-frame">
        <Image
          src={assetUrl(props.imagePath)}
          alt={`Question ${props.questionKey} crop`}
          width={1400}
          height={900}
          sizes="(max-width: 900px) 100vw, 840px"
        />
      </figure>
      {props.supportingImagePaths.length > 0 ? (
        <div className="supporting-crops">
          <h3>Continuation crops</h3>
          {props.supportingImagePaths.map((imagePath, index) => (
            <figure className="question-image-frame" key={imagePath}>
              <Image
                src={assetUrl(imagePath)}
                alt={`Question ${props.questionKey} continuation crop ${index + 1}`}
                width={1400}
                height={900}
                sizes="(max-width: 900px) 100vw, 840px"
              />
            </figure>
          ))}
        </div>
      ) : null}
      <details className="extracted-text">
        <summary>Extracted text</summary>
        <p>{props.text}</p>
      </details>
    </section>
  );
}
