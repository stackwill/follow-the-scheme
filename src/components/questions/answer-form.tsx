"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useActionState } from "react";

import type { SelectionOption } from "@/lib/grading/schema";

type AnswerFormState = {
  error: string | null;
};

type AnswerFormProps = {
  action: (state: AnswerFormState, formData: FormData) => Promise<AnswerFormState>;
  groupKey: string;
  questions: Array<{
    id: string;
    questionKey: string;
    maxMarks: number;
    imagePath: string;
    continuationImagePaths: string[];
    paperOnlyReason: string | null;
    latestAttempt: {
      awardedMarks: number;
      maxMarks: number;
      submittedAnswer: string;
      reasoning: string;
      feedback: string;
      createdAt: string;
    } | null;
    selectionQuestion: {
      type: "single";
      options: SelectionOption[];
    } | null;
  }>;
};

function assetUrl(assetPath: string) {
  return `/api/assets?path=${encodeURIComponent(assetPath)}`;
}

function scoreTone(awardedMarks: number, maxMarks: number) {
  if (maxMarks <= 0) {
    return "empty";
  }

  const ratio = awardedMarks / maxMarks;

  if (ratio >= 0.75) {
    return "good";
  }

  if (ratio >= 0.45) {
    return "partial";
  }

  return "low";
}

export function AnswerForm(props: AnswerFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });
  const totalMarks = props.questions.reduce((sum, question) => sum + question.maxMarks, 0);
  const markedQuestions = props.questions.filter((question) => question.latestAttempt);
  const awardedMarks = markedQuestions.reduce((sum, question) => sum + (question.latestAttempt?.awardedMarks ?? 0), 0);
  const markedMaxMarks = markedQuestions.reduce((sum, question) => sum + (question.latestAttempt?.maxMarks ?? 0), 0);

  return (
    <form action={formAction} className="answer-form">
      <div className="answer-form__header">
        <p className="eyebrow">Question group {props.groupKey}</p>
        <h2>{totalMarks} marks</h2>
      </div>

      {markedQuestions.length > 0 ? (
        <section
          className="mark-summary"
          data-score={scoreTone(awardedMarks, markedMaxMarks)}
          id="marks"
          aria-label="Latest marking summary"
        >
          <div>
            <p className="eyebrow">Latest mark</p>
            <h3>
              {awardedMarks} / {markedMaxMarks} marks
            </h3>
            <div
              aria-hidden="true"
              className="score-meter"
              style={{
                "--score": `${Math.round((awardedMarks / Math.max(markedMaxMarks, 1)) * 100)}%`,
              } as CSSProperties}
            >
              <span />
            </div>
          </div>
          <p>
            {markedQuestions.length} of {props.questions.length} question parts marked. Detailed examiner-style feedback is
            shown under each marked part below.
          </p>
        </section>
      ) : null}

      <div className="question-group-stack">
        {props.questions.map((question) => (
          <section className="answer-part question-part-view" key={question.id}>
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
                sizes="(max-width: 900px) 100vw, 980px"
              />
            </figure>

            {question.continuationImagePaths.map((imagePath, index) => (
              <figure className="question-image-frame question-image-frame--continuation" key={imagePath}>
                <Image
                  src={assetUrl(imagePath)}
                  alt={`Question ${question.questionKey} continuation crop ${index + 1}`}
                  width={1400}
                  height={900}
                  sizes="(max-width: 900px) 100vw, 980px"
                />
              </figure>
            ))}

            {question.paperOnlyReason ? (
              <div className="paper-only-callout">
                <strong>Write or draw this one on paper.</strong>
                <p>{question.paperOnlyReason} This part is not sent for AI marking yet.</p>
              </div>
            ) : question.selectionQuestion ? (
              <fieldset className="option-fieldset">
                <legend>Your answer</legend>
                {question.selectionQuestion.options.map((option) => (
                  <label className="option-choice" key={option.id}>
                    <input name={`answer-${question.id}`} type="radio" value={option.id} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="field-stack answer-under-question">
                <span>Your answer</span>
                <textarea name={`answer-${question.id}`} rows={6} />
              </label>
            )}

            {question.latestAttempt ? (
              <section
                className="question-result"
                data-score={scoreTone(question.latestAttempt.awardedMarks, question.latestAttempt.maxMarks)}
                aria-label={`Latest mark for question ${question.questionKey}`}
              >
                <div className="question-result__top">
                  <p className="eyebrow">Marked answer</p>
                  <strong>
                    {question.latestAttempt.awardedMarks} / {question.latestAttempt.maxMarks} marks
                  </strong>
                </div>
                <div
                  aria-hidden="true"
                  className="score-meter"
                  style={{
                    "--score": `${Math.round(
                      (question.latestAttempt.awardedMarks / Math.max(question.latestAttempt.maxMarks, 1)) * 100,
                    )}%`,
                  } as CSSProperties}
                >
                  <span />
                </div>
                <dl className="question-result__details">
                  <div>
                    <dt>Your answer</dt>
                    <dd>{question.latestAttempt.submittedAnswer}</dd>
                  </div>
                  <div>
                    <dt>Why this mark</dt>
                    <dd>{question.latestAttempt.reasoning}</dd>
                  </div>
                  <div>
                    <dt>How to improve</dt>
                    <dd>{question.latestAttempt.feedback}</dd>
                  </div>
                </dl>
                <p className="question-result__time">
                  Marked {new Date(question.latestAttempt.createdAt).toLocaleString("en-GB")}
                </p>
              </section>
            ) : null}
          </section>
        ))}
      </div>

      <div className="submit-row">
        {state.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending}>
          {pending ? "Marking..." : "Submit and mark"}
        </button>
      </div>
    </form>
  );
}
