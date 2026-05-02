# FollowTheScheme Design

## Summary

FollowTheScheme is a single-user-first web app for practising past-paper questions one at a time and receiving AI-assisted marking that is anchored tightly to the official mark scheme. The MVP targets AQA Combined Science Trilogy Physics Higher, specifically Paper 1 for June 2023 and June 2024 from Physics & Maths Tutor (PMT).

The system has two hard constraints:

1. Import must be deterministic. AI is never used to discover, split, crop, or align questions.
2. Marking must be as constrained and mark-scheme-faithful as possible. AI acts as an examiner operating on exact extracted materials, not a generic tutor.

## Goals

- Import full PMT papers on demand and cache them locally.
- Discover direct question paper (`QP`) and mark scheme (`MS`) PDFs from PMT paper-family pages.
- Parse and split papers into markable questions using deterministic, family-specific rules.
- Produce high-quality cropped question screenshots that preserve the exam look and any relevant diagrams, graphs, or tables.
- Let the user answer one question per page in a clean, approachable UI.
- Send exact question content and exact matched mark-scheme content to OpenRouter for structured grading.
- Persist imported papers, attempts, marks, crops, and grading logs locally.
- Stay modular so new boards and paper families can be added later by implementing new adapters.

## Non-Goals For MVP

- No authentication or multi-user account model.
- No manual import-review workflow as a first-class feature.
- No AI-assisted import pipeline.
- No support for every PMT subject or board up front.
- No batch mirroring of the full PMT catalogue in v1, though the architecture should allow later bulk import tooling.

## Product Scope

### MVP User Scope

- Single-user-first.
- Deployable web app, but comfortable to run locally during development.
- Docker-ready from the start for later VPS deployment.

### MVP Content Scope

- Board/family: AQA Combined Science Trilogy Physics.
- Tier: Higher only.
- Paper family: Paper 1 only.
- Benchmark years: June 2023 and June 2024.
- Mode: one question at a time.

### Later Expansion Path

- More years for the same paper family.
- Paper 2 for the same family.
- Foundation tier.
- Other science families and eventually other boards via new adapters.
- Batch import tool for larger local libraries.

## Architecture

The application should be a Bun-managed full-stack TypeScript web app with four major subsystems.

### 1. Source Discovery

A deterministic scraper discovers:

- PMT subject index pages
- PMT family pages
- PMT paper pages
- direct `QP` and `MS` PDF URLs

For the initial family, this includes:

- `https://www.physicsandmathstutor.com/past-papers/`
- `https://www.physicsandmathstutor.com/past-papers/gcse-science/`
- `https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/`

The discovery layer stores canonical metadata and import candidates without downloading every asset up front.

### 2. Deterministic Import Pipeline

Given a selected PMT paper entry, the importer:

1. Downloads the `QP` and `MS` PDFs.
2. Stores them in a deterministic local directory.
3. Extracts text and layout coordinates.
4. Uses a paper-family adapter to identify question starts, ends, sub-parts, and linked visual regions.
5. Renders page images.
6. Produces cropped question screenshots and supplemental visual crops.
7. Parses the mark scheme into question-aligned units.
8. Aligns each imported question to its exact mark-scheme content and max mark.
9. Persists only successfully structured papers as selectable content.

If a question cannot be split, cropped, or aligned confidently by deterministic rules, the import fails explicitly rather than silently guessing.

### 3. Question Session + Marking

The user selects a paper and answers one question at a time. For each submitted answer, the system builds a tightly scoped grading payload containing only the exact materials relevant to that question and sends it to OpenRouter.

The model returns structured JSON with:

- awarded mark
- reasoning anchored to mark-scheme points
- concise feedback
- optional internal diagnostics

The grading layer validates the response before saving it.

### 4. Local Paper Library

Imported papers are cached locally in a structured database plus filesystem asset storage so the user can reopen content instantly without re-fetching PMT unless needed.

## Tech Stack

### Application

- Next.js App Router
- TypeScript
- Bun for package management and scripts

### Persistence

- SQLite for structured app data
- Prisma as ORM/migration layer
- Filesystem-based asset storage for PDFs and generated crops

### AI Access

- OpenRouter API
- structured JSON responses
- model configurable through local `.env`

### Deployment

- Docker from the beginning
- mounted persistent data directory
- `.env` file for secrets and runtime configuration

## Configuration

The app should read configuration from a local `.env` file during development and from a mounted `.env` file or equivalent secret file in deployment.

Expected configuration includes:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` for non-default compatible endpoints
- `OPENROUTER_MODEL`
- `APP_DATA_DIR`
- optional import and logging settings

The repo should not require the user to export environment variables manually for normal usage.

## Data Model

The model should be modular and conservative. Heavy binary assets stay on disk. The database stores structure, metadata, and references.

### PaperSource

Represents a discovered PMT paper candidate.

Fields include:

- `id`
- `provider` (`PMT`)
- `subjectIndexUrl`
- `familyPageUrl`
- `paperPageUrl`
- `questionPaperUrl`
- `markSchemeUrl`
- `examBoard`
- `qualificationFamily`
- `subject`
- `paperNumber`
- `tier`
- `sessionLabel`
- `year`
- `status`
- `lastDiscoveredAt`

### Paper

Represents one successfully imported paper.

Fields include:

- `id`
- `sourceId`
- `title`
- `examBoard`
- `subject`
- `qualificationFamily`
- `paperNumber`
- `tier`
- `specCode`
- `sessionLabel`
- `year`
- `totalMarks`
- `questionPaperAssetPath`
- `markSchemeAssetPath`
- `importedAt`
- `importVersion`
- `adapterKey`
- `status`

### Question

Represents one markable question or sub-question.

Fields include:

- `id`
- `paperId`
- `questionKey` such as `1`, `1b`, or `2.3`
- `displayOrder`
- `maxMarks`
- `extractedQuestionText`
- `primaryCropPath`
- `supportingAssetPaths`
- `pageStart`
- `pageEnd`
- `boundingBoxes`
- `markSchemeText`
- `markSchemeNotes`
- `importDiagnostics`

### Attempt

Represents one user session against a paper.

Fields include:

- `id`
- `paperId`
- `startedAt`
- `completedAt`
- `mode`

### QuestionAttempt

Stores one answer and grading result.

Fields include:

- `id`
- `attemptId`
- `questionId`
- `submittedAnswer`
- `userNotes`
- `awardedMarks`
- `maxMarks`
- `gradingReasoning`
- `feedback`
- `rawModelResponse`
- `promptVersion`
- `createdAt`

## Import Pipeline In Detail

### Step 1: Discover PMT Links

The discovery layer should parse PMT HTML directly. A headless browser is out of scope for the MVP and should only be considered in a future change if PMT stops exposing the needed links in server-rendered HTML.

Responsibilities:

- parse anchor links from index and family pages
- identify relevant paper-family pages
- identify `QP` and `MS` links on the paper page
- normalise labels like `June 2024`, `Specimen`, `Higher`, and `Foundation`

### Step 2: Download And Cache PDFs

Downloaded source files should be stored under a stable directory structure, for example:

`data/sources/pmt/aqa/combined-science-trilogy/physics/paper-1/higher/2024/`

This directory contains the original `QP` and `MS` files and any intermediate import artifacts that are worth keeping for debugging.

### Step 3: Parse Question Paper Layout

The core engine extracts text with positional metadata. The adapter then uses deterministic heuristics to detect:

- question number positions
- sub-question markers
- likely question start headings
- question end boundaries
- page continuation handling

The adapter must also decide which nearby non-text visual regions belong to a question.

This is where family-specific logic lives.

### Step 4: Render And Crop

Pages are rasterised to images. Using bounding boxes from the parser and adapter:

- create a primary question crop
- include adjacent diagrams/tables/graphs when they belong to the same question
- create supporting secondary crops if one large unified crop would become unreadable

The output should preserve the exam look and feel as much as possible while still being readable in the UI.

### Step 5: Parse Mark Scheme

The mark scheme parser extracts:

- question identifiers
- sub-part identifiers
- available marks
- examiner instructions
- acceptable / rejectable answer cues where structured enough to parse

This also remains fully deterministic and adapter-driven.

### Step 6: Align Questions To Mark Scheme

Each imported question must be matched to its exact mark-scheme section and mark total.

Alignment rules should:

- match by question key first
- use paper-family formatting assumptions where needed
- fail loudly if multiple plausible alignments exist without a deterministic tie-breaker

### Step 7: Persist Ready Paper

Only when all required question units are split, cropped, and aligned does the paper become selectable in the normal paper library.

## Modularity And Adapter Model

The system should be built around `paper-family adapters`.

An adapter owns the deterministic rules for one format family, for example:

`aqa-gcse-combined-science-physics-paper-1-higher`

### Adapter Responsibilities

- identify question starts
- identify question ends
- identify sub-parts
- identify whether visual elements belong to a given question
- segment mark-scheme content
- align question units to mark-scheme units
- expose family-specific diagnostics

### Shared Core Responsibilities

- PMT scraping
- source download
- page rendering
- generic coordinate extraction
- crop generation helpers
- persistence
- import orchestration
- failure logging
- grading orchestration

### Internal Strategy Decomposition

Adapters should themselves be composed from smaller strategies, such as:

- question boundary strategy
- supporting visual attachment strategy
- mark-scheme segmentation strategy
- question-to-mark-scheme alignment strategy

This prevents each future adapter from becoming one giant fragile parser file.

## Marking Flow

### Request Payload

For each question attempt, the system sends only:

- exam board
- qualification family
- paper identity
- question identifier
- max marks
- exact extracted question text
- exact mark-scheme text
- attached visual context when the importer linked it to the question
- user answer

### Guardrails

- hard mark bounds: result must be between `0` and `maxMarks`
- structured JSON response only
- prompt instructs model not to rely on general subject knowledge when the mark scheme is specific
- one-question isolation to avoid context bleed
- invalid responses are retried or rejected
- prompt version is stored with each result
- raw model response is logged for debugging

### UI Behaviour

The user sees a final mark immediately after submission. Any internal confidence or diagnostic signals should remain secondary or hidden rather than dominating the visible result.

## UI Design

The UI should be utilitarian, clean, and approachable. It should feel like an exam practice tool, not a flashy productivity dashboard.

### Main Screens

#### Library

Shows imported papers, initially focused on June 2023 and June 2024 AQA Trilogy Physics Paper 1 Higher.

#### Paper Overview

Shows metadata and starts a question-by-question session.

#### Question Player

One question per page.

Layout:

- top progress indicator
- large central question card
- cropped original question image as primary content
- attached diagram/table/graph crops beneath the primary crop when the importer links them to the same question
- answer box below the question
- optional notes area
- single clear `Answer and continue` action

The preferred visual direction is a lighter version of the provided Save My Exams style reference:

- single-question focus
- strong vertical flow
- obvious primary action
- light theme instead of dark
- softer exam-tool styling rather than stylised dashboard chrome

#### Result State

After submit, the same screen can flip into a result state showing:

- awarded mark
- max marks
- concise examiner-style reasoning
- relevant mark-scheme points used
- action to continue

## Error Handling And Diagnostics

Import reliability is central, so failure states must be explicit and inspectable.

Examples:

- PMT page structure changed
- missing PDF link
- download failure
- unreadable or malformed PDF
- question boundary detection failure
- empty or invalid crop region
- mark-scheme segmentation failure
- question-to-mark-scheme alignment failure

When import fails, the system should preserve:

- source URLs
- downloaded files if available
- parser diagnostics
- failure stage
- structured failure reason

The app should expose a simple internal developer import screen showing:

- discovered paper candidates
- import status
- retry action
- failure reason
- adapter and pipeline stage diagnostics

## Operations And Storage

### Persistent Data

Store the following on a mounted data directory:

- source PDFs
- rendered page images
- question crops
- attached diagrams/graphs/tables
- import logs
- SQLite database

### Docker

The app should be designed to run cleanly in Docker from the start:

- app container
- mounted persistent data volume
- local `.env` file support
- straightforward future VPS deployment

## Testing Strategy

The riskiest area is import correctness, so testing should focus there first.

### Import Tests

- PMT link extraction tests
- AQA Paper 1 Higher question boundary tests
- crop bounding box tests
- mark-scheme segmentation tests
- question-to-mark-scheme alignment tests

### Benchmark Fixtures

Use June 2023 and June 2024 Higher Paper 1 as the initial benchmark set.

The tests should confirm that both papers can be imported fully and consistently enough to support production use in the app.

### Grading Tests

- structured response validation
- mark bound enforcement
- prompt contract validation
- storage of grading artifacts

## Initial Build Order

1. Scaffold the web app, database, data directories, and Docker setup.
2. Build PMT discovery for the targeted family.
3. Build deterministic import for June 2023 and June 2024 AQA Trilogy Physics Paper 1 Higher.
4. Persist imported papers and crops locally.
5. Build the question-by-question UI.
6. Integrate OpenRouter grading with strict structured output.
7. Add internal diagnostics for import failures and retries.

## Open Decisions Settled In This Spec

- Single-user-first: yes
- Auth in MVP: no
- AI on import: no
- On-demand fetch and cache: yes
- Manual import review workflow: no
- Local `.env` secrets workflow: yes
- SQLite with filesystem assets: yes
- Initial import benchmark: June 2023 and June 2024 AQA Trilogy Physics Paper 1 Higher

## Acceptance Criteria For MVP

The MVP is successful when:

- the app can discover and import June 2023 and June 2024 AQA Trilogy Physics Paper 1 Higher from PMT
- each imported question has a usable screenshot crop and linked mark-scheme content
- the question player presents one question per page in a light, clean UI
- the user can answer a question and receive an immediate structured mark
- the grading result is constrained by the exact mark scheme and known max marks
- all imported assets and attempts persist locally
- the codebase clearly supports future adapter-style extension to new boards or families
