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

Create a new file in `src/lib/import/adapters/`.

Adapter responsibilities:

- Group positioned text items into lines.
- Detect question labels from the question paper.
- Detect mark scheme blocks from the mark scheme.
- Pair every imported question with exactly one mark scheme block.
- Build `extractedQuestionText` for marking.
- Build `primaryPdfBox` and `supportingPdfBoxes` for screenshots.
- Validate total marks.
- Fail fast on missing mark scheme blocks, unused mark scheme blocks, duplicate labels, or total-mark mismatch.

Adapter rules:

- Keep board/subject-specific heuristics inside the adapter.
- Prefer preserving too much official paper context over omitting required material.
- Never silently create placeholder mark scheme text unless `import-paper.ts` has a deliberate recovery path.
- Preserve source material for the first subquestion in a group, then crop later subquestions tightly to their own visual segment where possible.
- For raster/vector-heavy content, use explicit deterministic rules. Examples: answer grids, graph paper, circuit diagrams, lozenge options, tables, and code blocks.

Register the adapter in `src/lib/import/adapters/index.ts`.

## Step 5: Wire The Import

In `src/lib/import/core/import-paper.ts`, add a benchmark definition or import function for the new paper.

The definition must specify:

- `adapterKey`
- PMT family page URL
- `specCode`
- paper title builder
- expected total marks by year
- discovery function
- source directory path

Use adapter-specific source and crop directories so papers do not overwrite each other.

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
- A written response question.
- A code/grid/table/graph/circuit question.
- A multi-page question with supporting crops.
- The final question.

Visual acceptance criteria:

- No relevant stem text omitted.
- No answer options omitted.
- No figures/tables/graphs/code grids clipped in a way that makes the question unanswerable.
- Right-side AQA “Do not write outside...” furniture is trimmed where practical.
- Supporting crops are only present when they contain useful continuation/source material.

## Step 7: Add Tests

Add discovery tests for every new PMT selector.

Add adapter tests when a heuristic is important enough to regress, especially:

- Adjacent subquestions that must not merge.
- Raster/vector answer options that PDF text extraction cannot see.
- Source figures that must be preserved.
- Main-question context that should be included with the first subquestion.
- Mark scheme labels that use a different table format.

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

Run full import smoke before considering the adapter complete:

```bash
bun run import:smoke
```

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
- Marking works with the existing OpenRouter settings.

The app URL shape is:

`/papers/<paper-id>`

Question practice pages are:

`/papers/<paper-id>/questions/<question-id>`

## Common Failure Modes

- Text extraction sees labels and words but not diagrams, graph lines, code grids, or lozenge circles. Fix crop boxes deterministically.
- A main question label is context, not an answerable question. Include it with the first subquestion but do not create a DB question unless the mark scheme has a matching block.
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
