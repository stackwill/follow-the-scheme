"use client";

import { useActionState } from "react";

import type { SelectionOption } from "@/lib/grading/schema";

type AnswerFormState = {
  error: string | null;
};

type AnswerFormProps = {
  action: (state: AnswerFormState, formData: FormData) => Promise<AnswerFormState>;
  selectionQuestion: {
    type: "single";
    options: SelectionOption[];
  } | null;
};

export function AnswerForm(props: AnswerFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });

  return (
    <form action={formAction} className="answer-form">
      {props.selectionQuestion ? (
        <fieldset className="option-fieldset">
          <legend>Your answer</legend>
          <p>Choose the option you would tick on the paper.</p>
          {props.selectionQuestion.options.map((option) => (
            <label className="option-choice" key={option.id}>
              <input name="answer" type="radio" value={option.id} required />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="field-stack">
          <span>Your answer</span>
          <textarea name="answer" rows={8} required />
        </label>
      )}

      <label className="field-stack">
        <span>Your notes (optional)</span>
        <textarea name="notes" rows={4} />
      </label>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? "Marking..." : "Submit answer"}
      </button>
    </form>
  );
}
