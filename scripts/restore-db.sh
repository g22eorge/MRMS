#!/usr/bin/env bash
# restore-db.sh — Safe SQLite restore with automatic pre-restore snapshot.
#
# Usage: ./scripts/restore-db.sh <BACKUP_FILE> [DB_PATH]
#   BACKUP_FILE must be named mrms-YYYY-MM-DD_HH-MM-SS.db (same rule as lib/backups.ts)
#   DB_PATH defaults like backup-db.sh (DATABASE_URL file: or ./prisma/dev.db)
#
# Safety:
#   1. Refuses names that fail the strict pattern (path traversal impossible —
#      the name is validated before it is ever joined to a directory).
#   2. Verifies the backup is a real SQLite database (magic header).
#   3. Snapshots the CURRENT database to <DB>.pre-restore-<timestamp>.db first.
#   4. Refuses to run while dev/build servers may hold the file (override with
#      --force only when you have stopped the app; restoring under a live
#      writer risks corruption — this is why restore is a script, not a button).
#
# After restore: run `bunx prisma db push --skip-generate` only if the backup
# predates schema changes, then restart the app.

set -euo pipefail

FORCE=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--force" ]; then FORCE=1; else ARGS+=("$a"); fi
done

BACKUP_FILE="${ARGS[0]:-}"
DB_PATH="${ARGS[1]:-${DATABASE_URL#file:}}"
DB_PATH="${DB_PATH:-./prisma/dev.db}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <BACKUP_FILE> [DB_PATH] [--force]" >&2
  exit 1
fi

BASE="$(basename "$BACKUP_FILE")"
if ! [[ "$BASE" =~ ^mrms-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}\.db$ ]]; then
  echo "ERROR: refusing '$BASE' — not a mrms-YYYY-MM-DD_HH-MM-SS.db backup" >&2
  exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup not found at $BACKUP_FILE" >&2
  exit 1
fi

# SQLite magic header: "SQLite format 3\0"
if ! head -c 16 "$BACKUP_FILE" | grep -q "SQLite format 3"; then
  echo "ERROR: $BACKUP_FILE is not a SQLite database" >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: live database not found at $DB_PATH" >&2
  exit 1
fi

if [ "$FORCE" -ne 1 ]; then
  if lsof "$DB_PATH" >/dev/null 2>&1 || fuser "$DB_PATH" >/dev/null 2>&1; then
    echo "ERROR: $DB_PATH is open — stop the app first, then re-run with --force" >&2
    exit 1
  fi
  echo "WARN: could not check for open handles (lsof/fuser missing) — re-run with --force only when the app is stopped" >&2
  exit 1
fi

SNAPSHOT="${DB_PATH}.pre-restore-$(date +%Y-%m-%d_%H-%M-%S).db"
cp "$DB_PATH" "$SNAPSHOT"
echo "OK: pre-restore snapshot → $SNAPSHOT"

cp "$BACKUP_FILE" "$DB_PATH"
echo "OK: restored $DB_PATH from $BACKUP_FILE"
echo "NEXT: restart the app. If the backup predates schema changes, run: bunx prisma db push --skip-generate"
