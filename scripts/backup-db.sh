#!/usr/bin/env bash
# backup-db.sh — take a Postgres backup now, rather than waiting for the next
# scheduled one.
#
# Usage, from the repository root on the server:
#   ./scripts/backup-db.sh
#
# The `backup` service (scripts/pg-backup.sh) already dumps on a schedule; this
# asks that same container for one more, so the file lands in the same volume,
# under the same naming, and shows up on Settings → Backups like any other.
#
# It replaces a SQLite version that copied the database file with `sqlite3
# .backup` from a host crontab. There is no file to copy any more and no host
# crontab needed — the service is the schedule.
#
# Development has no backup service. Use `bun run pg:export` there, which writes
# backups/mrms-dev-*.dump — the same page lists those too.

set -euo pipefail

if ! docker compose ps --status running --services 2>/dev/null | grep -qx backup; then
  echo "ERROR: the 'backup' service is not running in this compose project." >&2
  echo "       On a server: docker compose up -d backup" >&2
  echo "       In development there is no backup service — use: bun run pg:export" >&2
  exit 1
fi

# Same naming and write-then-rename as pg-backup.sh, so an interrupted dump can
# never be mistaken for a usable one. Runs inside the container, where PG* are
# already set and /backups is the volume.
docker compose exec -T backup sh -euc '
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="/backups/mrms-${stamp}.dump"
  pg_dump -Fc -f "${target}.partial"
  mv "${target}.partial" "$target"
  echo "OK: $(basename "$target") ($(du -h "$target" | cut -f1))"
'
