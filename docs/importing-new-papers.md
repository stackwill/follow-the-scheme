# Adding New Papers

This is the end-to-end guide for future Codex sessions adding support for another paper.

The import pipeline is deterministic. Do not use AI to import, split, crop, or parse a paper. AI is only used later when a user submits an answer for marking.

## Current Shape

The importer takes a PMT paper page, finds the question paper PDF and mark scheme PDF, extracts PDF text items, detects question starts, pairs each question with mark scheme text, renders PDF pages as images, crops each question, then writes `Paper`, `Question`, and source metadata rows into SQLite.

Key files:

- `src/lib/import/pmt/discovery.ts`: Finds PMT links for supported paper families.
- `src/lib/import/adapters/base.ts`: Adapter contract and future-adapter notes.
- `src/lib/import/adapters/index.ts`: Registers adapters by `adapter.key`.
- `src/lib/import/adapters/*.ts`: Board/subject/paper-specific parsing and crop heuristics.
- `src/lib/import/core/import-paper.ts`: Downloads PDFs, calls adapters, renders/crops, persists imports.
- `src/lib/import/core/pdf-text.ts`: Extracts positioned PDF text items.
- `src/lib/import/core/pdf-render.ts`: Renders PDF pages for screenshots/crops.
- `src/lib/import/core/crop.ts`: Crops rendered page images.
- `src/lib/import/registry.ts`: Lists every supported paper family, expected years, total marks, discovery function, and adapter key.
- `scripts/sync-supported-papers.ts`: Local sync entrypoint for every supported paper wired into the registry.
- `scripts/create-data-release.ts`: Packages imported local paper data for production.
- `scripts/deploy-data-release.ts`: Uploads a packaged data release to the self-hosted server.
- `scripts/run-import-smoke.ts`: Full deterministic import verification.

## Step 1: Identify The Exact Paper

Confirm the exam board, qualification/spec, paper, tier/variant, session, and year before writing code.

Examples:

- AQA Combined Science Trilogy Physics Paper 1 Higher, spec `8464`, June 2024.
- AQA GCSE Computer Science Paper 1B Python, spec `8525`, June 2024.

For AQA GCSE Computer Science Paper 1, the variant matters:

- `8525/1A`: C#
- `8525/1B`: Python
- `8525/1C`: VB.NET
- `8525/2`: Computing concepts

Use official exam-board pages when the current spec is uncertain. Use PMT to discover downloadable PDFs.

## Step 2: Inspect PMT Page Structure

Open the PMT family page and inspect links. For pages with consistent link text, write a deterministic discovery function.

Example PMT Computer Science page:

`https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1`

Discovery functions should:

- Select the exact QP/MS pair required.
- Ignore old specs unless explicitly requested.
- Ignore neighbouring variants such as Paper `1A` or `1C` when targeting `1B`.
- Throw a clear contract error if the expected PMT link shape changes.
- Have a fixture test in `tests/pmt-discovery.test.ts`.

## Step 3: Download And Inspect PDFs

Use temporary files first. Do not guess PDF structure from the website.

```bash
mkdir -p /tmp/follow-paper
curl -L -o /tmp/follow-paper/question-paper.pdf '<encoded question paper URL>'
curl -L -o /tmp/follow-paper/mark-scheme.pdf '<encoded mark scheme URL>'
pdfinfo /tmp/follow-paper/question-paper.pdf | sed -n '1,24p'
pdfinfo /tmp/follow-paper/mark-scheme.pdf | sed -n '1,24p'
pdftotext -layout /tmp/follow-paper/question-paper.pdf - | sed -n '1,260p'
pdftotext -layout /tmp/follow-paper/mark-scheme.pdf - | sed -n '1,320p'
```

Then inspect positioned text items through the app extractor:

```bash
bun -e 'import { extractPdfTextItems } from "./src/lib/import/core/pdf-text";
const items = await extractPdfTextItems("/tmp/follow-paper/question-paper.pdf");
for (const item of items.filter((item) => item.pageNumber <= 4 && item.x < 140)) {
  console.log(item.pageNumber, item.y.toFixed(1), item.x.toFixed(1), JSON.stringify(item.text));
}'
```

Look for:

- How question labels are represented, for example `0 1 . 1`, `01 1`, `(a)`, or table rows.
- Whether main context labels such as `0 1` should become questions or only source context for `01.1`.
- Where mark scheme labels and mark totals appear.
- Whether diagrams, code grids, graph axes, circuits, tables, or answer options are raster/vector content that text extraction cannot see.

## Step 4: Write The Adapter

Before creating a new adapter, check whether the target paper uses a PDF layout already handled by an existing adapter. If the exam board, spec family, tier, question numbering, mark-scheme table format, and crop behavior match an existing adapter, reuse that adapter and add the new year through discovery, registry totals, smoke expectations, and visual crop checks.

For example, new AQA Combined Science Trilogy Biology Higher years should use the existing `createAqaCombinedSciencePaperAdapter(...)` registrations for Biology Paper 1H and Paper 2H. Do not fork the adapter just because the year is new. Only add adapter code when inspection shows a real layout or mark-scheme contract difference.

If a new adapter is genuinely needed, create a new file in `src/lib/import/adapters/`.

Adapter responsibilities, in order:

- Group positioned text items into lines.
- Detect question labels from the question paper.
- Detect mark scheme blocks from the mark scheme.
- Pair every imported question with exactly one mark scheme block.
- Build `extractedQuestionText` for marking.
- Build `primaryPdfBox` and `supportingPdfBoxes` for screenshots.
- Validate total marks.
- Fail fast on missing mark scheme blocks, unused mark scheme blocks, duplicate labels, or total-mark mismatch.

Use the same adapter shape for every new paper family unless there is a documented reason not to. The shape is:

1. **Normalize text items into lines.**
   - Sort by page, then top-to-bottom, then left-to-right.
   - Store `rawText`, `contentText`, item bounds, `pageNumber`, and line index.
   - Strip boilerplate before boundary decisions, not after crops are built.

2. **Detect all candidate labels before building drafts.**
   - Produce a full ordered label list with main labels and subquestion labels.
   - Do not immediately slice from one label to the next. Some papers put setup text for the next part before the visible next label.
   - Record whether a main label is context-only or answerable by checking whether the mark scheme has a matching block.

3. **Build explicit draft boundaries.**
   - For each answerable label, compute `textStartIndex`, `visualStartIndex`, and `endIndex`.
   - Source context before the first subquestion should belong to the first subquestion.
   - Pre-label setup on a new page should belong to the following subquestion, not the previous one. Example: repeated code/figures above `12.3`.
   - Same-page lines between two labels usually belong to the previous label unless they are clearly a heading/source block for the next part.
   - Never include the next part's stem or setup in the previous part's `extractedQuestionText`; this breaks selection detection and marking.

4. **Pair mark scheme blocks by normalized key.**
   - Normalize labels the same way for question paper and mark scheme, for example `03.3`, `12.6`, or `05`.
   - Compute marks from the matching block only.
   - Validate the sum of imported marks against the paper total and, where possible, against each `Total Question N` line.
   - Fail on unused mark scheme blocks. Do not hide them as warnings.

5. **Build crops from the same draft boundaries.**
   - Primary crop starts at `visualStartIndex`.
   - Supporting crops use the same `endIndex`, not the next raw label if pre-label setup was reassigned.
   - Crop heuristics must preserve raster/vector content that PDF text does not expose: answer grids, lozenges, option boxes, Punnett squares, graph axes, diagrams, circuit symbols, tables, code blocks, and repeated figures.
   - If a question says "answer grid below", "complete the board", "complete the Punnett square", or similar, the crop must include the answer area even if the user will type into the app instead.

Adapter rules:

- Keep board/subject-specific heuristics inside the adapter.
- Prefer extracting reusable helpers when two adapters share a real PDF layout. Do not copy-paste a whole adapter and then make unrelated local tweaks; shared boundary logic should live in a shared factory/helper.
- Prefer preserving too much official paper context over omitting required material.
- Never silently create placeholder mark scheme text unless `import-paper.ts` has a deliberate recovery path.
- Preserve source material for the first subquestion in a group, then crop later subquestions tightly to their own visual segment where possible.
- For raster/vector-heavy content, use explicit deterministic rules. Examples: answer grids, graph paper, circuit diagrams, lozenge options, tables, and code blocks.
- Do not use generic words such as "figure", "show", "complete", or "grid" alone as proof that a question is paper-only. That classification happens after import and must distinguish an instruction to draw on the paper from a normal coding/written prompt that merely mentions a figure or answer grid.

Register the adapter in `src/lib/import/adapters/index.ts`.

## Step 5: Wire The Import

For an existing paper family with a new year, update the year list in `src/lib/import/pmt/discovery.ts`, the year type and `totalMarks` record in `src/lib/import/registry.ts`, and the relevant expectations in `scripts/run-import-smoke.ts`. The existing benchmark definition and import function should stay in place.

For a genuinely new paper family, add a benchmark definition, import function, and production sync wiring for the new paper.

The definition must specify:

- `adapterKey`
- family page URL
- `specCode`
- paper title builder
- expected total marks by year
- discovery function
- source directory path
- `sourceProvider` and `subjectIndexUrl` when the source is not the default PMT past-papers index

If the paper introduces a new year for a typed family, update the year type too, for example `BiologyBenchmarkYear` or `OcrBusinessBenchmarkYear`.

Use adapter-specific source and crop directories so papers do not overwrite each other. Prefer `getPaperDirForAdapter(adapterKey, year)` for new imports.

Add the new definition to `supportedPaperDefinitions` in `src/lib/import/registry.ts`. This is required for `bun run import:sync` to import the paper locally.

Production code deploys do not download papers. After adding adapter code and importing locally, ship the imported data with a data release:

```bash
bun run import:sync
bun run import:smoke
bun run data:normalize-paths
bun run data:release
DEPLOY_HOST=176.20.179.79 DEPLOY_PORT=42143 APP_DIR=/opt/follow-the-scheme bun run data:deploy data/releases/<release>.tar.gz
```

For an already-supported adapter/year where no code changes are needed, a data release is enough. No Git push is needed just to move newly imported local data to production.

Expected data locations:

- Source PDFs: `data/sources/pmt/<adapter-key>/<year>/question-paper.pdf`
- Source mark schemes: `data/sources/pmt/<adapter-key>/<year>/mark-scheme.pdf`
- Crops: `data/crops/imports/<adapter-key>/<year>/<question-key>.png`

## Step 6: Import And Inspect Crops

Run the specific importer first:

```bash
bun -e 'import { importAqaGcseComputerSciencePaper1BPythonBenchmark } from "./src/lib/import/core/import-paper";
const result = await importAqaGcseComputerSciencePaper1BPythonBenchmark(2024);
console.log(JSON.stringify(result, null, 2));'
```

Check database shape:

```bash
sqlite3 data/app.db "select title, specCode, adapterKey, totalMarks from Paper where id='<paper-id>';"
sqlite3 data/app.db "select questionKey, maxMarks, pageStart, pageEnd, primaryCropPath, supportingAssetPaths from Question where paperId='<paper-id>' order by displayOrder;"
```

Check crop dimensions:

```bash
identify data/crops/imports/<adapter-key>/<year>/<question-key>.png
```

Open representative crops visually:

```bash
# Use Codex view_image on local crop paths, or open them from the file manager/browser.
```

Inspect at least:

- First multiple-choice question.
- First question with shared source material.
- Adjacent subquestions where setup appears before the next visible label.
- A written response question.
- A code/grid/table/graph/circuit question.
- A multi-page question with supporting crops.
- The final question.

Visual acceptance criteria:

- No relevant stem text omitted.
- No answer options omitted.
- No next-question stem or setup included in the previous question crop.
- No figures/tables/graphs/code grids clipped in a way that makes the question unanswerable.
- Answer grids and diagram-completion areas are visible when the official question relies on them.
- Right-side AQA “Do not write outside...” furniture is trimmed where practical.
- Supporting crops are only present when they contain useful continuation/source material.

## Step 7: Add Tests

Add discovery tests for every new PMT selector.

Add adapter tests when a heuristic is important enough to regress, especially:

- Adjacent subquestions that must not merge.
- Pre-label setup that belongs to the following part rather than the previous part.
- Raster/vector answer options that PDF text extraction cannot see.
- Answer grids or board/Punnett-square completion areas that PDF text extraction cannot see.
- Source figures that must be preserved.
- Main-question context that should be included with the first subquestion.
- Main-question labels that are answerable questions, not just context labels.
- Mark scheme labels that use a different table format.
- Selection-question extraction: the generated options must be only the actual choices, not stem/context lines from the next part.
- Paper-only classification: coding and written-answer questions that mention figures, grids, or boards must still get a normal answer box when they can be typed and AI-marked.

Update `scripts/run-import-smoke.ts` with the paper’s expected question count and total marks once the import shape is verified.

Smoke tests should check:

- Import succeeds.
- Re-import keeps the same paper ID.
- Re-import keeps question IDs stable.
- Question count and total marks match expectations.
- Every question has a primary crop path that exists.
- Mark scheme text is non-empty and not a placeholder.
- Known multi-page questions preserve supporting crops.

## Step 8: Verification Commands

Run targeted checks while iterating:

```bash
bun run test -- tests/pmt-discovery.test.ts
bunx tsc --noEmit
bun run lint
```

Run the deploy-style sync locally before pushing:

```bash
bun run import:sync
```

Run full import smoke before considering the adapter complete:

```bash
bun run import:smoke
```

When the import is complete, create and deploy a data release as documented in `docs/data-releases.md`. Do not rely on GitHub Actions to run the importer on the production server.

If `.next` becomes stale after builds/imports during development, restart dev cleanly:

```bash
pkill -f "next dev|next-server" || true
rm -rf .next
bun run dev --hostname 127.0.0.1 --port 3018
```

## Step 9: UI Check

Open the imported paper in the app and check:

- Library entry appears with the correct title/spec.
- Paper page starts the correct first question group.
- Question groups render in sensible order.
- Multiple-choice questions get selectable options when `detectSelectionQuestion` can infer them.
- Written/code questions get text areas.
- Questions that require drawing on the paper show a paper-only callout, but coding questions and normal written answers do not.
- Marking works with the existing OpenRouter settings.

The app URL shape is:

`/papers/<paper-id>`

Question practice pages are:

`/papers/<paper-id>/questions/<question-id>`

## Common Failure Modes

- Text extraction sees labels and words but not diagrams, graph lines, code grids, or lozenge circles. Fix crop boxes deterministically.
- A main question label is context, not an answerable question. Include it with the first subquestion but do not create a DB question unless the mark scheme has a matching block.
- A main question label can also be an answerable question. If the mark scheme has a matching whole-question block such as `02` or `05`, import it as its own question.
- Setup text for a later subquestion can appear before that subquestion's visible label, especially when figures or code are repeated at the top of a page. Assign that setup to the following part.
- Context from the next part can create fake multiple-choice options. If selection options include normal prose sentences, the previous part probably swallowed the next part's stem.
- Generic paper-only regexes can falsely classify coding prompts. Phrases such as "Figure 18 and Figure 19 show example boards" or "answer grid below" are not drawing instructions by themselves.
- Coding answer grids are visual scaffolding, not a reason to disable AI marking. The crop should show them, but the app should still allow typed Python/C#/VB answers when the question asks for code.
- A mark scheme uses a shared table across variants. Target the correct variant in QP discovery, but pair with the shared MS if that is how PMT/AQA publish it.
- A footer-only page creates a useless continuation crop. Filter boilerplate and empty content before creating supporting boxes.
- Re-import wants to delete stale questions with attempts. The importer correctly refuses this; decide whether to preserve attempts, migrate IDs, or clear local dev attempts before changing question keys.

## Commit Checklist

Before committing:

- Adapter registered.
- Import function available.
- Paper imported locally.
- Representative crops visually inspected.
- Discovery tests pass.
- TypeScript and lint pass.
- Smoke import passes or the reason it was not run is recorded.
- Documentation updated if the new paper exposed a new adapter pattern.
