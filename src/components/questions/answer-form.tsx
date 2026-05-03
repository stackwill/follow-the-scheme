"use client";

import Image from "next/image";
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

export function AnswerForm(props: AnswerFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });
  const totalMarks = props.questions.reduce((sum, question) => sum + question.maxMarks, 0);

  return (
    <form action={formAction} className="answer-form">
      <div className="answer-form__header">
        <p className="eyebrow">Question group {props.groupKey}</p>
        <h2>{totalMarks} marks</h2>
      </div>

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
                    <input name={`answer-${question.id}`} type="radio" value={option.id} required />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="field-stack answer-under-question">
                <span>Your answer</span>
                <textarea name={`answer-${question.id}`} rows={6} required />
              </label>
            )}
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
