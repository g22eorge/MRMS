#!/usr/bin/env bash
# restore-db.sh — restore a pg_dump backup over the live database, safely.
#
# Usage, from the repository root:
#   ./scripts/restore-db.sh <file.dump> --force
#
#   Production:  docker compose cp backup:/backups/<name> .   then restore that file
#   Development: COMPOSE_FILE=docker-compose.dev.yml ./scripts/restore-db.sh backups/<name> --force
#
# The file is a host path. It can be one copied out of the backups volume, one
# downloaded from Settings → Backups, or one `bun run pg:export` wrote — the
# script streams it into pg_restore in the postgres container, so it does not
# need to be anywhere the containers can see.
#
# Safety, in the order it happens:
#   1. The name must match the pattern lib/backups.ts allows. Change both
#      together; the pattern is what makes path traversal impossible.
#   2. The file must be a pg_dump custom-format archive (magic bytes PGDMP).
#   3. --force is required. This drops the live database.
#   4. The current database is dumped to backups/mrms-prerestore-<utc>.dump
#      before anything is touched, and the run stops if that dump fails.
#   5. app, worker and scheduler are stopped, so nothing writes mid-restore.
#   6. Drop, create, restore, then `compose up -d` — which reruns migrations, so
#      a dump older than the current schema is brought forward rather than left
#      behind it. (The SQLite version of this script said to run `prisma db
#      push`; that is exactly what must never be run against a database that
#      matters.)

set -euo pipefail

FORCE=0
FILE=""
for a in "$@"; do
  if [ "$a" = "--force" ]; then FORCE=1; else FILE="$a"; fi
done

if [ -z "$FILE" ]; then
  echo "Usage: $0 <file.dump> --force" >&2
  exit 1
fi

BASE="$(basename "$FILE")"
if ! [[ "$BASE" =~ ^mrms-([0-9]{8}T[0-9]{6}Z|dev-[0-9]{8}-[0-9]{6}|prerestore-[0-9]{8}T[0-9]{6}Z)\.dump$ ]]; then
  echo "ERROR: refusing '$BASE' — not a backup name this project produces" >&2
  echo "       (mrms-<utc>.dump, mrms-dev-<stamp>.dump or mrms-prerestore-<utc>.dump)" >&2
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE does not exist" >&2
  exit 1
fi
if [ "$(head -c 5 "$FILE")" != "PGDMP" ]; then
  echo "ERROR: $FILE is not a pg_dump custom-format archive" >&2
  exit 1
fi
if [ "$FORCE" -ne 1 ]; then
  echo "This drops and recreates the live database from $BASE." >&2
  echo "Re-run with --force to proceed." >&2
  exit 1
fi

# Inside the container, the image's own POSTGRES_USER / POSTGRES_DB say which
# database this is — the same in development and production, no .env parsing.
pg() { docker compose exec -T postgres sh -c "$1"; }

if ! pg 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'; then
  echo "ERROR: the postgres service is not running in this compose project" >&2
  exit 1
fi

mkdir -p backups
SNAPSHOT="backups/mrms-prerestore-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$SNAPSHOT"
if [ "$(head -c 5 "$SNAPSHOT")" != "PGDMP" ]; then
  rm -f "$SNAPSHOT"
  echo "ERROR: the pre-restore dump failed — nothing has been touched" >&2
  exit 1
fi
echo "OK: pre-restore dump → $SNAPSHOT ($(du -h "$SNAPSHOT" | cut -f1))"

docker compose stop app worker scheduler >/dev/null 2>&1 || true
echo "OK: app, worker and scheduler stopped"

pg 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
pg 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' < "$FILE"
echo "OK: restored from $BASE"

# --no-build: a restore restores. Without it, `up -d` rebuilds any image it
# cannot find or considers stale, which turned a two-minute restore into a
# twelve-minute one in testing — with the database already replaced and the
# app down for all of it. If an image is genuinely missing, this fails loudly
# and the database is still restored; build separately and start it.
if ! docker compose up -d --no-build >/dev/null; then
  # The database is already restored at this point. Saying only "error" here
  # invites a second restore, which would take a pre-restore dump of the
  # backup just restored and replace the real one in the operator's head.
  echo "WARN: database restored from $BASE, but the services did not start." >&2
  echo "      Fix the images, then: docker compose up -d" >&2
  echo "      To undo the restore instead: ./scripts/restore-db.sh $SNAPSHOT --force" >&2
  exit 2
fi
echo "OK: services started; migrations run on the way up"
echo "If anything is wrong: ./scripts/restore-db.sh $SNAPSHOT --force"
