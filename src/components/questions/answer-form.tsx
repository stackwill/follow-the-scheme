"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useActionState, useEffect, useMemo, useState } from "react";

import type { SelectionOption } from "@/lib/grading/schema";
import {
  latestLocalAttempt,
  type LocalPaperAttempts,
  type LocalQuestionAttempt,
  readLocalPaperAttempts,
  saveLocalQuestionAttempts,
} from "@/lib/questions/local-attempts";

type AnswerFormState = {
  error: string | null;
  answers?: Record<string, string>;
  results?: LocalQuestionAttempt[];
};

type AnswerFormProps = {
  action: (state: AnswerFormState, formData: FormData) => Promise<AnswerFormState>;
  paperId: string;
  groupKey: string;
  questions: Array<{
    id: string;
    questionKey: string;
    maxMarks: number;
    imagePath: string;
    continuationImagePaths: string[];
    paperOnlyReason: string | null;
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

function shouldShowImprovement(awardedMarks: number, maxMarks: number) {
  return maxMarks > 0 && awardedMarks < maxMarks;
}

export function AnswerForm(props: AnswerFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });
  const [localAttempts, setLocalAttempts] = useState<LocalPaperAttempts | null>(null);
  const latestAttemptsByQuestionId = useMemo(() => {
    const entries = props.questions.map((question) => [
      question.id,
      localAttempts ? latestLocalAttempt(localAttempts, question.id) : null,
    ]);

    return Object.fromEntries(entries) as Record<string, LocalQuestionAttempt | null>;
  }, [localAttempts, props.questions]);
  const totalMarks = props.questions.reduce((sum, question) => sum + question.maxMarks, 0);
  const markedQuestions = props.questions.filter((question) => latestAttemptsByQuestionId[question.id]);
  const awardedMarks = markedQuestions.reduce(
    (sum, question) => sum + (latestAttemptsByQuestionId[question.id]?.awardedMarks ?? 0),
    0,
  );
  const markedMaxMarks = markedQuestions.reduce(
    (sum, question) => sum + (latestAttemptsByQuestionId[question.id]?.maxMarks ?? 0),
    0,
  );

  useEffect(() => {
    setLocalAttempts(readLocalPaperAttempts(props.paperId));
  }, [props.paperId]);

  useEffect(() => {
    if (!state.results || state.results.length === 0) {
      return;
    }

    setLocalAttempts(saveLocalQuestionAttempts(props.paperId, state.results));
    document.getElementById("marks")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [props.paperId, state.results]);

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
        {props.questions.map((question) => {
          const latestAttempt = latestAttemptsByQuestionId[question.id];

          return (
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
                  unoptimized
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
                    unoptimized
                  />
                </figure>
              ))}

              {question.paperOnlyReason ? (
                <div className="paper-only-callout">
                  <strong>Write or draw this one on paper.</strong>
                  <p>{question.paperOnlyReason} This part is not sent for AI marking yet.</p>
                </div>
              ) : question.selectionQuestion ? (
                <fieldset className="option-fieldset" key={state.answers?.[question.id] ?? "empty"}>
                  <legend>Your answer</legend>
                  {question.selectionQuestion.options.map((option) => (
                    <label className="option-choice" key={option.id}>
                      <input
                        name={`answer-${question.id}`}
                        type="radio"
                        value={option.id}
                        defaultChecked={state.answers?.[question.id] === option.id}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label className="field-stack answer-under-question">
                  <span>Your answer</span>
                  <textarea
                    key={state.answers?.[question.id] ?? "empty"}
                      name={`answer-${question.id}`}
                    rows={6}
                    defaultValue={state.answers?.[question.id] ?? ""}
                  />
                </label>
              )}

              {latestAttempt ? (
                <section
                  className="question-result"
                  data-score={scoreTone(latestAttempt.awardedMarks, latestAttempt.maxMarks)}
                  aria-label={`Latest mark for question ${question.questionKey}`}
                >
                  <div className="question-result__top">
                    <p className="eyebrow">Marked answer</p>
                    <strong>
                      {latestAttempt.awardedMarks} / {latestAttempt.maxMarks} marks
                    </strong>
                  </div>
                  <div
                    aria-hidden="true"
                    className="score-meter"
                    style={{
                      "--score": `${Math.round(
                        (latestAttempt.awardedMarks / Math.max(latestAttempt.maxMarks, 1)) * 100,
                      )}%`,
                    } as CSSProperties}
                  >
                    <span />
                  </div>
                  <dl className="question-result__details">
                    <div>
                      <dt>Your answer</dt>
                      <dd>{latestAttempt.submittedAnswer}</dd>
                    </div>
                    <div>
                      <dt>Why this mark</dt>
                      <dd>{latestAttempt.reasoning}</dd>
                    </div>
                    {shouldShowImprovement(latestAttempt.awardedMarks, latestAttempt.maxMarks) ? (
                      <div>
                        <dt>How to improve</dt>
                        <dd>{latestAttempt.feedback}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="question-result__time">
                    Marked {new Date(latestAttempt.createdAt).toLocaleString("en-GB")}
                  </p>
                </section>
              ) : null}
            </section>
          );
        })}
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
