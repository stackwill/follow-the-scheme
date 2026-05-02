# FollowTheScheme MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-ready Bun + Next.js MVP that can discover, import, store, display, and AI-mark AQA Combined Science Trilogy Physics Paper 1 Higher questions from PMT for June 2023 and June 2024.

**Architecture:** The app is a single-user-first Next.js App Router project backed by SQLite, Prisma, and a filesystem asset store. A deterministic import pipeline discovers PMT links, downloads `QP` and `MS` PDFs, parses and crops questions through a modular adapter system, then the web UI serves one question at a time and grades answers through OpenRouter with structured outputs.

**Tech Stack:** Bun, Next.js App Router, React, TypeScript, Prisma, SQLite, Zod, Cheerio, pdfjs-dist, Sharp, Vitest, Docker

---

## Planned File Structure

### Root

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `next-env.d.ts`
- Create: `.env.example`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md`

### Application

- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/app/api/assets/route.ts`
- Create: `src/app/papers/[paperId]/page.tsx`
- Create: `src/app/papers/[paperId]/questions/[questionId]/page.tsx`
- Create: `src/app/dev/imports/page.tsx`
- Create: `src/app/dev/imports/actions.ts`

### Infrastructure

- Create: `src/lib/env.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/paths.ts`
- Create: `src/lib/logger.ts`

### Import Pipeline

- Create: `src/lib/import/types.ts`
- Create: `src/lib/import/pmt/discovery.ts`
- Create: `src/lib/import/pmt/normalize.ts`
- Create: `src/lib/import/core/http.ts`
- Create: `src/lib/import/core/storage.ts`
- Create: `src/lib/import/core/pdf-text.ts`
- Create: `src/lib/import/core/pdf-render.ts`
- Create: `src/lib/import/core/crop.ts`
- Create: `src/lib/import/core/import-paper.ts`
- Create: `src/lib/import/core/diagnostics.ts`
- Create: `src/lib/import/adapters/base.ts`
- Create: `src/lib/import/adapters/aqa-combined-science-physics-paper-1-higher.ts`
- Create: `src/lib/import/adapters/index.ts`

### Grading

- Create: `src/lib/grading/schema.ts`
- Create: `src/lib/grading/prompt.ts`
- Create: `src/lib/grading/client.ts`
- Create: `src/lib/grading/grade-question.ts`

### Database

- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/0001_init/migration.sql`

### Components

- Create: `src/components/library/paper-card.tsx`
- Create: `src/components/questions/progress-header.tsx`
- Create: `src/components/questions/question-viewer.tsx`
- Create: `src/components/questions/answer-form.tsx`
- Create: `src/components/questions/result-panel.tsx`
- Create: `src/components/dev/import-status-table.tsx`

### Scripts And Tests

- Create: `scripts/fetch-benchmark-fixtures.ts`
- Create: `scripts/run-import-smoke.ts`
- Create: `tests/pmt-discovery.test.ts`
- Create: `tests/aqa-adapter.test.ts`
- Create: `tests/grading-schema.test.ts`

## Task 1: Scaffold The App And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `next-env.d.ts`
- Create: `.env.example`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md`

- [ ] **Step 1: Create the runtime and dependency manifest**

```json
{
  "name": "followthescheme",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "fixtures:fetch": "bun run scripts/fetch-benchmark-fixtures.ts",
    "import:smoke": "bun run scripts/run-import-smoke.ts"
  },
  "dependencies": {
    "@napi-rs/canvas": "^0.1.70",
    "@prisma/client": "^6.8.2",
    "cheerio": "^1.0.0",
    "next": "^15.3.1",
    "pdfjs-dist": "^5.2.133",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "sharp": "^0.34.1",
    "zod": "^3.24.4"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "@types/node": "^22.15.21",
    "@types/react": "^19.1.4",
    "@types/react-dom": "^19.1.5",
    "eslint": "^9.26.0",
    "eslint-config-next": "^15.3.1",
    "prisma": "^6.8.2",
    "typescript": "^5.8.3",
    "vitest": "^3.1.3"
  }
}
```

- [ ] **Step 2: Create the base Next.js and TypeScript config files**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```js
// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [...compat.extends("next/core-web-vitals", "next/typescript")];
```

```js
// postcss.config.mjs
export default {};
```

```ts
// next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is auto-discovered by Next.js.
```

- [ ] **Step 3: Add local-first configuration and container files**

```env
# .env.example
DATABASE_URL="file:./data/app.db"
APP_DATA_DIR="./data"
OPENROUTER_API_KEY="replace-me"
OPENROUTER_MODEL="anthropic/claude-3.7-sonnet"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
```

```dockerfile
# Dockerfile
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.2 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["bun", "run", "start"]
```

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
```

```md
# README.md

## FollowTheScheme

Single-user-first exam practice tool for deterministic PMT imports and AI-assisted marking.

### Setup

1. `cp .env.example .env`
2. `bun install`
3. `bun run db:generate`
4. `bun run db:migrate --name init`
5. `bun run dev`
```

- [ ] **Step 4: Install dependencies and generate the Bun lockfile**

Run: `bun install`
Expected: `bun.lock` is created and install completes without dependency resolution errors.

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json bun.lock tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs next-env.d.ts .env.example Dockerfile docker-compose.yml README.md
git commit -m "chore: scaffold next bun app shell"
```

## Task 2: Add The Database Schema And Foundational Services

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/env.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/paths.ts`
- Create: `src/lib/logger.ts`

- [ ] **Step 1: Create the Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model PaperSource {
  id               String   @id @default(cuid())
  provider         String
  subjectIndexUrl  String
  familyPageUrl    String
  paperPageUrl     String
  questionPaperUrl String
  markSchemeUrl    String
  examBoard        String
  qualification    String
  subject          String
  paperNumber      Int
  tier             String
  sessionLabel     String
  year             Int
  status           String   @default("discovered")
  lastDiscoveredAt DateTime @default(now())
  paper            Paper?

  @@unique([questionPaperUrl, markSchemeUrl])
}

model Paper {
  id                    String    @id @default(cuid())
  sourceId              String    @unique
  title                 String
  examBoard             String
  qualification         String
  subject               String
  paperNumber           Int
  tier                  String
  specCode              String
  sessionLabel          String
  year                  Int
  totalMarks            Int
  questionPaperAssetPath String
  markSchemeAssetPath    String
  importVersion         String
  adapterKey            String
  status                String    @default("ready")
  importedAt            DateTime  @default(now())
  source                PaperSource @relation(fields: [sourceId], references: [id])
  questions             Question[]
  attempts              Attempt[]
}

model Question {
  id                    String   @id @default(cuid())
  paperId               String
  questionKey           String
  displayOrder          Int
  maxMarks              Int
  extractedQuestionText String
  primaryCropPath       String
  supportingAssetPaths  String
  pageStart             Int
  pageEnd               Int
  boundingBoxes         String
  markSchemeText        String
  markSchemeNotes       String
  importDiagnostics     String
  paper                 Paper    @relation(fields: [paperId], references: [id], onDelete: Cascade)
  attempts              QuestionAttempt[]

  @@unique([paperId, questionKey])
}

model Attempt {
  id          String          @id @default(cuid())
  paperId     String
  mode        String
  startedAt   DateTime        @default(now())
  completedAt DateTime?
  paper       Paper           @relation(fields: [paperId], references: [id], onDelete: Cascade)
  answers     QuestionAttempt[]
}

model QuestionAttempt {
  id               String   @id @default(cuid())
  attemptId        String
  questionId       String
  submittedAnswer  String
  userNotes        String
  awardedMarks     Int
  maxMarks         Int
  gradingReasoning String
  feedback         String
  rawModelResponse String
  promptVersion    String
  createdAt        DateTime @default(now())
  attempt          Attempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question         Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add environment parsing and shared service helpers**

```ts
// src/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_DATA_DIR: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_DATA_DIR: process.env.APP_DATA_DIR,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
});
```

```ts
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

```ts
// src/lib/paths.ts
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { env } from "@/lib/env";

export const dataRoot = path.resolve(env.APP_DATA_DIR);
export const sourcesRoot = path.join(dataRoot, "sources");
export const rendersRoot = path.join(dataRoot, "renders");
export const cropsRoot = path.join(dataRoot, "crops");
export const logsRoot = path.join(dataRoot, "logs");

export async function ensureDataDirs() {
  for (const dir of [dataRoot, sourcesRoot, rendersRoot, cropsRoot, logsRoot]) {
    await mkdir(dir, { recursive: true });
  }
}
```

```ts
// src/lib/logger.ts
export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, meta }));
}

export function logError(message: string, meta?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, meta }));
}
```

- [ ] **Step 3: Generate the Prisma client and initial migration**

Run: `bun run db:generate && bun run db:migrate --name init`
Expected: Prisma generates the client and creates the first SQLite migration without schema errors.

- [ ] **Step 4: Commit the foundations**

```bash
git add prisma src/lib/env.ts src/lib/db.ts src/lib/paths.ts src/lib/logger.ts
git commit -m "feat: add database schema and core services"
```

## Task 3: Build PMT Discovery And Normalization

**Files:**
- Create: `src/lib/import/types.ts`
- Create: `src/lib/import/pmt/discovery.ts`
- Create: `src/lib/import/pmt/normalize.ts`
- Create: `src/lib/import/core/http.ts`
- Create: `tests/pmt-discovery.test.ts`

- [ ] **Step 1: Define import-domain types**

```ts
// src/lib/import/types.ts
export type ImportStatus = "discovered" | "importing" | "ready" | "failed";

export type PmtPaperCandidate = {
  paperPageUrl: string;
  questionPaperUrl: string;
  markSchemeUrl: string;
  examBoard: "AQA";
  qualification: "GCSE Combined Science Trilogy";
  subject: "Physics";
  paperNumber: 1;
  tier: "Higher";
  sessionLabel: string;
  year: number;
};
```

- [ ] **Step 2: Implement HTML fetching, normalization, and discovery**

```ts
// src/lib/import/core/http.ts
export async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "FollowTheScheme/0.1 (+local-dev-import)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}
```

```ts
// src/lib/import/pmt/normalize.ts
export function parseSessionLabel(label: string) {
  const match = label.match(/June\s+(\d{4})/i);

  if (!match) {
    throw new Error(`Unsupported session label: ${label}`);
  }

  return {
    sessionLabel: `June ${match[1]}`,
    year: Number(match[1]),
  };
}
```

```ts
// src/lib/import/pmt/discovery.ts
import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/import/core/http";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";
import type { PmtPaperCandidate } from "@/lib/import/types";

const FAMILY_URL = "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/";

export async function discoverAqaPhysicsPaper1Higher() {
  const html = await fetchHtml(FAMILY_URL);
  const $ = cheerio.load(html);
  const candidates: PmtPaperCandidate[] = [];

  const qpLinks = $("a[href*='Physics-1H/QP/']");
  const msLinks = $("a[href*='Physics-1H/MS/']");
  const msMap = new Map<string, string>();

  msLinks.each((_, element) => {
    const href = $(element).attr("href");
    const label = $(element).text().trim();

    if (href && label.startsWith("June")) {
      msMap.set(label, href);
    }
  });

  qpLinks.each((_, element) => {
    const href = $(element).attr("href");
    const label = $(element).text().trim();
    const markSchemeUrl = msMap.get(label.replace("QP", "MS")) ?? msMap.get(label.replace(" QP", ""));

    if (!href || !label.startsWith("June") || !markSchemeUrl) {
      return;
    }

    const { sessionLabel, year } = parseSessionLabel(label);

    candidates.push({
      paperPageUrl: FAMILY_URL,
      questionPaperUrl: href,
      markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber: 1,
      tier: "Higher",
      sessionLabel,
      year,
    });
  });

  return candidates.filter((candidate) => [2023, 2024].includes(candidate.year));
}
```

- [ ] **Step 3: Add a deterministic discovery test**

```ts
// tests/pmt-discovery.test.ts
import { describe, expect, it } from "vitest";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";

describe("parseSessionLabel", () => {
  it("extracts a June year label", () => {
    expect(parseSessionLabel("June 2024 QP")).toEqual({
      sessionLabel: "June 2024",
      year: 2024,
    });
  });
});
```

- [ ] **Step 4: Run discovery tests**

Run: `bun run test -- tests/pmt-discovery.test.ts`
Expected: Vitest passes the normalization test and exits with status `0`.

- [ ] **Step 5: Commit discovery**

```bash
git add src/lib/import/types.ts src/lib/import/pmt src/lib/import/core/http.ts tests/pmt-discovery.test.ts
git commit -m "feat: add pmt discovery for aqa physics paper 1 higher"
```

## Task 4: Add PDF Download, Rendering, And Crop Infrastructure

**Files:**
- Create: `src/lib/import/core/storage.ts`
- Create: `src/lib/import/core/pdf-text.ts`
- Create: `src/lib/import/core/pdf-render.ts`
- Create: `src/lib/import/core/crop.ts`
- Create: `scripts/fetch-benchmark-fixtures.ts`

- [ ] **Step 1: Implement source-file storage helpers**

```ts
// src/lib/import/core/storage.ts
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { sourcesRoot } from "@/lib/paths";

export function getPaperDir(year: number) {
  return path.join(
    sourcesRoot,
    "pmt",
    "aqa",
    "combined-science-trilogy",
    "physics",
    "paper-1",
    "higher",
    String(year),
  );
}

export async function downloadPdf(url: string, destination: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed PDF download ${url}: ${response.status}`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
```

- [ ] **Step 2: Implement text extraction, rendering, and cropping primitives**

```ts
// src/lib/import/core/pdf-text.ts
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type TextItem = {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function extractPdfTextItems(filePath: string) {
  const pdf = await getDocument(filePath).promise;
  const items: TextItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item)) continue;

      const [ , , , , x, y ] = item.transform;
      items.push({
        pageNumber,
        text: item.str,
        x,
        y,
        width: item.width ?? 0,
        height: item.height ?? 0,
      });
    }
  }

  return items;
}
```

```ts
// src/lib/import/core/pdf-render.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { rendersRoot } from "@/lib/paths";

export async function renderPdfPages(filePath: string, slug: string) {
  const outputDir = path.join(rendersRoot, slug);
  await mkdir(outputDir, { recursive: true });

  const pdf = await getDocument(filePath).promise;
  const pagePaths: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context as never, viewport }).promise;
    const pagePath = path.join(outputDir, `page-${pageNumber}.png`);
    await writeFile(pagePath, canvas.toBuffer("image/png"));
    pagePaths.push(pagePath);
  }

  return pagePaths;
}
```

```ts
// src/lib/import/core/crop.ts
import sharp from "sharp";

export async function cropRegion(inputPath: string, outputPath: string, box: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  await sharp(inputPath)
    .extract(box)
    .png()
    .toFile(outputPath);
}
```

- [ ] **Step 3: Create the benchmark fixture downloader**

```ts
// scripts/fetch-benchmark-fixtures.ts
import path from "node:path";
import { ensureDataDirs } from "@/lib/paths";
import { discoverAqaPhysicsPaper1Higher } from "@/lib/import/pmt/discovery";
import { downloadPdf, getPaperDir } from "@/lib/import/core/storage";

await ensureDataDirs();

const candidates = await discoverAqaPhysicsPaper1Higher();

for (const candidate of candidates) {
  const paperDir = getPaperDir(candidate.year);

  await downloadPdf(candidate.questionPaperUrl, path.join(paperDir, "question-paper.pdf"));
  await downloadPdf(candidate.markSchemeUrl, path.join(paperDir, "mark-scheme.pdf"));
}
```

- [ ] **Step 4: Fetch the benchmark PDFs**

Run: `bun run fixtures:fetch`
Expected: `data/sources/pmt/aqa/combined-science-trilogy/physics/paper-1/higher/2023/` and `2024/` both contain `question-paper.pdf` and `mark-scheme.pdf`.

- [ ] **Step 5: Commit the PDF infrastructure**

```bash
git add src/lib/import/core/storage.ts src/lib/import/core/pdf-text.ts src/lib/import/core/pdf-render.ts src/lib/import/core/crop.ts scripts/fetch-benchmark-fixtures.ts
git commit -m "feat: add pdf storage and rendering primitives"
```

## Task 5: Build The Adapter System And Deterministic Import Orchestrator

**Files:**
- Create: `src/lib/import/core/diagnostics.ts`
- Create: `src/lib/import/core/import-paper.ts`
- Create: `src/lib/import/adapters/base.ts`
- Create: `src/lib/import/adapters/aqa-combined-science-physics-paper-1-higher.ts`
- Create: `src/lib/import/adapters/index.ts`
- Create: `tests/aqa-adapter.test.ts`
- Create: `scripts/run-import-smoke.ts`

- [ ] **Step 1: Define adapter and diagnostics contracts**

```ts
// src/lib/import/adapters/base.ts
import type { TextItem } from "@/lib/import/core/pdf-text";

export type QuestionBox = {
  questionKey: string;
  pageStart: number;
  pageEnd: number;
  primaryBox: { left: number; top: number; width: number; height: number };
};

export type ImportedQuestionDraft = {
  questionKey: string;
  displayOrder: number;
  maxMarks: number;
  extractedQuestionText: string;
  markSchemeText: string;
  markSchemeNotes: string;
  pageStart: number;
  pageEnd: number;
  primaryBox: QuestionBox["primaryBox"];
};

export interface PaperFamilyAdapter {
  key: string;
  detectQuestionDrafts(questionItems: TextItem[], markSchemeItems: TextItem[]): ImportedQuestionDraft[];
}
```

```ts
// src/lib/import/core/diagnostics.ts
export type ImportStage =
  | "discover"
  | "download"
  | "extract-question-text"
  | "extract-markscheme-text"
  | "detect-questions"
  | "render"
  | "crop"
  | "persist";

export class ImportFailure extends Error {
  constructor(
    public readonly stage: ImportStage,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
```

- [ ] **Step 2: Implement the first AQA adapter**

```ts
// src/lib/import/adapters/aqa-combined-science-physics-paper-1-higher.ts
import type { PaperFamilyAdapter, ImportedQuestionDraft } from "@/lib/import/adapters/base";
import type { TextItem } from "@/lib/import/core/pdf-text";

function groupByLine(items: TextItem[]) {
  return items.reduce<Record<string, TextItem[]>>((accumulator, item) => {
    const key = `${item.pageNumber}:${Math.round(item.y)}`;
    accumulator[key] ??= [];
    accumulator[key].push(item);
    return accumulator;
  }, {});
}

export const aqaCombinedSciencePhysicsPaper1HigherAdapter: PaperFamilyAdapter = {
  key: "aqa-combined-science-physics-paper-1-higher",
  detectQuestionDrafts(questionItems, markSchemeItems) {
    const questionLines = Object.values(groupByLine(questionItems))
      .map((line) => line.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").trim())
      .filter(Boolean);

    const questionStarts = questionLines.filter((line) => /^\d+\s/.test(line));

    return questionStarts.map((line, index): ImportedQuestionDraft => ({
      questionKey: line.match(/^(\d+)/)?.[1] ?? String(index + 1),
      displayOrder: index + 1,
      maxMarks: Number(markSchemeItems.find((item) => item.text.includes("max"))?.text.match(/\d+/)?.[0] ?? 1),
      extractedQuestionText: line,
      markSchemeText: "",
      markSchemeNotes: "",
      pageStart: 1,
      pageEnd: 1,
      primaryBox: {
        left: 100,
        top: 100 + index * 300,
        width: 1400,
        height: 260,
      },
    }));
  },
};
```

```ts
// src/lib/import/adapters/index.ts
import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";

export const adapters = {
  [aqaCombinedSciencePhysicsPaper1HigherAdapter.key]: aqaCombinedSciencePhysicsPaper1HigherAdapter,
};
```

- [ ] **Step 3: Implement import orchestration and a smoke test script**

```ts
// src/lib/import/core/import-paper.ts
import path from "node:path";
import { db } from "@/lib/db";
import { ensureDataDirs, cropsRoot, dataRoot } from "@/lib/paths";
import { extractPdfTextItems } from "@/lib/import/core/pdf-text";
import { renderPdfPages } from "@/lib/import/core/pdf-render";
import { cropRegion } from "@/lib/import/core/crop";
import { discoverAqaPhysicsPaper1Higher } from "@/lib/import/pmt/discovery";
import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";

export async function importAqaPhysicsPaper1HigherBenchmark(year: 2023 | 2024) {
  await ensureDataDirs();

  const candidate = (await discoverAqaPhysicsPaper1Higher()).find(
    (entry) => entry.year === year,
  );

  if (!candidate) {
    throw new Error(`Missing PMT candidate for ${year}`);
  }

  const sourceDir = path.join(
    dataRoot,
    "sources",
    "pmt",
    "aqa",
    "combined-science-trilogy",
    "physics",
    "paper-1",
    "higher",
    String(year),
  );

  const questionPaperPath = path.join(sourceDir, "question-paper.pdf");
  const markSchemePath = path.join(sourceDir, "mark-scheme.pdf");

  const questionItems = await extractPdfTextItems(questionPaperPath);
  const markSchemeItems = await extractPdfTextItems(markSchemePath);
  const drafts = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts(questionItems, markSchemeItems);
  const renderPaths = await renderPdfPages(questionPaperPath, `aqa-paper-1-higher-${year}`);

  const source = await db.paperSource.upsert({
    where: {
      questionPaperUrl_markSchemeUrl: {
        questionPaperUrl: candidate.questionPaperUrl,
        markSchemeUrl: candidate.markSchemeUrl,
      },
    },
    update: {
      status: "importing",
      lastDiscoveredAt: new Date(),
    },
    create: {
      provider: "PMT",
      subjectIndexUrl: "https://www.physicsandmathstutor.com/past-papers/",
      familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/",
      paperPageUrl: candidate.paperPageUrl,
      questionPaperUrl: candidate.questionPaperUrl,
      markSchemeUrl: candidate.markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber: 1,
      tier: "Higher",
      sessionLabel: `June ${year}`,
      year,
      status: "importing",
    },
  });

  const paper = await db.paper.upsert({
    where: { sourceId: source.id },
    update: {
      title: `AQA Combined Science Trilogy Physics Paper 1 Higher ${year}`,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber: 1,
      tier: "Higher",
      specCode: "8464",
      sessionLabel: `June ${year}`,
      year,
      totalMarks: drafts.reduce((sum, draft) => sum + draft.maxMarks, 0),
      questionPaperAssetPath: questionPaperPath,
      markSchemeAssetPath: markSchemePath,
      importVersion: "v1",
      adapterKey: aqaCombinedSciencePhysicsPaper1HigherAdapter.key,
      status: "ready",
    },
    create: {
      sourceId: source.id,
      title: `AQA Combined Science Trilogy Physics Paper 1 Higher ${year}`,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber: 1,
      tier: "Higher",
      specCode: "8464",
      sessionLabel: `June ${year}`,
      year,
      totalMarks: drafts.reduce((sum, draft) => sum + draft.maxMarks, 0),
      questionPaperAssetPath: questionPaperPath,
      markSchemeAssetPath: markSchemePath,
      importVersion: "v1",
      adapterKey: aqaCombinedSciencePhysicsPaper1HigherAdapter.key,
      status: "ready",
    },
  });

  await db.question.deleteMany({
    where: { paperId: paper.id },
  });

  await db.question.createMany({
    data: await Promise.all(
      drafts.map(async (draft) => {
        const cropPath = path.join(cropsRoot, `${year}-${draft.questionKey}.png`);
        await cropRegion(renderPaths[draft.pageStart - 1], cropPath, draft.primaryBox);

        return {
          paperId: paper.id,
          questionKey: draft.questionKey,
          displayOrder: draft.displayOrder,
          maxMarks: draft.maxMarks,
          extractedQuestionText: draft.extractedQuestionText,
          primaryCropPath: cropPath,
          supportingAssetPaths: "[]",
          pageStart: draft.pageStart,
          pageEnd: draft.pageEnd,
          boundingBoxes: JSON.stringify(draft.primaryBox),
          markSchemeText: draft.markSchemeText,
          markSchemeNotes: draft.markSchemeNotes,
          importDiagnostics: "{}",
        };
      }),
    ),
  });

  return paper.id;
}
```

```ts
// scripts/run-import-smoke.ts
import { importAqaPhysicsPaper1HigherBenchmark } from "@/lib/import/core/import-paper";

await importAqaPhysicsPaper1HigherBenchmark(2023);
await importAqaPhysicsPaper1HigherBenchmark(2024);
console.log("Imported 2023 and 2024 benchmark papers");
```

```ts
// tests/aqa-adapter.test.ts
import { describe, expect, it } from "vitest";
import { aqaCombinedSciencePhysicsPaper1HigherAdapter } from "@/lib/import/adapters/aqa-combined-science-physics-paper-1-higher";

describe("aqa adapter", () => {
  it("detects numbered question starts from text lines", () => {
    const result = aqaCombinedSciencePhysicsPaper1HigherAdapter.detectQuestionDrafts(
      [
        { pageNumber: 1, text: "1", x: 10, y: 10, width: 10, height: 10 },
        { pageNumber: 1, text: "State", x: 20, y: 10, width: 20, height: 10 },
      ],
      [],
    );

    expect(result[0]?.questionKey).toBe("1");
  });
});
```

- [ ] **Step 4: Run the adapter tests and the benchmark import smoke script**

Run: `bun run test -- tests/aqa-adapter.test.ts && bun run import:smoke`
Expected: the adapter unit test passes and the smoke script creates paper and question rows plus crop files for both years.

- [ ] **Step 5: Commit the import orchestrator**

```bash
git add src/lib/import/core/diagnostics.ts src/lib/import/core/import-paper.ts src/lib/import/adapters src/lib/import/core scripts/run-import-smoke.ts tests/aqa-adapter.test.ts
git commit -m "feat: add deterministic import pipeline skeleton"
```

## Task 6: Build The Internal Import UI And The Paper Library

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/app/dev/imports/page.tsx`
- Create: `src/app/dev/imports/actions.ts`
- Create: `src/components/library/paper-card.tsx`
- Create: `src/components/dev/import-status-table.tsx`

- [ ] **Step 1: Create the base layout and global styles**

```tsx
// src/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* src/app/globals.css */
:root {
  color-scheme: light;
  --bg: #f7f7f2;
  --panel: #ffffff;
  --line: #d7d6cf;
  --text: #1f2421;
  --muted: #5d645f;
  --accent: #2559e6;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: radial-gradient(circle at top, #ffffff 0%, var(--bg) 60%);
  color: var(--text);
  font-family: "Segoe UI", sans-serif;
}
```

- [ ] **Step 2: Build the library page and reusable paper card**

```tsx
// src/components/library/paper-card.tsx
import Link from "next/link";
import type { Paper } from "@prisma/client";

export function PaperCard({ paper }: { paper: Paper }) {
  return (
    <article className="paper-card">
      <p>{paper.examBoard}</p>
      <h2>{paper.title}</h2>
      <p>{paper.sessionLabel}</p>
      <Link href={`/papers/${paper.id}`}>Open paper</Link>
    </article>
  );
}
```

```tsx
// src/app/page.tsx
import { db } from "@/lib/db";
import { PaperCard } from "@/components/library/paper-card";

export default async function HomePage() {
  const papers = await db.paper.findMany({
    orderBy: [{ year: "desc" }],
  });

  return (
    <main className="page-shell">
      <header className="page-header">
        <p>FollowTheScheme</p>
        <h1>Imported Papers</h1>
      </header>

      <section className="paper-grid">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Add the internal developer import screen**

```tsx
// src/app/dev/imports/actions.ts
"use server";

import { importAqaPhysicsPaper1HigherBenchmark } from "@/lib/import/core/import-paper";

export async function importBenchmarkPaper(formData: FormData) {
  const year = Number(formData.get("year"));

  if (year !== 2023 && year !== 2024) {
    throw new Error("Unsupported benchmark year");
  }

  await importAqaPhysicsPaper1HigherBenchmark(year);
}
```

```tsx
// src/app/dev/imports/page.tsx
import { importBenchmarkPaper } from "@/app/dev/imports/actions";

export default function DevImportsPage() {
  return (
    <main className="page-shell">
      <h1>Developer Imports</h1>
      <form action={importBenchmarkPaper}>
        <button name="year" value="2023">Import June 2023</button>
        <button name="year" value="2024">Import June 2024</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run the app and verify the paper library loads**

Run: `bun run dev`
Expected: `/` renders the paper library and `/dev/imports` shows benchmark import buttons without runtime crashes.

- [ ] **Step 5: Commit the library and import UI**

```bash
git add src/app src/components/library src/components/dev
git commit -m "feat: add paper library and developer import ui"
```

## Task 7: Build The Question Player And OpenRouter Grading Flow

**Files:**
- Create: `src/app/api/assets/route.ts`
- Create: `src/app/papers/[paperId]/page.tsx`
- Create: `src/app/papers/[paperId]/questions/[questionId]/page.tsx`
- Create: `src/components/questions/progress-header.tsx`
- Create: `src/components/questions/question-viewer.tsx`
- Create: `src/components/questions/answer-form.tsx`
- Create: `src/components/questions/result-panel.tsx`
- Create: `src/lib/grading/schema.ts`
- Create: `src/lib/grading/prompt.ts`
- Create: `src/lib/grading/client.ts`
- Create: `src/lib/grading/grade-question.ts`
- Create: `tests/grading-schema.test.ts`

- [ ] **Step 1: Create the grading contract and OpenRouter client**

```ts
// src/lib/grading/schema.ts
import { z } from "zod";

export const gradingResponseSchema = z.object({
  awardedMarks: z.number().int().min(0),
  reasoning: z.string().min(1),
  feedback: z.string().min(1),
  issues: z.array(z.string()).default([]),
});

export type GradingResponse = z.infer<typeof gradingResponseSchema>;
```

```ts
// src/lib/grading/prompt.ts
export function buildGradingPrompt(input: {
  questionKey: string;
  maxMarks: number;
  questionText: string;
  markSchemeText: string;
  answer: string;
}) {
  return [
    "You are grading as a strict AQA examiner.",
    `Question: ${input.questionKey}`,
    `Maximum marks: ${input.maxMarks}`,
    `Question text: ${input.questionText}`,
    `Mark scheme: ${input.markSchemeText}`,
    `Student answer: ${input.answer}`,
    "Return JSON with awardedMarks, reasoning, feedback, issues.",
    "Do not award more than the maximum marks.",
  ].join("\n\n");
}
```

```ts
// src/lib/grading/client.ts
import { env } from "@/lib/env";
import { gradingResponseSchema } from "@/lib/grading/schema";

export async function requestStructuredGrade(prompt: string) {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter grading failed: ${response.status}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return gradingResponseSchema.parse(JSON.parse(content));
}
```

- [ ] **Step 2: Add the grade-and-persist service**

```ts
// src/lib/grading/grade-question.ts
import { db } from "@/lib/db";
import { buildGradingPrompt } from "@/lib/grading/prompt";
import { requestStructuredGrade } from "@/lib/grading/client";

export async function gradeQuestionAttempt(input: {
  paperId: string;
  questionId: string;
  answer: string;
  notes: string;
}) {
  const question = await db.question.findUniqueOrThrow({
    where: { id: input.questionId },
  });

  let attempt = await db.attempt.findFirst({
    where: {
      paperId: input.paperId,
      completedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (!attempt) {
    attempt = await db.attempt.create({
      data: {
        paperId: input.paperId,
        mode: "question-by-question",
      },
    });
  }

  const prompt = buildGradingPrompt({
    questionKey: question.questionKey,
    maxMarks: question.maxMarks,
    questionText: question.extractedQuestionText,
    markSchemeText: question.markSchemeText,
    answer: input.answer,
  });

  const result = await requestStructuredGrade(prompt);

  const boundedMarks = Math.max(0, Math.min(question.maxMarks, result.awardedMarks));

  return db.questionAttempt.create({
    data: {
      attemptId: attempt.id,
      questionId: input.questionId,
      submittedAnswer: input.answer,
      userNotes: input.notes,
      awardedMarks: boundedMarks,
      maxMarks: question.maxMarks,
      gradingReasoning: result.reasoning,
      feedback: result.feedback,
      rawModelResponse: JSON.stringify(result),
      promptVersion: "grading-v1",
    },
  });
}
```

- [ ] **Step 3: Build the paper overview, asset route, question screen, and result state**

```tsx
// src/app/papers/[paperId]/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";

export default async function PaperOverviewPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  const paper = await db.paper.findUniqueOrThrow({
    where: { id: paperId },
    include: { questions: { orderBy: { displayOrder: "asc" } } },
  });

  return (
    <main className="page-shell">
      <h1>{paper.title}</h1>
      <p>{paper.sessionLabel}</p>
      <Link href={`/papers/${paper.id}/questions/${paper.questions[0]?.id}`}>Start paper</Link>
    </main>
  );
}
```

```ts
// src/app/api/assets/route.ts
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const assetPath = request.nextUrl.searchParams.get("path");

  if (!assetPath) {
    return new Response("Missing asset path", { status: 400 });
  }

  const file = await readFile(assetPath);

  return new Response(file, {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, max-age=60",
    },
  });
}
```

```tsx
// src/components/questions/progress-header.tsx
export function ProgressHeader({ current, total }: { current: number; total: number }) {
  const percentage = total === 0 ? 0 : (current / total) * 100;

  return (
    <header>
      <p>Question {current} of {total}</p>
      <div style={{ background: "#d7d6cf", height: 8, borderRadius: 999 }}>
        <div style={{ width: `${percentage}%`, height: "100%", background: "#2559e6", borderRadius: 999 }} />
      </div>
    </header>
  );
}
```

```tsx
// src/components/questions/question-viewer.tsx
import Image from "next/image";

export function QuestionViewer(props: {
  questionKey: string;
  imagePath: string;
  text: string;
}) {
  return (
    <section className="question-card">
      <p>{props.questionKey}</p>
      <Image
        src={`/api/assets?path=${encodeURIComponent(props.imagePath)}`}
        alt={`Question ${props.questionKey}`}
        width={1400}
        height={900}
      />
      <p>{props.text}</p>
    </section>
  );
}
```

```tsx
// src/components/questions/result-panel.tsx
export function ResultPanel(props: {
  awardedMarks: number;
  maxMarks: number;
  reasoning: string;
  feedback: string;
}) {
  return (
    <section className="result-panel">
      <h2>{props.awardedMarks} / {props.maxMarks}</h2>
      <p>{props.reasoning}</p>
      <p>{props.feedback}</p>
    </section>
  );
}
```

```tsx
// src/components/questions/answer-form.tsx
"use client";

import { useActionState } from "react";

export function AnswerForm(props: {
  action: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [state, formAction, pending] = useActionState(props.action, { error: null });

  return (
    <form action={formAction} className="answer-form">
      <label>
        Your answer
        <textarea name="answer" rows={8} required />
      </label>

      <label>
        Your notes (optional)
        <textarea name="notes" rows={4} />
      </label>

      {state.error ? <p>{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Marking..." : "Answer and continue"}
      </button>
    </form>
  );
}
```

```tsx
// src/app/papers/[paperId]/questions/[questionId]/page.tsx
import { db } from "@/lib/db";
import { gradeQuestionAttempt } from "@/lib/grading/grade-question";
import { ProgressHeader } from "@/components/questions/progress-header";
import { QuestionViewer } from "@/components/questions/question-viewer";
import { AnswerForm } from "@/components/questions/answer-form";
import { ResultPanel } from "@/components/questions/result-panel";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ paperId: string; questionId: string }>;
}) {
  const { paperId, questionId } = await params;
  const paper = await db.paper.findUniqueOrThrow({
    where: { id: paperId },
    include: { questions: { orderBy: { displayOrder: "asc" } } },
  });

  const question = paper.questions.find((entry) => entry.id === questionId);

  if (!question) {
    throw new Error("Question not found");
  }

  const currentIndex = paper.questions.findIndex((entry) => entry.id === questionId) + 1;
  const latestAttempt = await db.questionAttempt.findFirst({
    where: { questionId },
    orderBy: { createdAt: "desc" },
  });

  async function submit(state: { error: string | null }, formData: FormData) {
    "use server";

    try {
      await gradeQuestionAttempt({
        paperId,
        questionId,
        answer: String(formData.get("answer") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown grading error",
      };
    }
  }

  return (
    <main className="page-shell question-shell">
      <ProgressHeader current={currentIndex} total={paper.questions.length} />
      <QuestionViewer
        questionKey={question.questionKey}
        imagePath={question.primaryCropPath}
        text={question.extractedQuestionText}
      />
      {latestAttempt ? (
        <ResultPanel
          awardedMarks={latestAttempt.awardedMarks}
          maxMarks={latestAttempt.maxMarks}
          reasoning={latestAttempt.gradingReasoning}
          feedback={latestAttempt.feedback}
        />
      ) : null}
      <AnswerForm action={submit} />
    </main>
  );
}
```

- [ ] **Step 4: Add grading-schema validation tests**

```ts
// tests/grading-schema.test.ts
import { describe, expect, it } from "vitest";
import { gradingResponseSchema } from "@/lib/grading/schema";

describe("gradingResponseSchema", () => {
  it("accepts a valid grading payload", () => {
    expect(
      gradingResponseSchema.parse({
        awardedMarks: 3,
        reasoning: "Matched three mark points.",
        feedback: "Good explanation.",
        issues: [],
      }),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run the grading tests and verify one end-to-end question flow manually**

Run: `bun run test -- tests/grading-schema.test.ts`
Expected: the schema test passes, opening the first imported paper from `/` reaches a question page, and submitting an answer stores a `QuestionAttempt` row plus shows a rendered result panel on the same screen.

- [ ] **Step 6: Commit the question player and grading flow**

```bash
git add src/app/papers src/components/questions src/lib/grading tests/grading-schema.test.ts
git commit -m "feat: add question player and openrouter grading flow"
```

## Task 8: Add Import Diagnostics, Polish, And Final Verification

**Files:**
- Modify: `src/app/dev/imports/page.tsx`
- Modify: `src/lib/import/core/import-paper.ts`
- Modify: `README.md`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Surface import status and failure diagnostics in the internal dev UI**

```tsx
// src/components/dev/import-status-table.tsx
export function ImportStatusTable(props: {
  rows: Array<{
    year: number;
    status: string;
    details: string;
  }>;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Year</th>
          <th>Status</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.year}>
            <td>{row.year}</td>
            <td>{row.status}</td>
            <td>{row.details}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Document the full local setup, fixture import, and Docker run flow**

```md
## Local MVP flow

1. `cp .env.example .env`
2. `bun install`
3. `bun run db:generate`
4. `bun run db:migrate --name init`
5. `bun run fixtures:fetch`
6. `bun run import:smoke`
7. `bun run dev`

## Docker

1. `cp .env.example .env`
2. `docker compose up --build`
```

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
bun run test
bun run fixtures:fetch
bun run import:smoke
bun run build
```

Expected:

- all Vitest tests pass
- benchmark PDFs are downloaded locally
- both 2023 and 2024 imports complete
- Next.js production build succeeds

- [ ] **Step 4: Commit the diagnostics and final polish**

```bash
git add src/app/dev/imports/page.tsx src/components/dev/import-status-table.tsx src/lib/import/core/import-paper.ts README.md src/app/globals.css
git commit -m "feat: add import diagnostics and mvp polish"
```
