## FollowTheScheme

Single-user-first exam practice tool for deterministic PMT imports and AI-assisted marking.

### Local MVP flow

1. `cp .env.example .env`
2. `bun install`
3. `bun run db:generate`
4. `bun run db:migrate --name init`
5. `bun run fixtures:fetch`
6. `bun run import:smoke`
7. `bun run dev`

Open `http://localhost:3000` for the imported paper library. Use `http://localhost:3000/dev/imports` to re-run the supported benchmark imports and inspect source status, last failure diagnostics, and question-level importer warnings.

Free-text AI marking requires a real `OPENROUTER_API_KEY` in `.env`. Deterministic selection questions can be marked without OpenRouter.

### Supported fixture import

The MVP intentionally imports a narrow reviewed fixture set:

- AQA Combined Science Trilogy Physics Paper 1 Higher, June 2023
- AQA Combined Science Trilogy Physics Paper 1 Higher, June 2024

`bun run fixtures:fetch` downloads the benchmark question papers and mark schemes into `data/sources`. `bun run import:smoke` renders, crops, validates, and stores both benchmark papers in the local SQLite database.

### Docker run flow

1. `cp .env.example .env`
2. `docker compose build`
3. `docker compose run --rm app bun run db:migrate --name init`
4. `docker compose run --rm app bun run fixtures:fetch`
5. `docker compose run --rm app bun run import:smoke`
6. `docker compose up`

The Docker build uses `.dockerignore` so local secrets and generated `data/` assets stay out of the image. Runtime configuration is loaded from `.env` through `docker-compose.yml`.
