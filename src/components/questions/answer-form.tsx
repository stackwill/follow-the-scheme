"use client";

import { useActionState } from "react";

import type { SelectionOption } from "@/lib/grading/schema";

type AnswerFormState = {
  error: string | null;
};

type AnswerFormProps = {
  action: (state: AnswerFormState, formData: FormData) => Promise<AnswerFormState>;
  questions: Array<{
    id: string;
    questionKey: string;
    maxMarks: number;
    paperOnlyReason: string | null;
    selectionQuestion: {
      type: "single";
      options: SelectionOption[];
    } | null;
  }>;
};

export function AnswerForm(props: AnswerFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });

  return (
    <form action={formAction} className="answer-form">
      <div className="answer-form__header">
        <p className="eyebrow">Answer</p>
        <h2>{props.questions.length === 1 ? "Your answer" : "Answer this question group"}</h2>
      </div>

      {props.questions.map((question) => (
        <section className="answer-part" key={question.id}>
          <div className="answer-part__heading">
            <h3>Question {question.questionKey}</h3>
            <span>{question.maxMarks} marks</span>
          </div>

          {question.paperOnlyReason ? (
            <div className="paper-only-callout">
              <strong>Write or draw this one on paper.</strong>
              <p>{question.paperOnlyReason} This part is not sent for AI marking yet.</p>
            </div>
          ) : question.selectionQuestion ? (
            <fieldset className="option-fieldset">
              <legend>Choose the option you would tick.</legend>
              {question.selectionQuestion.options.map((option) => (
                <label className="option-choice" key={option.id}>
                  <input name={`answer-${question.id}`} type="radio" value={option.id} required />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <label className="field-stack">
              <span>Typed answer</span>
              <textarea name={`answer-${question.id}`} rows={6} required />
            </label>
          )}
        </section>
      ))}

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? "Marking..." : "Submit and mark"}
      </button>
    </form>
  );
}
