#!/usr/bin/env sh
set -eu

echo "[filfilu] Applying migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[filfilu] Starting API..."
exec node dist/index.js
