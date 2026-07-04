#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
pnpm exec prisma migrate deploy

echo "[entrypoint] Starting application..."
exec pnpm start:prod