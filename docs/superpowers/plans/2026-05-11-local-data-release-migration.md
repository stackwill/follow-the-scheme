# Local Data Release Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate site code deployment from past-paper data updates so normal paper additions can be imported locally and shipped to the server without a GitHub push or production PDF download.

**Architecture:** Keep adapters, discovery code, and import verification in GitHub, but treat imported SQLite rows and crop images as a versioned local data release artifact. Production runs the Next.js app and Prisma migrations only; it never fetches PMT/OCR/AQA PDFs during deploy. Data releases are uploaded from Will's machine to the server, staged, verified, backed up, and then activated with an atomic directory switch.

**Tech Stack:** Next.js, Bun, Prisma, SQLite, Docker Compose, GitHub Actions, rsync/scp/ssh, tar + sha256sum.

---

## Current Findings

- `.github/workflows/deploy.yml` currently runs `docker compose run --rm app bun run import:sync` on the production server after migrations.
- `docker-compose.yml` mounts `./data:/app/data`; production data lives outside the container and survives image replacement.
- `src/lib/import/core/import-paper.ts` mixes three concerns: supported-paper registry, PDF acquisition/import orchestration, and database persistence.
- `data/app.db` stores absolute asset paths such as `data/crops/...` locally and `/app/data/crops/...` in Docker, which makes full database replacement sensitive to where the import ran.
- The web app only needs `Paper`, `Question`, crops, and existing user attempt data at runtime. It does not need discovery, PDF download, OCR recovery, rendering, or crop generation in production.
- Copyright risk should be treated as unresolved legal/product risk, not as an engineering assumption. AQA says exam papers, mark schemes, and reports are available for limited periods and may have content removed due to copyright restrictions; OCR says published materials are copyright-protected and older/third-party material may be unavailable or removed; PMT's legal notice prohibits redistribution or storing its content in another electronic retrieval system without permission.

References checked on 2026-05-11:

- AQA copyright and past paper policy: https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy
- AQA assessment material availability: https://www.aqa.org.uk/exams-administration/exams/whats-available-when
- OCR past paper policy: https://www.ocr.org.uk/qualifications/past-paper-finder/past-paper-policy/
- PMT legal notices: https://www.physicsandmathstutor.com/legal-notices/

## Production SSH Target

- External host: `91.151.248.184`
- SSH user: `will`
- SSH port: `42143`
- Verified on 2026-05-11 with `ssh -p 42143 will@91.151.248.184`; host responded as `deployme`.
- Use these defaults in the data-release upload script unless Will provides updated server details.

## Target Operating Model

1. Code changes go through GitHub only when importer/adapters/app code changes.
2. New paper data is produced locally with `bun run import:sync` or a targeted import.
3. A local release command validates and packages only the production-needed data:
   - `app.db`
   - `crops/`
   - a generated manifest
   - optional diagnostics
4. A deploy-data command uploads the release to the server over SSH.
5. The server stages the release, verifies checksums and required files, backs up current data, activates the new data, runs Prisma migrations if needed, and restarts the app.
6. GitHub Actions deploys code only:
   - builds/pushes image
   - copies compose file
   - runs Prisma migrations
   - restarts container
   - does not run `import:sync`

## Non-Goals

- Do not add a separate database server.
- Do not introduce S3/R2/object storage yet.
- Do not commit imported PDFs, crops, or SQLite databases to Git.
- Do not make production download PDFs from PMT/OCR/AQA.
- Do not rewrite every adapter in this migration. Keep adapter refactoring focused on removing the deploy-time hardcoded sync problem.

## Safety Invariants

- Never overwrite production data without first creating a timestamped backup on the server.
- Never activate a release if `app.db`, `crops/`, or the manifest is missing.
- Never upload source PDFs to production unless Will explicitly opts in.
- Never delete user attempts during data replacement.
- Never assume local absolute crop paths are portable; asset paths must be stored in a runtime-independent form before data releases are allowed.
- Every activation must be reversible with one command.

## Proposed File Structure

- Create `src/lib/import/registry.ts`
  - Owns supported paper definitions and years.
  - Replaces the hardcoded loops in `import-paper.ts`.
- Create `src/lib/import/core/import-supported.ts`
  - Imports one registry entry, one paper family, or all supported papers.
  - Calls the lower-level import orchestration.
- Modify `src/lib/import/core/import-paper.ts`
  - Keep low-level import orchestration here.
  - Remove supported-paper registry constants from this file.
  - Accept a definition object from `registry.ts`.
- Modify `src/lib/import/core/storage.ts`
  - Add portable asset path helpers.
  - Store DB crop/source paths relative to `APP_DATA_DIR`, not absolute local paths.
- Create `src/lib/assets/paths.ts`
  - Converts stored relative asset paths into filesystem paths for server-side rendering.
- Modify question rendering and smoke tests
  - Resolve stored relative paths before image serving / file checks.
- Create `scripts/create-data-release.ts`
  - Validates imported data and writes a tarball + manifest under `data/releases/`.
- Create `scripts/deploy-data-release.ts`
  - Uploads a release tarball to production and invokes the remote activation script.
- Create `scripts/activate-data-release.sh`
  - Runs on the server: stages, verifies, backs up, activates, migrates, restarts.
- Modify `.github/workflows/deploy.yml`
  - Remove production `bun run import:sync`.
  - Keep Prisma migration and app restart.
- Modify `docs/importing-new-papers.md`
  - Document the new normal workflow: adapter code push only when adapter changes; data release upload for paper additions.
- Create `docs/data-releases.md`
  - Operator guide for creating, uploading, verifying, and rolling back data releases.

---

### Task 1: Split Supported-Paper Registry From Import Orchestration

**Files:**
- Create: `src/lib/import/registry.ts`
- Create: `src/lib/import/core/import-supported.ts`
- Modify: `src/lib/import/core/import-paper.ts`
- Modify: `scripts/sync-supported-papers.ts`
- Test: `tests/import-registry.test.ts`

- [ ] **Step 1: Write registry tests**

Create `tests/import-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { supportedPaperDefinitions, yearsForDefinition } from "@/lib/import/registry";

describe("supported paper registry", () => {
  it("has unique adapter/year pairs", () => {
    const keys = supportedPaperDefinitions.flatMap((definition) =>
      yearsForDefinition(definition).map((year) => `${definition.adapterKey}:${year}`),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps every supported paper discoverable by deploy/local sync", () => {
    expect(
      supportedPaperDefinitions.map((definition) => ({
        adapterKey: definition.adapterKey,
        years: yearsForDefinition(definition),
      })),
    ).toEqual([
      {
        adapterKey: "aqa-combined-science-physics-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-combined-science-biology-paper-2-higher",
        years: [2023, 2024],
      },
      {
        adapterKey: "aqa-gcse-computer-science-paper-1b-python",
        years: [2024],
      },
      {
        adapterKey: "ocr-gcse-business-paper-1",
        years: [2023, 2024],
      },
      {
        adapterKey: "ocr-gcse-business-paper-2",
        years: [2023, 2024],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the registry test and confirm it fails**

Run:

```bash
bun run test -- tests/import-registry.test.ts
```

Expected: fail because `src/lib/import/registry.ts` does not exist.

- [ ] **Step 3: Create the registry**

Move the supported-paper definition type and definitions out of `src/lib/import/core/import-paper.ts` into `src/lib/import/registry.ts`.

The exported surface should be:

```ts
import {
  discoverAqaBiologyPaper1Higher,
  discoverAqaBiologyPaper2Higher,
  discoverAqaGcseComputerSciencePaper1BPython,
  discoverAqaPhysicsPaper1Higher,
  discoverOcrGcseBusinessPaper1,
  discoverOcrGcseBusinessPaper2,
} from "@/lib/import/pmt/discovery";
import { getPaperDir, getPaperDirForAdapter } from "@/lib/import/core/storage";

export const DEFAULT_SOURCE_PROVIDER = "PMT";
export const DEFAULT_SUBJECT_INDEX_URL = "https://www.physicsandmathstutor.com/past-papers/";
export const AQA_SCIENCE_FAMILY_PAGE_URL = "https://www.physicsandmathstutor.com/past-papers/gcse-science/";

export type SupportedImportYear = 2023 | 2024;
export type BiologyBenchmarkYear = 2023 | 2024;
export type ComputerScienceBenchmarkYear = 2024;
export type OcrBusinessBenchmarkYear = 2023 | 2024;

export type SupportedPaperCandidate =
  | Awaited<ReturnType<typeof discoverAqaPhysicsPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaBiologyPaper1Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaBiologyPaper2Higher>>[number]
  | Awaited<ReturnType<typeof discoverAqaGcseComputerSciencePaper1BPython>>[number]
  | Awaited<ReturnType<typeof discoverOcrGcseBusinessPaper1>>[number]
  | Awaited<ReturnType<typeof discoverOcrGcseBusinessPaper2>>[number];

export type SupportedPaperDefinition<Year extends SupportedImportYear = SupportedImportYear> = {
  adapterKey: string;
  sourceProvider?: string;
  subjectIndexUrl?: string;
  familyPageUrl: string;
  specCode: string;
  title: (candidate: SupportedPaperCandidate) => string;
  totalMarks: Record<Year, number>;
  discover: () => Promise<SupportedPaperCandidate[]>;
  paperDir: (year: Year) => string;
};

const AQA_PHYSICS_PAPER_1_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-physics-paper-1-higher";
const AQA_BIOLOGY_PAPER_1_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-biology-paper-1-higher";
const AQA_BIOLOGY_PAPER_2_HIGHER_ADAPTER_KEY =
  "aqa-combined-science-biology-paper-2-higher";
const AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_ADAPTER_KEY =
  "aqa-gcse-computer-science-paper-1b-python";
const OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY = "ocr-gcse-business-paper-1";
const OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY = "ocr-gcse-business-paper-2";

const SCIENCE_TOTAL_MARKS: Record<SupportedImportYear, number> = {
  2023: 70,
  2024: 70,
};

const COMPUTER_SCIENCE_TOTAL_MARKS: Record<ComputerScienceBenchmarkYear, number> = {
  2024: 90,
};

const OCR_BUSINESS_TOTAL_MARKS: Record<OcrBusinessBenchmarkYear, number> = {
  2023: 80,
  2024: 80,
};

export const supportedPaperDefinitions = [
  {
    adapterKey: AQA_PHYSICS_PAPER_1_HIGHER_ADAPTER_KEY,
    familyPageUrl: AQA_SCIENCE_FAMILY_PAGE_URL,
    specCode: "8464",
    title: (candidate) => `AQA Combined Science Trilogy Physics Paper 1 Higher ${candidate.sessionLabel}`,
    totalMarks: SCIENCE_TOTAL_MARKS,
    discover: discoverAqaPhysicsPaper1Higher,
    paperDir: getPaperDir,
  },
  {
    adapterKey: AQA_BIOLOGY_PAPER_1_HIGHER_ADAPTER_KEY,
    familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-1/",
    specCode: "8464",
    title: (candidate) => `AQA Combined Science Trilogy Biology Paper 1 Higher ${candidate.sessionLabel}`,
    totalMarks: SCIENCE_TOTAL_MARKS,
    discover: discoverAqaBiologyPaper1Higher,
    paperDir: (year) => getPaperDirForAdapter(AQA_BIOLOGY_PAPER_1_HIGHER_ADAPTER_KEY, year),
  },
  {
    adapterKey: AQA_BIOLOGY_PAPER_2_HIGHER_ADAPTER_KEY,
    familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-2/",
    specCode: "8464",
    title: (candidate) => `AQA Combined Science Trilogy Biology Paper 2 Higher ${candidate.sessionLabel}`,
    totalMarks: SCIENCE_TOTAL_MARKS,
    discover: discoverAqaBiologyPaper2Higher,
    paperDir: (year) => getPaperDirForAdapter(AQA_BIOLOGY_PAPER_2_HIGHER_ADAPTER_KEY, year),
  },
  {
    adapterKey: AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_ADAPTER_KEY,
    familyPageUrl: "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1",
    specCode: "8525",
    title: (candidate) => `AQA GCSE Computer Science Paper 1B Python ${candidate.sessionLabel}`,
    totalMarks: COMPUTER_SCIENCE_TOTAL_MARKS,
    discover: discoverAqaGcseComputerSciencePaper1BPython,
    paperDir: (year) => getPaperDirForAdapter(AQA_GCSE_COMPUTER_SCIENCE_PAPER_1B_PYTHON_ADAPTER_KEY, year),
  },
  {
    adapterKey: OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY,
    sourceProvider: "OCR",
    subjectIndexUrl: "https://www.ocr.org.uk/qualifications/past-paper-finder/",
    familyPageUrl: "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
    specCode: "J204",
    title: (candidate) => `OCR GCSE Business Paper 1: Business activity, marketing and people ${candidate.sessionLabel}`,
    totalMarks: OCR_BUSINESS_TOTAL_MARKS,
    discover: discoverOcrGcseBusinessPaper1,
    paperDir: (year) => getPaperDirForAdapter(OCR_GCSE_BUSINESS_PAPER_1_ADAPTER_KEY, year),
  },
  {
    adapterKey: OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY,
    sourceProvider: "OCR",
    subjectIndexUrl: "https://www.ocr.org.uk/qualifications/past-paper-finder/",
    familyPageUrl: "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
    specCode: "J204",
    title: (candidate) => `OCR GCSE Business Paper 2: Operations, finance and influences on business ${candidate.sessionLabel}`,
    totalMarks: OCR_BUSINESS_TOTAL_MARKS,
    discover: discoverOcrGcseBusinessPaper2,
    paperDir: (year) => getPaperDirForAdapter(OCR_GCSE_BUSINESS_PAPER_2_ADAPTER_KEY, year),
  },
] satisfies SupportedPaperDefinition[];

export function yearsForDefinition<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
) {
  return Object.keys(definition.totalMarks).map(Number) as Year[];
}
```

- [ ] **Step 4: Extract supported sync orchestration**

Create `src/lib/import/core/import-supported.ts`:

```ts
import { importSupportedPaper } from "@/lib/import/core/import-paper";
import {
  supportedPaperDefinitions,
  yearsForDefinition,
  type SupportedImportYear,
  type SupportedPaperDefinition,
} from "@/lib/import/registry";

import type { ImportPaperResult } from "@/lib/import/core/import-paper";

export async function importOneSupportedPaper<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  year: Year,
): Promise<ImportPaperResult> {
  return importSupportedPaper(definition, year);
}

export async function importAllSupportedPapers(): Promise<ImportPaperResult[]> {
  const results: ImportPaperResult[] = [];

  for (const definition of supportedPaperDefinitions) {
    for (const year of yearsForDefinition(definition)) {
      results.push(await importOneSupportedPaper(definition, year));
    }
  }

  return results;
}
```

- [ ] **Step 5: Simplify `import-paper.ts` exports**

In `src/lib/import/core/import-paper.ts`:

- Replace local definition types with imports from `registry.ts`.
- Rename `importBenchmarkPaper()` to exported `importSupportedPaper()`.
- Keep convenience wrappers only if tests or docs still use them.
- Delete `importAllSupportedBenchmarkPapers()` from this file.
- Keep `isUsefulQuestion052OcrOutput()` exported because `tests/aqa-adapter.test.ts` imports it.

The low-level signature should become:

```ts
export async function importSupportedPaper<Year extends SupportedImportYear>(
  definition: SupportedPaperDefinition<Year>,
  year: Year,
): Promise<ImportPaperResult> {
  await ensureDataDirs();
  return runSupportedPaperImport(definition, year);
}
```

Keep the current `importBenchmarkPaper()` implementation intact by renaming its body to a private `runSupportedPaperImport()` helper with the same generic signature. The point of this step is moving the registry out of this file, not rewriting the import algorithm.

- [ ] **Step 6: Update script import**

Change `scripts/sync-supported-papers.ts` to:

```ts
import { db } from "@/lib/db";
import { importAllSupportedPapers } from "@/lib/import/core/import-supported";

const results = await importAllSupportedPapers();

for (const result of results) {
  console.log(
    `Synced paper ${result.paperId}: ${result.questionCount} questions, ${result.totalMarks} marks`,
  );
}

await db.$disconnect();
```

- [ ] **Step 7: Verify**

Run:

```bash
bun run test -- tests/import-registry.test.ts
bun run test -- tests/aqa-adapter.test.ts tests/pmt-discovery.test.ts
bunx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/import/registry.ts src/lib/import/core/import-supported.ts src/lib/import/core/import-paper.ts scripts/sync-supported-papers.ts tests/import-registry.test.ts
git commit -m "Refactor supported paper registry"
```

---

### Task 2: Make Imported Asset Paths Portable

**Files:**
- Create: `src/lib/assets/paths.ts`
- Modify: `src/lib/import/core/storage.ts`
- Modify: `src/lib/import/core/import-paper.ts`
- Modify: `src/app/papers/[paperId]/questions/[questionId]/page.tsx`
- Modify: `src/components/questions/question-viewer.tsx` if it directly consumes filesystem paths
- Modify: `src/components/questions/answer-form.tsx` if it directly consumes filesystem paths
- Modify: `scripts/run-import-smoke.ts`
- Test: `tests/asset-paths.test.ts`

- [ ] **Step 1: Write asset path tests**

Create `tests/asset-paths.test.ts`:

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assetPathFromDataRoot,
  dataRootPathForAsset,
  isDataAssetPath,
} from "@/lib/assets/paths";

describe("data asset paths", () => {
  it("stores crop paths relative to APP_DATA_DIR", () => {
    const absolutePath = path.resolve("data/crops/imports/example/2024/01-1.png");

    expect(assetPathFromDataRoot(absolutePath)).toBe("crops/imports/example/2024/01-1.png");
  });

  it("resolves stored relative paths at runtime", () => {
    expect(dataRootPathForAsset("crops/imports/example/2024/01-1.png")).toMatch(
      /data\/crops\/imports\/example\/2024\/01-1\.png$/,
    );
  });

  it("rejects traversal paths", () => {
    expect(() => dataRootPathForAsset("../app.db")).toThrow(/Invalid data asset path/);
    expect(() => dataRootPathForAsset("/tmp/app.db")).toThrow(/Invalid data asset path/);
    expect(isDataAssetPath("crops/imports/example.png")).toBe(true);
    expect(isDataAssetPath("../example.png")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the asset path test and confirm it fails**

Run:

```bash
bun run test -- tests/asset-paths.test.ts
```

Expected: fail because `src/lib/assets/paths.ts` does not exist.

- [ ] **Step 3: Add asset path helpers**

Create `src/lib/assets/paths.ts`:

```ts
import path from "node:path";

import { dataRoot } from "@/lib/paths";

export function isDataAssetPath(assetPath: string) {
  if (assetPath.length === 0) {
    return false;
  }

  if (path.isAbsolute(assetPath)) {
    return false;
  }

  const normalized = path.posix.normalize(assetPath.replaceAll("\\", "/"));

  return normalized === assetPath && !normalized.startsWith("../") && normalized !== "..";
}

export function dataRootPathForAsset(assetPath: string) {
  if (!isDataAssetPath(assetPath)) {
    throw new Error(`Invalid data asset path: ${assetPath}`);
  }

  return path.join(dataRoot, assetPath);
}

export function assetPathFromDataRoot(absolutePath: string) {
  const relative = path.relative(dataRoot, absolutePath).replaceAll(path.sep, "/");

  if (!isDataAssetPath(relative)) {
    throw new Error(`Path is not inside APP_DATA_DIR: ${absolutePath}`);
  }

  return relative;
}
```

- [ ] **Step 4: Store relative paths during import**

In `src/lib/import/core/import-paper.ts`, import `assetPathFromDataRoot` and change `buildQuestionRecordData()` so:

```ts
primaryCropPath: assetPathFromDataRoot(cropPath),
supportingAssetPaths: JSON.stringify(supportingAssetPaths.map(assetPathFromDataRoot)),
```

Also change `questionPaperAssetPath` and `markSchemeAssetPath` persistence to relative paths:

```ts
questionPaperAssetPath: assetPathFromDataRoot(questionPaperPath),
markSchemeAssetPath: assetPathFromDataRoot(markSchemePath),
```

- [ ] **Step 5: Resolve relative paths when rendering images**

Where the server passes image paths into components, resolve each stored relative path with `dataRootPathForAsset()`.

In `src/app/papers/[paperId]/questions/[questionId]/page.tsx`, change the mapped question shape to:

```ts
imagePath: dataRootPathForAsset(groupQuestion.primaryCropPath),
continuationImagePaths: parseSupportingAssetPaths(groupQuestion.supportingAssetPaths).map(dataRootPathForAsset),
```

Add:

```ts
import { dataRootPathForAsset } from "@/lib/assets/paths";
```

- [ ] **Step 6: Preserve backwards compatibility for existing absolute paths**

Before the first production data release, run a one-time local compatibility migration script in Task 3. Do not teach the app to accept arbitrary absolute DB paths forever; that keeps the portability bug alive.

- [ ] **Step 7: Update smoke checks**

In `scripts/run-import-smoke.ts`, resolve paths before `access()` and `sharp()` calls:

```ts
import { dataRootPathForAsset } from "@/lib/assets/paths";

const cropFilePath = dataRootPathForAsset(question.primaryCropPath);
await access(cropFilePath);
const metadata = await sharp(cropFilePath).metadata();
```

For supporting paths:

```ts
const supportingAssetPaths = (JSON.parse(question.supportingAssetPaths) as string[]).map(dataRootPathForAsset);
```

- [ ] **Step 8: Verify**

Run:

```bash
bun run test -- tests/asset-paths.test.ts
bun run import:sync
bun run import:smoke
bunx tsc --noEmit
```

Expected:

- tests pass
- reimported DB rows contain relative paths like `crops/imports/...`
- smoke can still open all crop images

- [ ] **Step 9: Commit**

```bash
git add src/lib/assets/paths.ts src/lib/import/core/storage.ts src/lib/import/core/import-paper.ts src/app/papers/[paperId]/questions/[questionId]/page.tsx scripts/run-import-smoke.ts tests/asset-paths.test.ts
git commit -m "Store import asset paths relative to data root"
```

---

### Task 3: Preserve User Attempts During Data Releases

**Files:**
- Create: `src/lib/data/attempt-transfer.ts`
- Create: `scripts/export-attempts.ts`
- Create: `scripts/import-attempts.ts`
- Create: `scripts/normalize-data-paths.ts`
- Test: `tests/data-release-attempts.test.ts`

Rationale: a full `app.db` replacement will otherwise wipe live `Attempt` and `QuestionAttempt` rows. This is unacceptable once anyone has used the live site. The migration should separate imported paper content from user-generated attempt data.

- [ ] **Step 1: Write attempt preservation tests**

Create `tests/data-release-attempts.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildAttemptExport,
  findPaperForAttemptImport,
  type AttemptExportInput,
} from "@/lib/data/attempt-transfer";

describe("data release attempt preservation", () => {
  it("exports attempts keyed by stable paper and question identity", () => {
    const input = [
      {
        mode: "practice",
        startedAt: new Date("2026-05-11T10:00:00.000Z"),
        completedAt: new Date("2026-05-11T10:05:00.000Z"),
        paper: {
          adapterKey: "aqa-combined-science-biology-paper-1-higher",
          year: 2024,
          sessionLabel: "June 2024",
          paperNumber: 1,
          tier: "Higher",
        },
        answers: [
          {
            question: {
              questionKey: "07.2",
            },
            submittedAnswer: "No clear zone around C or E.",
            awardedMarks: 2,
            maxMarks: 2,
            gradingReasoning: "Matches resistance evidence.",
            feedback: "Good evidence.",
            rawModelResponse: "{}",
            promptVersion: "v1",
            createdAt: new Date("2026-05-11T10:04:00.000Z"),
          },
        ],
      },
    ] satisfies AttemptExportInput[];

    expect(buildAttemptExport(input)).toEqual({
      exportedAt: expect.any(String),
      attempts: [
        {
          mode: "practice",
          startedAt: "2026-05-11T10:00:00.000Z",
          completedAt: "2026-05-11T10:05:00.000Z",
          paperIdentity: {
            adapterKey: "aqa-combined-science-biology-paper-1-higher",
            year: 2024,
            sessionLabel: "June 2024",
            paperNumber: 1,
            tier: "Higher",
          },
          answers: [
            {
              questionKey: "07.2",
              submittedAnswer: "No clear zone around C or E.",
              awardedMarks: 2,
              maxMarks: 2,
              gradingReasoning: "Matches resistance evidence.",
              feedback: "Good evidence.",
              rawModelResponse: "{}",
              promptVersion: "v1",
              createdAt: "2026-05-11T10:04:00.000Z",
            },
          ],
        },
      ],
    });
  });

  it("finds the refreshed paper row without depending on generated IDs", () => {
    const papers = [
      {
        id: "new-paper-id",
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        year: 2024,
        sessionLabel: "June 2024",
        paperNumber: 1,
        tier: "Higher",
      },
    ];

    expect(
      findPaperForAttemptImport(papers, {
        adapterKey: "aqa-combined-science-biology-paper-1-higher",
        year: 2024,
        sessionLabel: "June 2024",
        paperNumber: 1,
        tier: "Higher",
      }),
    ).toEqual(papers[0]);
  });
});
```

- [ ] **Step 2: Implement attempt transfer helpers**

Create `src/lib/data/attempt-transfer.ts`:

```ts
export type PaperAttemptIdentity = {
  adapterKey: string;
  year: number;
  sessionLabel: string;
  paperNumber: number;
  tier: string;
};

export type AttemptExportInput = {
  mode: string;
  startedAt: Date;
  completedAt: Date | null;
  paper: PaperAttemptIdentity;
  answers: Array<{
    question: {
      questionKey: string;
    };
    submittedAnswer: string;
    awardedMarks: number;
    maxMarks: number;
    gradingReasoning: string;
    feedback: string;
    rawModelResponse: string;
    promptVersion: string;
    createdAt: Date;
  }>;
};

export type AttemptExport = {
  exportedAt: string;
  attempts: Array<{
    mode: string;
    startedAt: string;
    completedAt: string | null;
    paperIdentity: PaperAttemptIdentity;
    answers: Array<{
      questionKey: string;
      submittedAnswer: string;
      awardedMarks: number;
      maxMarks: number;
      gradingReasoning: string;
      feedback: string;
      rawModelResponse: string;
      promptVersion: string;
      createdAt: string;
    }>;
  }>;
};

export function buildAttemptExport(attempts: AttemptExportInput[]): AttemptExport {
  return {
    exportedAt: new Date().toISOString(),
    attempts: attempts.map((attempt) => ({
      mode: attempt.mode,
      startedAt: attempt.startedAt.toISOString(),
      completedAt: attempt.completedAt?.toISOString() ?? null,
      paperIdentity: attempt.paper,
      answers: attempt.answers.map((answer) => ({
        questionKey: answer.question.questionKey,
        submittedAnswer: answer.submittedAnswer,
        awardedMarks: answer.awardedMarks,
        maxMarks: answer.maxMarks,
        gradingReasoning: answer.gradingReasoning,
        feedback: answer.feedback,
        rawModelResponse: answer.rawModelResponse,
        promptVersion: answer.promptVersion,
        createdAt: answer.createdAt.toISOString(),
      })),
    })),
  };
}

export function findPaperForAttemptImport<T extends PaperAttemptIdentity>(
  papers: T[],
  identity: PaperAttemptIdentity,
) {
  return (
    papers.find(
      (paper) =>
        paper.adapterKey === identity.adapterKey &&
        paper.year === identity.year &&
        paper.sessionLabel === identity.sessionLabel &&
        paper.paperNumber === identity.paperNumber &&
        paper.tier === identity.tier,
    ) ?? null
  );
}
```

- [ ] **Step 3: Implement attempt export**

Create `scripts/export-attempts.ts`:

```ts
import { writeFile } from "node:fs/promises";

import { buildAttemptExport } from "@/lib/data/attempt-transfer";
import { db } from "@/lib/db";

const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error("Usage: bun run scripts/export-attempts.ts <output.json>");
}

const attempts = await db.attempt.findMany({
  include: {
    paper: {
      select: {
        adapterKey: true,
        year: true,
        sessionLabel: true,
        paperNumber: true,
        tier: true,
      },
    },
    answers: {
      include: {
        question: {
          select: {
            questionKey: true,
          },
        },
      },
    },
  },
});

await writeFile(
  outputPath,
  `${JSON.stringify(buildAttemptExport(attempts), null, 2)}\n`,
  "utf8",
);

await db.$disconnect();
```

- [ ] **Step 4: Implement attempt import**

Create `scripts/import-attempts.ts`:

```ts
import { readFile } from "node:fs/promises";

import { findPaperForAttemptImport, type AttemptExport } from "@/lib/data/attempt-transfer";
import { db } from "@/lib/db";

const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error("Usage: bun run scripts/import-attempts.ts <input.json>");
}

const parsed = JSON.parse(await readFile(inputPath, "utf8")) as AttemptExport;
const papers = await db.paper.findMany({
  include: {
    questions: {
      select: {
        id: true,
        questionKey: true,
      },
    },
  },
});

for (const exportedAttempt of parsed.attempts) {
  const paper = findPaperForAttemptImport(papers, exportedAttempt.paperIdentity);

  if (!paper) {
    throw new Error(
      `Cannot restore attempt for missing paper ${exportedAttempt.paperIdentity.adapterKey}/${exportedAttempt.paperIdentity.year}/${exportedAttempt.paperIdentity.sessionLabel}`,
    );
  }

  const questionsByKey = new Map(paper.questions.map((question) => [question.questionKey, question]));

  await db.$transaction(async (transaction) => {
    const attempt = await transaction.attempt.create({
      data: {
        paperId: paper.id,
        mode: exportedAttempt.mode,
        startedAt: new Date(exportedAttempt.startedAt),
        completedAt: exportedAttempt.completedAt ? new Date(exportedAttempt.completedAt) : null,
      },
    });

    for (const exportedAnswer of exportedAttempt.answers) {
      const question = questionsByKey.get(exportedAnswer.questionKey);

      if (!question) {
        throw new Error(
          `Cannot restore answer for missing question ${paper.adapterKey}/${paper.year}/${exportedAnswer.questionKey}`,
        );
      }

      await transaction.questionAttempt.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          submittedAnswer: exportedAnswer.submittedAnswer,
          awardedMarks: exportedAnswer.awardedMarks,
          maxMarks: exportedAnswer.maxMarks,
          gradingReasoning: exportedAnswer.gradingReasoning,
          feedback: exportedAnswer.feedback,
          rawModelResponse: exportedAnswer.rawModelResponse,
          promptVersion: exportedAnswer.promptVersion,
          createdAt: new Date(exportedAnswer.createdAt),
        },
      });
    }
  });
}

await db.$disconnect();
```

- [ ] **Step 5: Add one-time path normalization script**

Create `scripts/normalize-data-paths.ts`:

```ts
import { db } from "@/lib/db";
import { assetPathFromDataRoot, isDataAssetPath } from "@/lib/assets/paths";

function normalizePath(storedPath: string) {
  return isDataAssetPath(storedPath) ? storedPath : assetPathFromDataRoot(storedPath);
}

const papers = await db.paper.findMany({
  select: {
    id: true,
    questionPaperAssetPath: true,
    markSchemeAssetPath: true,
  },
});

for (const paper of papers) {
  await db.paper.update({
    where: { id: paper.id },
    data: {
      questionPaperAssetPath: normalizePath(paper.questionPaperAssetPath),
      markSchemeAssetPath: normalizePath(paper.markSchemeAssetPath),
    },
  });
}

const questions = await db.question.findMany({
  select: {
    id: true,
    primaryCropPath: true,
    supportingAssetPaths: true,
  },
});

for (const question of questions) {
  const supportingAssetPaths = JSON.parse(question.supportingAssetPaths) as string[];

  await db.question.update({
    where: { id: question.id },
    data: {
      primaryCropPath: normalizePath(question.primaryCropPath),
      supportingAssetPaths: JSON.stringify(supportingAssetPaths.map(normalizePath)),
    },
  });
}

await db.$disconnect();
```

- [ ] **Step 6: Verify**

Run:

```bash
bun run test -- tests/data-release-attempts.test.ts
bun run scripts/normalize-data-paths.ts
bun run import:smoke
```

Expected:

- attempt export/import tests pass
- local DB paths are relative
- smoke still passes

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/attempt-transfer.ts scripts/export-attempts.ts scripts/import-attempts.ts scripts/normalize-data-paths.ts tests/data-release-attempts.test.ts
git commit -m "Preserve attempts across data releases"
```

---

### Task 4: Create Local Data Release Bundles

**Files:**
- Create: `scripts/create-data-release.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/data-release-manifest.test.ts`

- [ ] **Step 1: Write manifest test**

Create `tests/data-release-manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildDataReleaseManifest } from "@/scripts/create-data-release";

describe("data release manifest", () => {
  it("includes version, app database, crops count, and source commit", () => {
    const manifest = buildDataReleaseManifest({
      releaseName: "data-2026-05-11T120000Z",
      gitCommit: "abc123",
      appDbSha256: "0".repeat(64),
      cropFileCount: 42,
      paperCount: 10,
      questionCount: 337,
    });

    expect(manifest).toEqual({
      schemaVersion: 1,
      releaseName: "data-2026-05-11T120000Z",
      createdAt: expect.any(String),
      gitCommit: "abc123",
      files: {
        appDb: {
          path: "app.db",
          sha256: "0".repeat(64),
        },
      },
      counts: {
        crops: 42,
        papers: 10,
        questions: 337,
      },
    });
  });
});
```

- [ ] **Step 2: Implement release creation**

Create `scripts/create-data-release.ts`.

The script must:

- run from the repo root
- require `data/app.db`
- require at least one file under `data/crops/imports`
- fail if any `Paper.questionPaperAssetPath`, `Paper.markSchemeAssetPath`, `Question.primaryCropPath`, or `Question.supportingAssetPaths` entry is absolute
- write `data/releases/<release-name>/manifest.json`
- copy `data/app.db` into the release directory
- copy `data/crops` into the release directory
- create `data/releases/<release-name>.tar.gz`
- create `data/releases/<release-name>.tar.gz.sha256`
- exclude `data/sources` by default

Core exported helper:

```ts
export function buildDataReleaseManifest(input: {
  releaseName: string;
  gitCommit: string;
  appDbSha256: string;
  cropFileCount: number;
  paperCount: number;
  questionCount: number;
}) {
  return {
    schemaVersion: 1,
    releaseName: input.releaseName,
    createdAt: new Date().toISOString(),
    gitCommit: input.gitCommit,
    files: {
      appDb: {
        path: "app.db",
        sha256: input.appDbSha256,
      },
    },
    counts: {
      crops: input.cropFileCount,
      papers: input.paperCount,
      questions: input.questionCount,
    },
  };
}
```

Use `Bun.spawn()` or `node:child_process` to call:

```bash
tar -czf data/releases/<release-name>.tar.gz -C data/releases/<release-name> .
sha256sum data/releases/<release-name>.tar.gz > data/releases/<release-name>.tar.gz.sha256
```

- [ ] **Step 3: Add package scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "data:normalize-paths": "bun run scripts/normalize-data-paths.ts",
    "data:release": "bun run scripts/create-data-release.ts"
  }
}
```

Keep existing scripts.

- [ ] **Step 4: Ignore local release artifacts**

Add to `.gitignore`:

```gitignore
data/releases/
```

- [ ] **Step 5: Verify**

Run:

```bash
bun run test -- tests/data-release-manifest.test.ts
bun run data:normalize-paths
bun run data:release
tar -tzf data/releases/*.tar.gz | sed -n '1,40p'
```

Expected tar contents include:

```text
./app.db
./crops/
./manifest.json
```

Expected tar contents do not include:

```text
./sources/
```

- [ ] **Step 6: Commit**

```bash
git add scripts/create-data-release.ts package.json .gitignore tests/data-release-manifest.test.ts
git commit -m "Add local data release packaging"
```

---

### Task 5: Add Safe Server Activation And Rollback

**Files:**
- Create: `scripts/activate-data-release.sh`
- Create: `scripts/deploy-data-release.ts`
- Modify: `package.json`
- Create: `docs/data-releases.md`

- [ ] **Step 1: Add remote activation script**

Create `scripts/activate-data-release.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/follow-the-scheme}"
CONTAINER_NAME="${CONTAINER_NAME:-follow-the-scheme}"
RELEASE_TARBALL="${1:?Usage: activate-data-release.sh <release-tarball>}"
RELEASE_SHA="${RELEASE_TARBALL}.sha256"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGING_DIR="$APP_DIR/data-staging-$TIMESTAMP"
BACKUP_DIR="$APP_DIR/data-backups/data-$TIMESTAMP"

cd "$APP_DIR"

if [ ! -f "$RELEASE_TARBALL" ]; then
  echo "Missing release tarball: $RELEASE_TARBALL" >&2
  exit 1
fi

if [ ! -f "$RELEASE_SHA" ]; then
  echo "Missing release checksum: $RELEASE_SHA" >&2
  exit 1
fi

sha256sum -c "$RELEASE_SHA"
mkdir -p "$STAGING_DIR"
tar -xzf "$RELEASE_TARBALL" -C "$STAGING_DIR"

test -f "$STAGING_DIR/app.db"
test -d "$STAGING_DIR/crops"
test -f "$STAGING_DIR/manifest.json"

mkdir -p "$APP_DIR/data-backups"

if [ -d "$APP_DIR/data" ]; then
  cp -a "$APP_DIR/data" "$BACKUP_DIR"
fi

mkdir -p "$STAGING_DIR/logs" "$STAGING_DIR/renders" "$STAGING_DIR/sources"

if [ -f "$APP_DIR/data/app.db" ]; then
  docker compose run --rm app bun run scripts/export-attempts.ts /app/data/attempts-backup-$TIMESTAMP.json || true
  if [ -f "$APP_DIR/data/attempts-backup-$TIMESTAMP.json" ]; then
    cp "$APP_DIR/data/attempts-backup-$TIMESTAMP.json" "$STAGING_DIR/attempts-backup-$TIMESTAMP.json"
  fi
fi

rm -rf "$APP_DIR/data.previous"
if [ -d "$APP_DIR/data" ]; then
  mv "$APP_DIR/data" "$APP_DIR/data.previous"
fi
mv "$STAGING_DIR" "$APP_DIR/data"

docker compose run --rm app bunx prisma migrate deploy

if [ -f "$APP_DIR/data/attempts-backup-$TIMESTAMP.json" ]; then
  docker compose run --rm app bun run scripts/import-attempts.ts "/app/data/attempts-backup-$TIMESTAMP.json"
fi

docker compose up -d --force-recreate --remove-orphans

echo "Activated data release from $RELEASE_TARBALL"
echo "Backup: $BACKUP_DIR"
```

- [ ] **Step 2: Add local upload script**

Create `scripts/deploy-data-release.ts`.

The script should require:

- `DATA_RELEASE_TARBALL` or first CLI arg
- `DEPLOY_HOST`, default `91.151.248.184`
- `DEPLOY_USER`, default `will`
- `DEPLOY_PORT`, default `42143`
- `APP_DIR`, default `/opt/follow-the-scheme`

It should:

1. upload `scripts/activate-data-release.sh` to `$APP_DIR/activate-data-release.sh`
2. upload the tarball and `.sha256` to `$APP_DIR/incoming-data/`
3. run `bash "$APP_DIR/activate-data-release.sh" "$APP_DIR/incoming-data/<tarball-name>"`

Use `rsync -avz --progress -e "ssh -p $DEPLOY_PORT"` for uploads so interrupted uploads can resume.

- [ ] **Step 3: Add package script**

Modify `package.json`:

```json
{
  "scripts": {
    "data:deploy": "bun run scripts/deploy-data-release.ts"
  }
}
```

Keep existing scripts.

- [ ] **Step 4: Write operator docs**

Create `docs/data-releases.md`:

```md
# Data Releases

Use this when adding past papers that the app already knows how to import.

## Local release

```bash
bun run import:sync
bun run import:smoke
bun run data:normalize-paths
bun run data:release
```

## Deploy data

```bash
DEPLOY_HOST=91.151.248.184 DEPLOY_PORT=42143 APP_DIR=/opt/follow-the-scheme bun run data:deploy data/releases/<release>.tar.gz
```

## Rollback

SSH to the server:

```bash
ssh -p 42143 will@91.151.248.184
cd /opt/follow-the-scheme
mv data data.bad
mv data.previous data
docker compose up -d --force-recreate
```

## What is included

- `app.db`
- `crops/`
- `manifest.json`

## What is excluded

- source PDFs under `data/sources/`
- rendered page intermediates under `data/renders/`
- import logs unless explicitly added later
```

- [ ] **Step 5: Dry-run upload commands locally**

Run without a live deploy first:

```bash
bash -n scripts/activate-data-release.sh
bunx tsc --noEmit
```

If a staging server is available, run:

```bash
DEPLOY_HOST=<staging-host> APP_DIR=/opt/follow-the-scheme-staging bun run data:deploy data/releases/<release>.tar.gz
```

Expected:

- server has a new `data/` directory
- server has `data.previous/`
- app restarts
- paper list renders
- current question image renders

- [ ] **Step 6: Commit**

```bash
git add scripts/activate-data-release.sh scripts/deploy-data-release.ts package.json docs/data-releases.md
git commit -m "Add safe data release deployment"
```

---

### Task 6: Decouple GitHub Code Deploy From Paper Downloads

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `docs/importing-new-papers.md`

- [ ] **Step 1: Remove production import sync from deploy**

In `.github/workflows/deploy.yml`, delete:

```bash
docker compose run --rm app bun run import:sync
```

Keep:

```bash
docker compose run --rm app bunx prisma migrate deploy
docker compose up -d --force-recreate --remove-orphans
```

- [ ] **Step 2: Add a deploy log warning**

Add this before app restart:

```bash
echo "Code deploy only: paper data is managed by local data releases."
```

- [ ] **Step 3: Update paper docs**

In `docs/importing-new-papers.md`, change the deploy guidance:

- Adding a new year for an already-supported adapter:
  - run import locally
  - run smoke locally
  - create data release
  - deploy data release
  - no Git push required unless constants/registry year lists changed
- Adding a new adapter:
  - write adapter/discovery/tests in Git
  - push code
  - import locally
  - create/deploy data release
- Production server must not download PMT/OCR/AQA PDFs during code deploy.

- [ ] **Step 4: Verify workflow syntax and docs**

Run:

```bash
bunx tsc --noEmit
bun run lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml docs/importing-new-papers.md
git commit -m "Decouple code deploy from paper sync"
```

---

### Task 7: First Production Migration Runbook

**Files:**
- Modify: `docs/data-releases.md`

- [ ] **Step 1: Prepare local data**

Run locally:

```bash
git status -sb
bun run import:sync
bun run import:smoke
bun run data:normalize-paths
bun run data:release
```

Expected:

- working tree only has intentional code/doc changes
- import sync succeeds
- smoke succeeds
- release tarball exists

- [ ] **Step 2: Back up production before first activation**

SSH to server:

```bash
ssh -p 42143 will@91.151.248.184
cd /opt/follow-the-scheme
mkdir -p data-backups
cp -a data "data-backups/pre-local-data-release-$(date -u +%Y%m%dT%H%M%SZ)"
```

- [ ] **Step 3: Deploy code changes first**

Push migration code:

```bash
git push
```

Wait for GitHub Actions to complete. Confirm the app still runs with the existing `data/` volume.

- [ ] **Step 4: Deploy data release**

Run locally:

```bash
DEPLOY_HOST=91.151.248.184 DEPLOY_PORT=42143 APP_DIR=/opt/follow-the-scheme bun run data:deploy data/releases/<release>.tar.gz
```

- [ ] **Step 5: Verify production manually**

Open:

- `https://reallycool.lol/`
- a known Physics question
- Biology Paper 1 June 2023 page 7 / question 07.2
- Biology 2024 Paper 1 and Paper 2
- OCR Business 2024 if present

Acceptance:

- paper list loads
- question crops render
- no production import logs show new PMT/OCR/AQA downloads
- existing attempts, if any, still appear where expected

- [ ] **Step 6: Document rollback command**

Add this to `docs/data-releases.md`:

```bash
cd /opt/follow-the-scheme
docker compose down
rm -rf data.failed
mv data data.failed
mv data.previous data
docker compose up -d
```

- [ ] **Step 7: Commit runbook update**

```bash
git add docs/data-releases.md
git commit -m "Document first data release migration runbook"
```

---

## Review Pass

### Spec Coverage

- Separates site code from data: covered by Tasks 4, 5, and 6.
- Avoids Git pushes for routine paper additions: covered by target model, Tasks 4 and 5.
- Keeps adapters in GitHub: covered by target model and Task 6 docs.
- Avoids production PMT/OCR/AQA download and rate-limit risk: covered by Task 6 removing `import:sync` from GitHub Actions.
- Avoids PMT outage breaking deploys: covered by Task 6.
- Keeps migration safe: covered by Task 5 backups/activation and Task 7 runbook.
- Preserves user attempts: covered by Task 3.
- Keeps implementation simple: no remote DB server, no object storage, no new external service.

### Risk Review

- **High: replacing `app.db` can wipe attempts.** Task 3 handles export/relink/import before data releases are used. Do not skip it.
- **High: absolute asset paths make local DBs invalid in Docker.** Task 2 makes stored paths relative before release packaging.
- **High: copyright exposure is product/legal, not solved by architecture.** Excluding source PDFs from production reduces duplication, but crops still reproduce exam content. Get explicit permission or legal advice before assuming public hosting is allowed.
- **Medium: SQLite replacement while the app is running can cause brief read errors.** Task 5 stages data, switches directories, then restarts Docker. A short maintenance blip is acceptable for this app; if not, use a blue/green `data.current` symlink later.
- **Medium: Prisma migrations against a bundled DB can fail after schema changes.** Task 5 runs `prisma migrate deploy` after activation. The release script should be run from the same commit intended for production.
- **Medium: generated IDs can change across reimports.** Attempt preservation relinks by `adapterKey/year/sessionLabel/paperNumber/tier/questionKey`, not generated IDs.
- **Low: release tarballs can become large.** Crops are PNGs but still manageable for the current paper count. If upload time becomes painful, switch `data:deploy` to rsync a release directory instead of tarballs.

### Placeholder Scan

- No task depends on an unspecified external service.
- All new files have an explicit purpose.
- The only intentionally variable values are operator inputs such as `<release>`. The current known production SSH target is documented in this plan and `AGENTS.md`.

### Recommended Implementation Order

1. Task 1 first because it reduces `import-paper.ts` without behavior change.
2. Task 2 second because portable paths are a prerequisite for local DB shipping.
3. Task 3 before any production data replacement because attempts are user data.
4. Tasks 4 and 5 add packaging/deployment.
5. Task 6 removes production downloads only after data deployment exists.
6. Task 7 performs the first real migration.

### Go / No-Go Criteria

Go when:

- `bun run import:smoke` passes locally after path normalization.
- `bun run data:release` produces a tarball without `sources/`.
- a staged or first production activation preserves attempts and renders known question crops.
- GitHub Actions no longer runs `import:sync`.

No-go when:

- any DB row still stores an absolute `primaryCropPath`, `supportingAssetPaths`, `questionPaperAssetPath`, or `markSchemeAssetPath`.
- attempt export/import cannot relink answers after a regenerated import.
- the activation script cannot create a backup.
- the release would include source PDFs without explicit approval.
