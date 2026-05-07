## FollowTheScheme

Small-group exam practice tool for deterministic PMT imports and optional AI-assisted marking.

### Local MVP flow

1. `cp .env.example .env`
2. `bun install`
3. `bun run db:generate`
4. `bun run db:migrate --name init`
5. `bun run fixtures:fetch`
6. `bun run import:smoke`
7. `bun run dev`

Set `AUTH_PASSWORD` and `AUTH_SESSION_SECRET` in `.env`, then open `http://localhost:3000` for the imported paper library. Use `http://localhost:3000/dev/imports` to re-run the supported benchmark imports and inspect source status, last failure diagnostics, and question-level importer warnings.

Deterministic selection questions can be marked without any external API keys. Free-text AI marking is disabled unless OpenRouter environment variables are deliberately added.

### Supported fixture import

The MVP intentionally imports a narrow reviewed fixture set:

- AQA Combined Science Trilogy Physics Paper 1 Higher, June 2023
- AQA Combined Science Trilogy Physics Paper 1 Higher, June 2024

`bun run fixtures:fetch` downloads the benchmark question papers and mark schemes into `data/sources`. `bun run import:smoke` renders, crops, validates, and stores both benchmark papers in the local SQLite database.

### Local Docker run flow

1. `cp .env.example .env`
2. Set `AUTH_PASSWORD` and `AUTH_SESSION_SECRET` in `.env`
3. `bun run release:check`
4. `docker build -t followthescheme:local .`
5. `IMAGE_REPOSITORY=followthescheme IMAGE_TAG=local docker compose run --rm app bunx prisma migrate deploy`
6. `IMAGE_REPOSITORY=followthescheme IMAGE_TAG=local docker compose run --rm app bun run fixtures:fetch`
7. `IMAGE_REPOSITORY=followthescheme IMAGE_TAG=local docker compose run --rm app bun run import:smoke`
8. `IMAGE_REPOSITORY=followthescheme IMAGE_TAG=local docker compose up`

The Docker build uses `.dockerignore` so local secrets and generated `data/` assets stay out of the image. Runtime configuration is loaded from `.env` through `docker-compose.yml`.

### Browser-local progress

Question attempts, awarded marks, and feedback are stored in each browser's `localStorage`.
The server still performs grading so OpenRouter credentials never reach the browser, but progress is intentionally not shared between devices or users.
Clearing browser site data clears that browser's marks.

### GitHub Actions deployment

The workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) follows the same pattern as `babys-second-ci-cd`:

1. Builds the Docker image.
2. Pushes `latest` and `sha-<commit>` tags to GHCR.
3. SSHes to `will@192.168.1.51` by default.
4. Copies `docker-compose.yml` to `/opt/follow-the-scheme` by default.
5. Requires and preserves the server's existing `.env`.
6. Writes `.deploy.env` with the image tag, bind address, port, and container name.
7. Runs Prisma migrations.
8. Imports fixtures once if `data/app.db` does not exist.
9. Starts the container with `restart: unless-stopped`.

The app binds to `127.0.0.1:33200` by default, which is intended for Cloudflared on the same server. Override `APP_BIND` only if another reverse proxy needs LAN access.

#### GitHub Actions secrets

Set these in `Settings -> Secrets and variables -> Actions -> Secrets`:

- `DEPLOY_SSH_KEY`: private SSH key that can log in as `will` on the server.
- `GHCR_PULL_USERNAME`: optional if the GHCR image is public.
- `GHCR_PULL_TOKEN`: optional if the GHCR image is public; otherwise use a token with `read:packages`.

#### GitHub Actions variables

These have safe defaults in the workflow, so only set them if you want to override:

- `DEPLOY_HOST`: defaults to `192.168.1.51`.
- `DEPLOY_USER`: defaults to `will`.
- `DEPLOY_PORT`: defaults to `22`.
- `DEPLOY_PATH`: defaults to `/opt/follow-the-scheme`.
- `APP_BIND`: defaults to `127.0.0.1`.
- `APP_PORT`: defaults to `33200`.
- `CONTAINER_NAME`: defaults to `follow-the-scheme`.

#### First server setup

Create the deploy directory and copy your current env once:

```bash
ssh will@192.168.1.51 'sudo mkdir -p /opt/follow-the-scheme && sudo chown -R will:will /opt/follow-the-scheme'
scp .env will@192.168.1.51:/opt/follow-the-scheme/.env
ssh will@192.168.1.51 'chmod 600 /opt/follow-the-scheme/.env'
```

The deploy workflow never writes app secrets. It fails if `/opt/follow-the-scheme/.env` is missing.

### Public release notes

- The whole app is protected by a single password page.
- The session cookie is HTTP-only, signed with `AUTH_SESSION_SECRET`, and marked secure in production.
- OpenRouter keys are only read server-side. Do not set `OPENROUTER_API_KEY` on the public server unless you intentionally want public users behind the password to spend that key.
- Run `bun run release:check` before publishing a server build.
