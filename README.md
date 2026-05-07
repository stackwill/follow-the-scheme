personal use only

## FollowTheScheme

Small-group exam practice tool for deterministic PMT imports and optional AI-assisted marking.

### Browser-local progress

Question attempts, awarded marks, and feedback are stored in each browser's `localStorage`.
The server still performs grading so OpenRouter credentials never reach the browser, but progress is intentionally not shared between devices or users.
Clearing browser site data clears that browser's marks.

### GitHub Actions deployment

The workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml):

1. Builds the Docker image.
2. Pushes `latest` and `sha-<commit>` tags to GHCR.
3. SSHes to the server using `DEPLOY_HOST`, `DEPLOY_PORT`, and `DEPLOY_USER`.
4. Copies `docker-compose.yml` to `/opt/follow-the-scheme` by default.
5. Requires and preserves the server's existing `.env`.
6. Writes `.deploy.env` with the image tag, bind address, port, and container name.
7. Runs Prisma migrations.
8. Runs fixture imports when the database has fewer than the expected seven papers.
9. Starts the container with `restart: unless-stopped`.

The app binds to `0.0.0.0:33200` by default so a separate Cloudflared LXC can reach it at `http://192.168.1.51:33200`.
Set `APP_BIND=127.0.0.1` only when Cloudflared runs on the same server and LAN access is not needed.

### GitHub Actions Secrets

- `DEPLOY_HOST`: public IP address or DNS hostname for SSH.
- `DEPLOY_SSH_KEY`: private SSH key that can log in as the deploy user.
- `GHCR_PULL_USERNAME`: optional if the GHCR image is public.
- `GHCR_PULL_TOKEN`: optional if the GHCR image is public; otherwise use a token with `read:packages`.

### GitHub Actions Variables

- `DEPLOY_USER`: defaults to `will`.
- `DEPLOY_PORT`: defaults to `22`.
- `DEPLOY_PATH`: defaults to `/opt/follow-the-scheme`.
- `APP_BIND`: defaults to `0.0.0.0`.
- `APP_PORT`: defaults to `33200`.
- `CONTAINER_NAME`: defaults to `follow-the-scheme`.

### First Server Setup

Create the deploy directory and copy your current env once:

```bash
ssh will@192.168.1.51 'sudo mkdir -p /opt/follow-the-scheme && sudo chown -R will:will /opt/follow-the-scheme'
scp .env will@192.168.1.51:/opt/follow-the-scheme/.env
ssh will@192.168.1.51 'chmod 600 /opt/follow-the-scheme/.env'
```

The deploy workflow never writes app secrets. It fails if `/opt/follow-the-scheme/.env` is missing.

### Auth Cookies

Set this in the server `.env` when you need auth to work over LAN HTTP as well as Cloudflare:

```bash
AUTH_COOKIE_SECURE=false
```

Leave it unset or set it to `true` if the app is only accessed through HTTPS.
