import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { AnalyticsEvent } from "@/components/analytics/analytics-event";
import { AnswerForm } from "@/components/questions/answer-form";
import { ProgressHeader } from "@/components/questions/progress-header";
import { resolveNodeAccessMode } from "@/lib/auth/access-node";
import { AUTH_COOKIE_NAME, DEMO_AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { detectPaperOnlyQuestion, detectSelectionQuestion } from "@/lib/grading/schema";
import type { LocalQuestionAttempt } from "@/lib/questions/local-attempts";
import { questionGroupKey, uniqueQuestionGroups } from "@/lib/questions/groups";
import { checkRateLimit, clientRateLimitKeyFromHeaders, rateLimitMessage } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type FormState = {
  error: string | null;
  answers?: Record<string, string>;
  results?: LocalQuestionAttempt[];
  skippedCount?: number;
  submitted?: boolean;
};

function paperHref(paperId: string) {
  return `/papers/${paperId}` as Route;
}

function questionHref(paperId: string, questionId: string) {
  return `/papers/${paperId}/questions/${questionId}` as Route;
}

function parseSupportingAssetPaths(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return parsed;
    }
  } catch {
    return [];
  }

  return [];
}

function isEdexcelHistoryMedicineSourceAsset(
  adapterKey: string,
  questionKey: string,
  assetPath: string,
) {
  return (
    adapterKey === "edexcel-gcse-history-paper-1-medicine" &&
    questionKey.startsWith("2.") &&
    /\/2-[ab]-page-18\.png$/.test(assetPath)
  );
}

function sourceMaterialImagePathsForGroup(
  adapterKey: string,
  groupKey: string,
  questions: Array<{ questionKey: string; supportingAssetPaths: string }>,
) {
  if (adapterKey === "caie-igcse-english-language-paper-2" && groupKey === "1") {
    return [
      ...new Set(
        questions.flatMap((groupQuestion) =>
          parseSupportingAssetPaths(groupQuestion.supportingAssetPaths).filter((assetPath) =>
            /\/1-page-(14|15)\.png$/.test(assetPath),
          ),
        ),
      ),
    ];
  }

  if (adapterKey !== "edexcel-gcse-history-paper-1-medicine" || groupKey !== "2") {
    return [];
  }

  const sourceAssets = questions.flatMap((groupQuestion) =>
    parseSupportingAssetPaths(groupQuestion.supportingAssetPaths).filter((assetPath) =>
      isEdexcelHistoryMedicineSourceAsset(adapterKey, groupQuestion.questionKey, assetPath),
    ),
  );
  const fullSourcePage = sourceAssets.find((assetPath) => /\/2-a-page-18\.png$/.test(assetPath));

  return [...new Set(fullSourcePage ? [fullSourcePage] : sourceAssets)];
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ paperId: string; questionId: string }>;
}) {
  const { paperId, questionId } = await params;
  const initialCookieStore = await cookies();
  const initialAccessMode = resolveNodeAccessMode(
    {
      normalToken: initialCookieStore.get(AUTH_COOKIE_NAME)?.value,
      demoToken: initialCookieStore.get(DEMO_AUTH_COOKIE_NAME)?.value,
    },
    process.env.AUTH_SESSION_SECRET,
  );
  const { db } = await import("@/lib/db");
  const paper = await db.paper.findUnique({
    where: { id: paperId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!paper) {
    notFound();
  }

  const currentIndex = paper.questions.findIndex((entry) => entry.id === questionId);
  const question = paper.questions[currentIndex];

  if (!question) {
    notFound();
  }

  const groups = uniqueQuestionGroups(paper, paper.questions);
  const groupKey = questionGroupKey(paper, question);
  const currentGroupIndex = groups.findIndex((entry) => entry.key === groupKey);
  const currentGroup = groups[currentGroupIndex];

  if (!currentGroup) {
    notFound();
  }

  const sourceMaterialImagePaths = sourceMaterialImagePathsForGroup(
    paper.adapterKey,
    currentGroup.key,
    currentGroup.questions,
  );
  const formQuestions = currentGroup.questions.map((groupQuestion) => {
    const paperOnlyQuestion = detectPaperOnlyQuestion({
      questionText: groupQuestion.extractedQuestionText,
    });
    const selectionQuestion = paperOnlyQuestion
      ? null
      : detectSelectionQuestion({
          maxMarks: groupQuestion.maxMarks,
          questionText: groupQuestion.extractedQuestionText,
          markSchemeText: groupQuestion.markSchemeText,
        });

    return {
      id: groupQuestion.id,
      questionKey: groupQuestion.questionKey,
      maxMarks: groupQuestion.maxMarks,
      imagePath: groupQuestion.primaryCropPath,
      continuationImagePaths: parseSupportingAssetPaths(groupQuestion.supportingAssetPaths).filter(
        (assetPath) =>
          !isEdexcelHistoryMedicineSourceAsset(paper.adapterKey, groupQuestion.questionKey, assetPath) &&
          !sourceMaterialImagePaths.includes(assetPath),
      ),
      paperOnlyReason: paperOnlyQuestion?.reason ?? null,
      selectionQuestion: selectionQuestion
        ? {
            type: selectionQuestion.type,
            options: selectionQuestion.options,
          }
        : null,
    };
  });
  const previousGroup = groups[currentGroupIndex - 1] ?? null;
  const nextGroup = groups[currentGroupIndex + 1] ?? null;

  async function submit(_state: FormState, formData: FormData): Promise<FormState> {
    "use server";

    const submittedAnswers = Object.fromEntries(
      currentGroup.questions.map((groupQuestion) => [
        groupQuestion.id,
        String(formData.get(`answer-${groupQuestion.id}`) ?? ""),
      ]),
    );

    try {
      const requestHeaders = await headers();
      const rateLimitResult = checkRateLimit(clientRateLimitKeyFromHeaders(requestHeaders));

      if (!rateLimitResult.allowed) {
        return {
          error: rateLimitMessage(rateLimitResult),
          answers: submittedAnswers,
          submitted: true,
        };
      }

      const { gradeQuestionAttempt } = await import("@/lib/grading/grade-question");
      const cookieStore = await cookies();
      const accessMode = resolveNodeAccessMode(
        {
          normalToken: cookieStore.get(AUTH_COOKIE_NAME)?.value,
          demoToken: cookieStore.get(DEMO_AUTH_COOKIE_NAME)?.value,
        },
        process.env.AUTH_SESSION_SECRET,
      );

      if (!accessMode) {
        return {
          error: "Your session has expired. Refresh the page and sign in again.",
          answers: submittedAnswers,
          submitted: true,
        };
      }

      let gradedCount = 0;
      let skippedCount = 0;
      const results: LocalQuestionAttempt[] = [];

      for (const groupQuestion of currentGroup.questions) {
        const paperOnlyQuestion = detectPaperOnlyQuestion({
          questionText: groupQuestion.extractedQuestionText,
        });

        if (paperOnlyQuestion) {
          continue;
        }

        const answer = String(formData.get(`answer-${groupQuestion.id}`) ?? "");

        if (!answer.trim()) {
          continue;
        }

        if (formData.get(`skip-remark-${groupQuestion.id}`)) {
          skippedCount += 1;
          continue;
        }

        const result = await gradeQuestionAttempt({
          paperId,
          questionId: groupQuestion.id,
          answer,
          notes: "",
          accessMode,
        });
        results.push(result);
        gradedCount += 1;
      }

      if (gradedCount === 0 && skippedCount === 0) {
        return {
          error: "Enter an answer for at least one answerable part before submitting.",
          answers: submittedAnswers,
          submitted: true,
        };
      }

      return {
        error: null,
        answers: submittedAnswers,
        results,
        skippedCount,
        submitted: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown grading error",
        answers: submittedAnswers,
        submitted: true,
      };
    }
  }

  return (
    <main className="page-shell question-shell">
      <AnalyticsEvent
        name="Question Group Opened"
        props={{
          subject: paper.subject,
          qualification: paper.qualification,
          paperNumber: paper.paperNumber,
          tier: paper.tier,
          year: paper.year,
          groupKey: currentGroup.key,
          questionParts: currentGroup.questions.length,
        }}
      />
      <ProgressHeader
        paperTitle={paper.title}
        paperHref={paperHref(paper.id)}
        current={currentGroupIndex + 1}
        total={groups.length}
        previousHref={previousGroup ? questionHref(paper.id, previousGroup.firstQuestion.id) : null}
        nextHref={nextGroup ? questionHref(paper.id, nextGroup.firstQuestion.id) : null}
      />
      <div className="question-flow">
        <AnswerForm
          action={submit}
          disableAnimations={initialAccessMode === "demo"}
          analytics={{
            subject: paper.subject,
            qualification: paper.qualification,
            paperNumber: paper.paperNumber,
            tier: paper.tier,
            year: paper.year,
          }}
          paperId={paper.id}
          groupKey={currentGroup.key}
          nextHref={nextGroup ? questionHref(paper.id, nextGroup.firstQuestion.id) : null}
          sourceMaterialImagePaths={sourceMaterialImagePaths}
          questions={formQuestions}
        />
      </div>
    </main>
  );
}
