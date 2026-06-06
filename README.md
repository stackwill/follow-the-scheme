# FollowTheScheme

Personal GCSE exam practice app for working through past-paper questions and getting mark-scheme-based feedback.

It is built for small-group use, not as a public learning platform. The app lets a student choose a subject, open an imported paper, answer questions in manageable groups, and receive marking feedback without exposing model credentials to the browser.

Production site: `ihategcse.com`

## Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [How Papers Get Into The App](#how-papers-get-into-the-app)
- [Grading](#grading)
- [Data And Assets](#data-and-assets)
- [Deployment](#deployment)

## What It Does

- Shows supported GCSE past papers by subject and paper.
- Presents each question with the relevant paper image, source material, marks, and extracted text.
- Accepts typed answers and returns marks, reasoning, and feedback.
- Handles simple multiple-choice style questions deterministically where possible.
- Stores progress in the browser so the app stays lightweight and does not need user accounts.
- Keeps AI grading server-side so OpenRouter credentials are never sent to clients.

Question attempts, awarded marks, and feedback are stored in each browser's `localStorage`.
Progress is intentionally local to that browser: it is not shared between devices, and clearing browser site data clears the marks.

## Tech Stack

- Next.js 15 and React 19
- TypeScript
- Bun
- Prisma with SQLite
- OpenRouter for structured grading
- Docker and GitHub Actions for deployment

## Local Development

Install dependencies:

```bash
bun install
```

Create a local environment file:

```bash
cp .env.example .env
```

Then set at least:

```env
DATABASE_URL="file:../data/app.db"
APP_DATA_DIR="./data"
AUTH_PASSWORD="replace-with-a-long-password"
AUTH_SESSION_SECRET="replace-with-a-random-32-character-minimum-secret"
AUTH_COOKIE_SECURE="false"
```

Generate the Prisma client and run migrations:

```bash
bun run db:generate
bun run db:migrate
```

Start the app:

```bash
bun run dev
```

The development server runs on the default Next.js port unless another port is already in use.

## Useful Commands

```bash
bun run lint
bun run test
bun run build
```

Import and data-release commands:

```bash
bun run import:sync
bun run import:smoke
bun run crop:preview
bun run crop:manual-review
bun run data:normalize-paths
bun run data:release
bun run data:deploy
```

## How Papers Get Into The App

The app is not manually entering questions into a CMS. Papers are imported from supported past-paper sources into a local data set.

At a high level, the import flow:

1. Finds known supported papers.
2. Downloads the question paper and mark scheme.
3. Extracts the question and mark-scheme text.
4. Creates image assets for the questions.
5. Saves paper and question records into SQLite.
6. Generates review pages so the imported question images can be checked before release.

The import path is deliberately deterministic. AI is used for marking answers after import, not for deciding what a paper contains.

The important entry points are:

- `src/lib/import/registry.ts`
- `src/lib/import/pmt/discovery.ts`
- `src/lib/import/core/import-paper.ts`
- `src/lib/import/adapters/`
- `tools/manual-crop-review/`
- `docs/start-to-finish.md`

When adding new papers, follow [docs/start-to-finish.md](./docs/start-to-finish.md). The review site must be generated and approved before a production data release is created or deployed.

## Grading

The grading path lives in `src/lib/grading/`.

For normal written answers, the server builds a prompt from the paper title, exam board, question text, mark scheme, and submitted answer, then asks OpenRouter for a structured result.

For some selection questions, the app detects the options and correct answer from the imported text and marks the answer without calling a model.

The response is validated before it is returned to the UI.

Portfolio visitors can enter through `/demo/portfolio`. That route creates a separate demo session, while the existing school-name login remains unchanged. Written-answer marking from demo-only sessions uses `OPENROUTER_DEMO_API_KEY`; set a provider-side hard spending limit on that separate key.

## Data And Assets

Runtime data is kept under `APP_DATA_DIR`, normally `./data` in development.

The data directory can contain:

- source PDFs
- rendered paper pages
- question image assets
- import logs and diagnostics
- manual crop review output
- data release archives
- the SQLite database

Most of that data is generated locally and is not part of the source tree.

## Deployment

The GitHub Actions workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml):

1. Builds the Docker image.
2. Pushes `latest` and `sha-<commit>` tags to GHCR.
3. SSHes to the production server.
4. Copies `docker-compose.yml` to the app directory.
5. Requires and preserves the server's existing `.env`.
6. Writes `.deploy.env` with the image tag, bind address, port, and container name.
7. Runs Prisma migrations.
8. Starts the container with `restart: unless-stopped`.

The deploy workflow updates the application code. Paper data is managed separately through local data releases.

## GitHub Actions Configuration

Required secrets:

- `DEPLOY_HOST`: public IP address or DNS hostname for SSH.
- `DEPLOY_SSH_KEY`: private SSH key that can log in as the deploy user.
- `GHCR_PULL_USERNAME`: optional if the GHCR image is public.
- `GHCR_PULL_TOKEN`: optional if the GHCR image is public; otherwise use a token with `read:packages`.

Optional variables:

- `DEPLOY_USER`: defaults to `will`.
- `DEPLOY_PORT`: defaults to `22`.
- `DEPLOY_PATH`: defaults to `/opt/follow-the-scheme`.
- `APP_BIND`: defaults to `0.0.0.0`.
- `APP_PORT`: defaults to `33200`.
- `CONTAINER_NAME`: defaults to `follow-the-scheme`.

The app binds to `0.0.0.0:33200` by default so a separate tunnel or reverse proxy can reach it.
Set `APP_BIND=127.0.0.1` only when the proxy runs on the same server and LAN access is not needed.

## First Server Setup

Create the deploy directory and copy the server environment once:

```bash
ssh will@176.20.179.79 -p 42143 'sudo mkdir -p /opt/follow-the-scheme && sudo chown -R will:will /opt/follow-the-scheme'
scp -P 42143 .env will@176.20.179.79:/opt/follow-the-scheme/.env
ssh will@176.20.179.79 -p 42143 'chmod 600 /opt/follow-the-scheme/.env'
```

The deploy workflow never writes app secrets. It fails if `/opt/follow-the-scheme/.env` is missing.

## Auth Cookies

Set this in the server `.env` when auth needs to work over LAN HTTP as well as HTTPS:

```bash
AUTH_COOKIE_SECURE=false
```

Leave it unset or set it to `true` when the app is only accessed through HTTPS.
