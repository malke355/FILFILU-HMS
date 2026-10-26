#!/usr/bin/env sh
# PostgreSQL backup for Filfilu HMS.
# Usage (from backend/, with .env loaded or vars exported):
#   ./scripts/backup-db.sh
#   ./scripts/backup-db.sh /path/to/backups
#
# Restores (example):
#   gunzip -c backups/hms-YYYYMMDD-HHMMSS.sql.gz | docker exec -i filfilu-hms-pg \
#     psql -U "$POSTGRES_SUPERUSER" -d "$PGDATABASE"

set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/backups}"
mkdir -p "$OUT_DIR"

# Load backend/.env if present (simple KEY=VALUE lines).
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5434}"
: "${PGDATABASE:=hms}"
: "${POSTGRES_SUPERUSER:=postgres}"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$OUT_DIR/hms-$STAMP.sql.gz.partial"
FILE="$OUT_DIR/hms-$STAMP.sql.gz"

cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT

echo "Backing up $PGDATABASE @ $PGHOST:$PGPORT → $FILE"

# Prefer Docker exec when the HMS container is running (uses superuser for dump).
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'filfilu-hms-pg'; then
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" filfilu-hms-pg \
    pg_dump -U "$POSTGRES_SUPERUSER" -d "$PGDATABASE" --no-owner --format=plain \
    | gzip -c > "$TMP"
else
  : "${PGPASSWORD:?Set PGPASSWORD or POSTGRES_PASSWORD}"
  PGPASSWORD="${POSTGRES_PASSWORD:-$PGPASSWORD}" pg_dump \
    -h "$PGHOST" -p "$PGPORT" -U "${POSTGRES_SUPERUSER}" -d "$PGDATABASE" \
    --no-owner --format=plain \
    | gzip -c > "$TMP"
fi

# Reject empty / tiny dumps (failed pipeline under gzip).
BYTES="$(wc -c < "$TMP" | tr -d ' ')"
if [ "${BYTES:-0}" -lt 64 ]; then
  echo "Backup failed: dump is empty or too small (${BYTES} bytes)." >&2
  exit 1
fi

mv "$TMP" "$FILE"
trap - EXIT

# Keep last 14 successful backups only.
ls -1t "$OUT_DIR"/hms-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  rm -f "$old"
done

echo "Done: $FILE ($BYTES bytes)"
ls -lh "$FILE"
