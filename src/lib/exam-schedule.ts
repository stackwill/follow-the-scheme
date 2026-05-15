import examScheduleData from "@/lib/exam-schedule-data.json";

export type ExamScheduleEntry = {
  id: string;
  date: string;
  session: "AM" | "PM";
  time: string;
  startsAt: string;
  subject: string;
  board: string;
  paper: string;
  durationMinutes: number;
};

export const examSchedule = [...examScheduleData].sort(
  (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
) as ExamScheduleEntry[];

export function nextExamFromSchedule(now: Date) {
  const nowTime = now.getTime();

  return examSchedule.find((exam) => Date.parse(exam.startsAt) > nowTime) ?? null;
}
