"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

import {
  latestLocalAttempt,
  localAttemptCount,
  type LocalPaperAttempts,
  readLocalPaperAttempts,
} from "@/lib/questions/local-attempts";

type PaperProgressQuestion = {
  id: string;
  questionKey: string;
  maxMarks: number;
};

type PaperProgressGroup = {
  key: string;
  questions: PaperProgressQuestion[];
};

type PaperProgressOverviewProps = {
  paperId: string;
  totalMarks: number;
  questionCount: number;
  groups: PaperProgressGroup[];
};

function questionHref(paperId: string, questionId: string) {
  return `/papers/${paperId}/questions/${questionId}` as Route;
}

function scoreTone(awardedMarks: number, maxMarks: number) {
  if (maxMarks === 0) {
    return "empty";
  }

  const percentage = (awardedMarks / maxMarks) * 100;

  if (percentage >= 75) {
    return "strong";
  }

  if (percentage >= 50) {
    return "steady";
  }

  return "low";
}

export function PaperProgressOverview(props: PaperProgressOverviewProps) {
  const [localAttempts, setLocalAttempts] = useState<LocalPaperAttempts | null>(null);

  useEffect(() => {
    setLocalAttempts(readLocalPaperAttempts(props.paperId));
  }, [props.paperId]);

  const latestQuestionAttempts = props.groups.flatMap((group) =>
    group.questions.flatMap((question) => {
      const attempt = localAttempts ? latestLocalAttempt(localAttempts, question.id) : null;

      return attempt ? [attempt] : [];
    }),
  );
  const totalAwardedMarks = latestQuestionAttempts.reduce((sum, attempt) => sum + attempt.awardedMarks, 0);
  const totalScoreTone = latestQuestionAttempts.length > 0 ? scoreTone(totalAwardedMarks, props.totalMarks) : "empty";
  const totalScoreLabel =
    latestQuestionAttempts.length > 0
      ? `${totalAwardedMarks}/${props.totalMarks} total marks`
      : `0/${props.totalMarks} total marks`;

  return (
    <section className="question-map-panel">
      <div className="section-heading">
        <h2>Question map</h2>
        <div className="section-heading__meta">
          <span
            className="total-score-chip"
            data-score={totalScoreTone}
            aria-label={`Latest local total score: ${totalScoreLabel}`}
          >
            {totalScoreLabel}
          </span>
          <span>{props.groups.length} groups | {props.questionCount} imported parts</span>
        </div>
      </div>
      {props.groups.length > 0 ? (
        <ol className="question-group-list">
          {props.groups.map((group) => {
            const groupMarks = group.questions.reduce((sum, question) => sum + question.maxMarks, 0);
            const latestAttempts = group.questions.flatMap((question) => {
              const attempt = localAttempts ? latestLocalAttempt(localAttempts, question.id) : null;

              return attempt ? [attempt] : [];
            });
            const attemptCount = group.questions.reduce(
              (sum, question) => sum + (localAttempts ? localAttemptCount(localAttempts, question.id) : 0),
              0,
            );
            const awardedMarks = latestAttempts.reduce((sum, attempt) => sum + attempt.awardedMarks, 0);
            const attemptedMarks = latestAttempts.reduce((sum, attempt) => sum + attempt.maxMarks, 0);
            const scoreLabel =
              latestAttempts.length > 0
                ? `Latest: ${awardedMarks}/${attemptedMarks} marked`
                : "Not marked yet";

            return (
              <li key={group.key}>
                <Link href={questionHref(props.paperId, group.questions[0].id)}>
                  <span className="question-group-list__number">{group.key}</span>
                  <span className="question-group-list__body">
                    <strong>
                      {group.questions.length === 1
                        ? group.questions[0].questionKey
                        : `Questions ${group.key}`}
                    </strong>
                    <span>{group.questions.length} parts | {groupMarks} marks | {attemptCount} local attempts</span>
                  </span>
                  <span className="question-group-list__score">{scoreLabel}</span>
                  <span className="question-group-list__action">Open</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p>No questions were imported for this paper.</p>
      )}
    </section>
  );
}
