# Data Releases

Use this when adding past papers that the app already knows how to import.

The production host is intentionally kept out of Git. Use the current host from local `AGENTS.md`.

```bash
ssh -p 42143 will@<host-from-AGENTS.md>
```

## Local Release

```bash
bun run import:sync
bun run import:smoke
bun run data:normalize-paths
bun run data:release
```

`data:release` packages a copy of `data/app.db` and `data/crops/`. It strips local `Attempt` and `QuestionAttempt` rows from the copied database before packaging so local practice data is not shipped as imported paper content.

## Deploy Data

```bash
DEPLOY_HOST=<host-from-AGENTS.md> DEPLOY_PORT=42143 APP_DIR=/opt/follow-the-scheme bun run data:deploy data/releases/<release>.tar.gz
```

The deploy script uploads with `rsync`, verifies the checksum on the server, backs up the current `data/` directory, activates the new release, restores production attempts by stable paper/question identity, runs Prisma migrations, and restarts Docker Compose.

## Rollback

SSH to the server:

```bash
ssh -p 42143 will@<host-from-AGENTS.md>
cd /opt/follow-the-scheme
docker compose down
rm -rf data.failed
mv data data.failed
mv data.previous data
docker compose up -d
```

## Included

- `app.db`
- `crops/`
- `manifest.json`

## Excluded

- source PDFs under `data/sources/`
- rendered page intermediates under `data/renders/`
- import logs unless explicitly added later
