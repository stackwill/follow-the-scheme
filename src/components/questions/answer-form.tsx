"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties } from "react";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SelectionOption } from "@/lib/grading/schema";
import { trackAnalyticsEvent } from "@/lib/analytics/umami";
import { MarkingSpectacle } from "@/components/questions/marking-spectacle";
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
  skippedCount?: number;
  submitted?: boolean;
};

type AnswerFormProps = {
  action: (state: AnswerFormState, formData: FormData) => Promise<AnswerFormState>;
  paperId: string;
  groupKey: string;
  nextHref: Route | null;
  analytics: {
    subject: string;
    qualification: string;
    paperNumber: number;
    tier: string;
    year: number;
  };
  sourceMaterialImagePaths: string[];
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

type CompletionSpectacle = {
  awardedMarks: number;
  key: number;
  markedCount: number;
  totalMarks: number;
};

const COMPLETION_ANIMATION_SEEN_KEY = "followthescheme-completion-animation-seen";

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

function normalizeAnswer(value: string) {
  return value.trim();
}

function hasGoodUnchangedAttempt(attempt: LocalQuestionAttempt | null, answer: string) {
  return (
    attempt !== null &&
    normalizeAnswer(answer) === normalizeAnswer(attempt.submittedAnswer) &&
    attempt.maxMarks > 0 &&
    attempt.awardedMarks / attempt.maxMarks >= 0.75
  );
}

export function AnswerForm(props: AnswerFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });
  const [localAttempts, setLocalAttempts] = useState<LocalPaperAttempts | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>({});
  const [completionSpectacle, setCompletionSpectacle] = useState<CompletionSpectacle | null>(null);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(true);
  const showCompletionAnimationRef = useRef(showCompletionAnimation);
  const analyticsProps = useMemo(
    () => ({
      subject: props.analytics.subject,
      qualification: props.analytics.qualification,
      paperNumber: props.analytics.paperNumber,
      tier: props.analytics.tier,
      year: props.analytics.year,
    }),
    [
      props.analytics.subject,
      props.analytics.qualification,
      props.analytics.paperNumber,
      props.analytics.tier,
      props.analytics.year,
    ],
  );
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
  const unsubmittedQuestionIds = new Set(
    state.submitted
      ? props.questions
          .filter((question) => !question.paperOnlyReason)
          .filter((question) => !normalizeAnswer(state.answers?.[question.id] ?? ""))
          .map((question) => question.id)
      : [],
  );
  const hasSuccessfulSubmission =
    state.submitted === true &&
    !state.error &&
    ((state.results?.length ?? 0) > 0 || (state.skippedCount ?? 0) > 0);
  const completeSpectacle = useCallback(() => {
    setCompletionSpectacle(null);
    document.getElementById("marks")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  useEffect(() => {
    showCompletionAnimationRef.current = showCompletionAnimation;
  }, [showCompletionAnimation]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COMPLETION_ANIMATION_SEEN_KEY) === "true") {
        setShowCompletionAnimation(false);
      }
    } catch {
      // Keep the animation enabled when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    setLocalAttempts(readLocalPaperAttempts(props.paperId));
  }, [props.paperId]);

  useEffect(() => {
    if (!hasSuccessfulSubmission) {
      return;
    }

    const nextLocalAttempts =
      state.results && state.results.length > 0
        ? saveLocalQuestionAttempts(props.paperId, state.results)
        : readLocalPaperAttempts(props.paperId);
    setLocalAttempts(nextLocalAttempts);

    trackAnalyticsEvent("Question Group Marked", {
      ...analyticsProps,
      groupKey: props.groupKey,
      questionParts: props.questions.length,
      markedParts: state.results?.length ?? 0,
      skippedParts: state.skippedCount ?? 0,
    });

    const finalAttemptsByQuestionId = Object.fromEntries(
      props.questions.map((question) => [
        question.id,
        nextLocalAttempts ? latestLocalAttempt(nextLocalAttempts, question.id) : null,
      ]),
    ) as Record<string, LocalQuestionAttempt | null>;
    const finalAwardedMarks = props.questions.reduce(
      (sum, question) => sum + (finalAttemptsByQuestionId[question.id]?.awardedMarks ?? 0),
      0,
    );
    const finalMarkedCount = props.questions.filter((question) => finalAttemptsByQuestionId[question.id]).length;

    if (showCompletionAnimationRef.current) {
      try {
        window.localStorage.setItem(COMPLETION_ANIMATION_SEEN_KEY, "true");
      } catch {
        // The spectacle can still run when storage is unavailable.
      }

      setShowCompletionAnimation(false);
      setCompletionSpectacle({
        awardedMarks: finalAwardedMarks,
        key: Date.now(),
        markedCount: finalMarkedCount,
        totalMarks,
      });
    } else {
      setCompletionSpectacle(null);
      window.requestAnimationFrame(() => {
        document.getElementById("marks")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }, [
    analyticsProps,
    hasSuccessfulSubmission,
    props.groupKey,
    props.paperId,
    props.questions,
    props.questions.length,
    state.results,
    state.skippedCount,
    totalMarks,
  ]);

  useEffect(() => {
    if (state.answers) {
      setAnswersByQuestionId(state.answers);
    }
  }, [state.answers]);

  return (
    <form action={formAction} className="answer-form">
      {completionSpectacle ? (
        <MarkingSpectacle
          awardedMarks={completionSpectacle.awardedMarks}
          markedCount={completionSpectacle.markedCount}
          onComplete={completeSpectacle}
          runId={completionSpectacle.key}
          totalMarks={completionSpectacle.totalMarks}
        />
      ) : null}
      <div className="answer-form__header">
        <p className="eyebrow">Question group {props.groupKey}</p>
        <h2>{totalMarks} marks</h2>
      </div>

      {state.submitted || markedQuestions.length > 0 ? (
        <section
          className="mark-summary"
          data-score={scoreTone(awardedMarks, totalMarks)}
          id="marks"
          aria-label="Page marking summary"
        >
          <div>
            <p className="eyebrow">Page total</p>
            <h3>
              {awardedMarks} / {totalMarks} marks
            </h3>
            <div
              aria-hidden="true"
              className="score-meter"
              style={{
                "--score": `${Math.round((awardedMarks / Math.max(totalMarks, 1)) * 100)}%`,
              } as CSSProperties}
            >
              <span />
            </div>
          </div>
          <p>
            {markedQuestions.length} of {props.questions.length} question parts marked. Unsubmitted answerable parts count
            as zero in this page total.
          </p>
        </section>
      ) : null}

      {props.sourceMaterialImagePaths.length > 0 ? (
        <section className="required-source-material" aria-label="Required source material">
          <div className="required-source-material__header">
            <p className="eyebrow">Required source material</p>
            <h3>Use these sources for this question group</h3>
          </div>
          {props.sourceMaterialImagePaths.map((imagePath, index) => (
            <figure className="question-image-frame required-source-material__figure" key={imagePath}>
              <Image
                src={assetUrl(imagePath)}
                alt={`Required source material ${index + 1}`}
                width={1400}
                height={900}
                sizes="(max-width: 900px) 100vw, 980px"
                unoptimized
              />
            </figure>
          ))}
        </section>
      ) : null}

      <div className="question-group-stack">
        {props.questions.map((question) => {
          const latestAttempt = latestAttemptsByQuestionId[question.id];
          const currentAnswer = answersByQuestionId[question.id] ?? "";
          const canSkipRemark = hasGoodUnchangedAttempt(latestAttempt, currentAnswer);
          const isUnsubmitted = unsubmittedQuestionIds.has(question.id);

          return (
            <section className="answer-part question-part-view" data-unsubmitted={isUnsubmitted} key={question.id}>
              <div className="question-part-view__heading">
                <h3>Question {question.questionKey}</h3>
                <span>{question.maxMarks} marks</span>
              </div>

              {canSkipRemark && latestAttempt ? (
                <input type="hidden" name={`skip-remark-${question.id}`} value={latestAttempt.id} />
              ) : null}

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
                        checked={answersByQuestionId[question.id] === option.id}
                        onChange={(event) =>
                          setAnswersByQuestionId((answers) => ({
                            ...answers,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label className="field-stack answer-under-question">
                  <span>Your answer</span>
                  <textarea
                    name={`answer-${question.id}`}
                    rows={6}
                    value={answersByQuestionId[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswersByQuestionId((answers) => ({
                        ...answers,
                        [question.id]: event.target.value,
                      }))
                    }
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

      <div className="submit-row" data-marked={hasSuccessfulSubmission}>
        {state.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="submit-row__actions">
          <button className="mark-submit-button" type="submit" disabled={pending} aria-busy={pending}>
            <span className="mark-submit-button__label">{pending ? "Marking" : "Submit and mark"}</span>
            <span className="mark-submit-button__scanner" aria-hidden="true" />
          </button>
          <label className="animation-toggle">
            <input
              type="checkbox"
              checked={showCompletionAnimation}
              onChange={(event) => setShowCompletionAnimation(event.target.checked)}
            />
            <span>Animation</span>
          </label>
          {hasSuccessfulSubmission && props.nextHref ? (
            <Link className="submit-row__next" href={props.nextHref}>
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
