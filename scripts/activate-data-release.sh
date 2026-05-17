#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/follow-the-scheme}"
RELEASE_TARBALL="${1:?Usage: activate-data-release.sh <release-tarball>}"
RELEASE_SHA="${RELEASE_TARBALL}.sha256"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGING_DIR="$APP_DIR/data-staging-$TIMESTAMP"
BACKUP_DIR="$APP_DIR/data-backups/data-$TIMESTAMP"
ATTEMPTS_BACKUP="$APP_DIR/data/attempts-backup-$TIMESTAMP.json"

cd "$APP_DIR"

if [ -f "$APP_DIR/.deploy.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$APP_DIR/.deploy.env"
  set +a
fi

if [ ! -f "$RELEASE_TARBALL" ]; then
  echo "Missing release tarball: $RELEASE_TARBALL" >&2
  exit 1
fi

if [ ! -f "$RELEASE_SHA" ]; then
  echo "Missing release checksum: $RELEASE_SHA" >&2
  exit 1
fi

(cd "$(dirname "$RELEASE_TARBALL")" && sha256sum -c "$(basename "$RELEASE_SHA")")

rm -rf "$STAGING_DIR"
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
  docker compose run --rm app bun run scripts/export-attempts.ts "/app/data/$(basename "$ATTEMPTS_BACKUP")"
  if [ -f "$ATTEMPTS_BACKUP" ]; then
    cp "$ATTEMPTS_BACKUP" "$STAGING_DIR/$(basename "$ATTEMPTS_BACKUP")"
  fi
fi

rm -rf "$APP_DIR/data.previous"
if [ -d "$APP_DIR/data" ]; then
  mv "$APP_DIR/data" "$APP_DIR/data.previous"
fi
mv "$STAGING_DIR" "$APP_DIR/data"

if ! docker compose run --rm app bunx prisma@6.19.3 migrate deploy; then
  docker compose run --rm app bunx prisma@6.19.3 migrate resolve --applied 0001_init
  docker compose run --rm app bunx prisma@6.19.3 migrate deploy
fi

if [ -f "$APP_DIR/data/$(basename "$ATTEMPTS_BACKUP")" ]; then
  docker compose run --rm app bun run scripts/import-attempts.ts "/app/data/$(basename "$ATTEMPTS_BACKUP")"
fi

docker compose up -d --force-recreate --remove-orphans

echo "Activated data release from $RELEASE_TARBALL"
echo "Backup: $BACKUP_DIR"
