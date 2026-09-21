#!/bin/sh
# Periodic pg_dump into a mounted volume.
#
# SQLite's backup story was "copy one file". Postgres has no such thing, and the
# database now lives in a container volume, so backups have to be deliberate —
# this is the piece that replaces that convenience.
#
# Environment:
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE   connection (standard libpq vars)
#   BACKUP_DIR         where dumps land (default /backups)
#   BACKUP_INTERVAL    seconds between dumps (default 86400)
#   BACKUP_KEEP_DAYS   delete dumps older than this (default 14)
#
# Custom format (-Fc): compressed, and restorable selectively with pg_restore.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL="${BACKUP_INTERVAL:-86400}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

log() { echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

log "target ${PGUSER:-?}@${PGHOST:-?}:${PGPORT:-5432}/${PGDATABASE:-?}"
log "interval ${BACKUP_INTERVAL}s, keeping ${BACKUP_KEEP_DAYS} days, into ${BACKUP_DIR}"

while true; do
  stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  target="${BACKUP_DIR}/mrms-${stamp}.dump"

  # Write to a temporary name and move on success, so a dump interrupted
  # halfway can never be mistaken for a usable backup.
  if pg_dump -Fc -f "${target}.partial"; then
    mv "${target}.partial" "$target"
    log "wrote $(basename "$target") ($(du -h "$target" | cut -f1))"
  else
    rm -f "${target}.partial"
    log "FAILED — pg_dump exited non-zero; previous dumps are untouched"
  fi

  deleted="$(find "$BACKUP_DIR" -name 'mrms-*.dump' -type f -mtime "+${BACKUP_KEEP_DAYS}" -print -delete | wc -l | tr -d ' ')"
  [ "$deleted" != "0" ] && log "pruned ${deleted} dump(s) older than ${BACKUP_KEEP_DAYS} days"

  sleep "$BACKUP_INTERVAL"
done
