#!/usr/bin/env bash
# Daily Postgres backup of the Lead Center database.
# Required env: DIRECT_URL (Postgres direct connection string).
# Optional env: BACKUP_S3_BUCKET, BACKUP_S3_PREFIX (uploads to S3 if set).

set -euo pipefail

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "ERROR: DIRECT_URL is required" >&2
  exit 1
fi

DATE_STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="${BACKUP_DIR:-./backups}"
OUT_FILE="${OUT_DIR}/leadcenter-${DATE_STAMP}.sql.gz"

mkdir -p "$OUT_DIR"

echo "→ Dumping database to ${OUT_FILE}…"
pg_dump \
  --no-owner \
  --no-privileges \
  --format=plain \
  --schema=public \
  "$DIRECT_URL" \
  | gzip --best > "$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "✓ Done. Size: ${SIZE}"

# Optional: upload to S3 if AWS CLI is configured + bucket env is set
if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
  S3_PATH="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-leadcenter}/leadcenter-${DATE_STAMP}.sql.gz"
  echo "→ Uploading to ${S3_PATH}"
  aws s3 cp "$OUT_FILE" "$S3_PATH" --no-progress
  echo "✓ Uploaded"
fi

# Retention: keep only the last 30 local backups
if [[ -d "$OUT_DIR" ]]; then
  ls -t "$OUT_DIR"/leadcenter-*.sql.gz 2>/dev/null | tail -n +31 | xargs -I {} rm -f {} || true
fi
