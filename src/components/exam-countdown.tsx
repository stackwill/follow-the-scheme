"use client";

import { useEffect, useMemo, useState } from "react";

import type { ExamScheduleEntry } from "@/lib/exam-schedule";

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
};

function getCountdownParts(targetTime: number, nowTime: number): CountdownParts {
  const totalMilliseconds = Math.max(0, targetTime - nowTime);
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalMilliseconds };
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatExamDate(startsAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(startsAt));
}

export function ExamCountdown({
  exam,
  initialNow,
}: {
  exam: ExamScheduleEntry | null;
  initialNow: number;
}) {
  const targetTime = useMemo(() => (exam ? Date.parse(exam.startsAt) : null), [exam]);
  const [nowTime, setNowTime] = useState(initialNow);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTime(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  if (!exam || targetTime === null) {
    return (
      <aside className="study-callout exam-countdown">
        <span className="exam-countdown__eyebrow">Exam countdown</span>
        <strong>All exams done</strong>
        <span>No upcoming exams are left in the schedule.</span>
      </aside>
    );
  }

  const countdown = getCountdownParts(targetTime, nowTime);
  const ariaLabel =
    countdown.totalMilliseconds === 0
      ? `${exam.subject} starts now`
      : `${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, and ${countdown.seconds} seconds until ${exam.subject}`;
  const timerText = [
    countdown.days,
    countdown.hours,
    countdown.minutes,
    countdown.seconds,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  return (
    <aside className="study-callout exam-countdown" aria-label={ariaLabel}>
      <span className="exam-countdown__eyebrow">Next exam</span>
      <div className="exam-countdown__clock" aria-hidden="true">
        <strong>{timerText}</strong>
      </div>
      <div className="exam-countdown__details">
        <strong>{exam.subject}</strong>
        <span>{exam.paper}</span>
        <small>
          {formatExamDate(exam.startsAt)} · {exam.board} · {formatDuration(exam.durationMinutes)}
        </small>
      </div>
    </aside>
  );
}
