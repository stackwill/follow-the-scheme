-- CreateTable
CREATE TABLE "PaperSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "subjectIndexUrl" TEXT NOT NULL,
    "familyPageUrl" TEXT NOT NULL,
    "paperPageUrl" TEXT NOT NULL,
    "questionPaperUrl" TEXT NOT NULL,
    "markSchemeUrl" TEXT NOT NULL,
    "examBoard" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "paperNumber" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "sessionLabel" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "lastDiscoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examBoard" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "paperNumber" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "specCode" TEXT NOT NULL,
    "sessionLabel" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "questionPaperAssetPath" TEXT NOT NULL,
    "markSchemeAssetPath" TEXT NOT NULL,
    "importVersion" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Paper_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PaperSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "extractedQuestionText" TEXT NOT NULL,
    "primaryCropPath" TEXT NOT NULL,
    "supportingAssetPaths" TEXT NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "boundingBoxes" TEXT NOT NULL,
    "markSchemeText" TEXT NOT NULL,
    "markSchemeNotes" TEXT NOT NULL,
    "importDiagnostics" TEXT NOT NULL,
    CONSTRAINT "Question_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Attempt_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "submittedAnswer" TEXT NOT NULL,
    "userNotes" TEXT NOT NULL,
    "awardedMarks" INTEGER NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "gradingReasoning" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "rawModelResponse" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionAttempt_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaperSource_questionPaperUrl_markSchemeUrl_key" ON "PaperSource"("questionPaperUrl", "markSchemeUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_sourceId_key" ON "Paper"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_paperId_questionKey_key" ON "Question"("paperId", "questionKey");
