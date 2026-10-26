#!/usr/bin/env sh
# PostgreSQL backup for Filfilu HMS.
# Usage (from backend/, with .env loaded or vars exported):
#   ./scripts/backup-db.sh
#   ./scripts/backup-db.sh /path/to/backups
#
# Restores (example):
#   gunzip -c backups/hms-YYYYMMDD-HHMMSS.sql.gz | docker exec -i filfilu-hms-pg \
#     psql -U "$POSTGRES_SUPERUSER" -d "$PGDATABASE"

set -eu

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
FILE="$OUT_DIR/hms-$STAMP.sql.gz"

echo "Backing up $PGDATABASE @ $PGHOST:$PGPORT → $FILE"

# Prefer Docker exec when the HMS container is running (uses superuser for dump).
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'filfilu-hms-pg'; then
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" filfilu-hms-pg \
    pg_dump -U "$POSTGRES_SUPERUSER" -d "$PGDATABASE" --no-owner --format=plain \
    | gzip -c > "$FILE"
else
  : "${PGPASSWORD:?Set PGPASSWORD or POSTGRES_PASSWORD}"
  PGPASSWORD="${POSTGRES_PASSWORD:-$PGPASSWORD}" pg_dump \
    -h "$PGHOST" -p "$PGPORT" -U "${POSTGRES_SUPERUSER}" -d "$PGDATABASE" \
    --no-owner --format=plain \
    | gzip -c > "$FILE"
fi

# Keep last 14 backups in the target directory.
ls -1t "$OUT_DIR"/hms-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  rm -f "$old"
done

echo "Done: $FILE"
ls -lh "$FILE"
