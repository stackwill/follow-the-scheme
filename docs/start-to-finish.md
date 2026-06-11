# Start To Finish: Adding New Papers

This is the required flow when Will asks to add new papers.

## Goal

Import new papers into the local data set, review the crops manually, fix any bad crops, then create and deploy a data release only after Will approves the review site.

Do not push a new data release to the production server until the manual crop review step has been generated, hosted, reviewed by Will, and approved.

## 1. Discover Or Confirm The Papers

Use the existing import discovery and registry flow.

- Check the paper source, subject, exam board, paper number, tier, session, and year.
- Confirm that the adapter exists or add/update an adapter if the paper format is new.
- Keep adapter logic deterministic. Do not use AI in the import path.
- Prefer the existing registry, PMT discovery code, and adapter patterns.

Useful files:

- `src/lib/import/registry.ts`
- `src/lib/import/pmt/discovery.ts`
- `src/lib/import/adapters/`
- `src/lib/import/core/import-paper.ts`

## 2. Sync And Import Locally

Run the local import flow. By default this is incremental: it discovers supported papers,
skips papers that are already current, and imports only missing or stale papers.

```bash
bun run import:sync
```

For a new-paper batch, prefer a narrow sync so unrelated papers are not rechecked:

```bash
bun run import:sync -- --paper aqa-gcse-chemistry-paper-2-higher:2022 --paper aqa-gcse-chemistry-paper-2-higher:2023
```

Useful filters:

```bash
bun run import:sync -- --adapter aqa-gcse-chemistry-paper-2-higher
bun run import:sync -- --year 2023
```

Use `--force` only when adapter logic changed and existing crops/data must be rebuilt:

```bash
bun run import:sync -- --adapter aqa-gcse-chemistry-paper-2-higher --force
```

For broader checks, use the smoke script where appropriate.

```bash
bun run import:smoke
```

The import should download question papers and mark schemes into `data/sources/`, render paper pages into `data/renders/`, crop question images into `data/crops/`, and upsert the imported `Paper` and `Question` rows in SQLite.

## 3. Generate The Manual Crop Review Site

Before creating or deploying a data release, generate the manual crop review site for only the papers Will needs to review.

Examples:

```bash
bun run crop:manual-review -- --subject Chemistry --out data/manual-crop-review/chemistry
```

```bash
bun run crop:manual-review -- --adapter aqa-combined-science-chemistry-paper-1-higher --year 2024 --out data/manual-crop-review/chemistry-paper-1-2024
```

The review site is local-only and separate from the main Next app. It shows:

- left: imported website crops placed at roughly their original page positions
- right: continuous rendered original exam paper pages
- sticky top bar: per-paper `Mark paper checked` button and review status

## 4. Host The Review Site

Host the generated review folder with a simple static server.

Example:

```bash
python -m http.server 4177 --directory data/manual-crop-review/chemistry
```

Give Will the local URL:

```text
http://localhost:4177/
```

If port `4177` is already in use, use another available port and give Will that URL.

## 5. Wait For Manual Approval

Will reviews the hosted site manually.

Each paper page has a `Mark paper checked` button in the sticky top bar. Pressing it records that paper as checked in browser localStorage. The index hides checked papers by default, so the visible list is the remaining staging queue.

This is a human workflow checkpoint, not a production deploy trigger. After all staged papers are checked, wait for Will to tell Codex to continue before creating or pushing a data release. Once Will says the checked papers have passed staging and asks to continue, treat them as ready for release; the review site should no longer show them as pending.

If Will reports bad crops:

- inspect the named paper/question/page
- fix the adapter crop boundary logic or imported data path that caused the issue
- rerun import for the affected papers
- regenerate and re-host the review site
- ask Will to review again

## 6. Normalize, Release, And Deploy

Only after Will approves the hosted review site and asks to continue:

```bash
bun run data:normalize-paths
bun run data:release
```

Then deploy the generated release tarball to the production server.

Default production target:

```bash
DEPLOY_HOST=<host-from-local-AGENTS.md> DEPLOY_PORT=42143 APP_DIR=/opt/follow-the-scheme bun run data:deploy data/releases/<release>.tar.gz
```

Use the newest release artifact from `data/releases/`.

## 7. Final Checks

Before calling the task done, summarize:

- which papers were imported
- review site URL used
- whether Will approved the review
- any crop fixes made
- release artifact deployed, if deployment was requested
- any commands that failed or were skipped

Do not claim the production data was updated unless the deploy command completed successfully.
