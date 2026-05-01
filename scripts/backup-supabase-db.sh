#!/usr/bin/env bash
set -euo pipefail

# Backup a self-hosted Supabase Postgres container.
#
# Defaults target the Docker container named "supabase-db".
# Override if needed:
#   CONTAINER_NAME=supabase-db DB_USER=postgres DB_NAME=postgres ./scripts/backup-supabase-db.sh

cd "$(dirname "$0")/.."

CONTAINER_NAME="${CONTAINER_NAME:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backup/supabase}"
DATE="$(date -u +%Y-%m-%dT%H-%M-%SZ)"

BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"
BACKUP_TMP="$BACKUP_FILE.tmp"
GLOBALS_FILE="$BACKUP_DIR/globals_$DATE.sql.gz"
GLOBALS_TMP="$GLOBALS_FILE.tmp"

cleanup_tmp() {
  rm -f "$BACKUP_TMP" "$GLOBALS_TMP"
}
trap cleanup_tmp EXIT

mkdir -p "$BACKUP_DIR"

echo "Starting Supabase DB backup at $DATE"
echo "Container: $CONTAINER_NAME"
echo "Database:  $DB_NAME"
echo "Output:    $BACKUP_FILE"

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Container not found: $CONTAINER_NAME" >&2
  echo "Check with: docker ps --format 'table {{.Names}}\t{{.Status}}'" >&2
  exit 1
fi

docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null

docker exec "$CONTAINER_NAME" \
  pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
  | gzip -c > "$BACKUP_TMP"

gzip -t "$BACKUP_TMP"
test -s "$BACKUP_TMP"
mv "$BACKUP_TMP" "$BACKUP_FILE"

echo "Database backup successful: $BACKUP_FILE"

echo "Backing up global roles..."
docker exec "$CONTAINER_NAME" \
  pg_dumpall \
    -U "$DB_USER" \
    --globals-only \
  | gzip -c > "$GLOBALS_TMP"

gzip -t "$GLOBALS_TMP"
test -s "$GLOBALS_TMP"
mv "$GLOBALS_TMP" "$GLOBALS_FILE"

echo "Globals backup successful: $GLOBALS_FILE"

# Retention: delete backups older than 7 days.
# Keep your own off-server backup copy; this only manages local files.
find "$BACKUP_DIR" -type f -name "backup_*.sql.gz" -mtime +7 -print -delete
find "$BACKUP_DIR" -type f -name "globals_*.sql.gz" -mtime +7 -print -delete

echo "Cleanup done."
