#!/usr/bin/env bash
# Runs ON THE VM, piped over SSH by .github/workflows/cd.yml — not meant to be run
# from a developer machine. By the time this runs, cd.yml has already rsynced the
# built release into $BASE_DIR/releases/$RELEASE_SHA; this script's job is everything
# that has to happen on the VM itself: migrate, flip the symlink, reload pm2, clean up.
set -euo pipefail

RELEASE_SHA="$1"
BASE_DIR="/opt/daleelex"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_SHA"

# Production secrets (DATABASE_URL, DALEELEX_ADMIN_API_TOKEN, JENKINS_*) live in a
# persistent file the VM owns, never in the repo or in a GitHub secret that would put
# them through CI. Each release just symlinks to it — Prisma's CLI and apps/api's own
# env.ts loader both read a plain .env from the process's cwd.
ln -sfn "$BASE_DIR/shared/api.env" "$RELEASE_DIR/api/.env"

cd "$RELEASE_DIR/api"
./node_modules/.bin/prisma migrate deploy

# Atomic swap — the previous release stays on disk untouched until pruned below, so
# rollback is "repoint this symlink at an older releases/<sha> dir and reload pm2."
ln -sfn "$RELEASE_DIR" "$BASE_DIR/current"

# startOrReload handles both the very first deploy (nothing running yet) and every
# deploy after (graceful reload, not a hard restart, so Caddy never sees a dropped
# connection it can't retry).
pm2 startOrReload "$BASE_DIR/current/ecosystem.config.cjs"
pm2 save

# Keep the last 5 releases so rollback doesn't depend on re-running CI.
cd "$BASE_DIR/releases"
ls -dt */ | tail -n +6 | xargs -r rm -rf

# Fail the deploy loudly if the reload didn't actually come back up healthy.
for i in $(seq 1 15); do
  curl -sf http://localhost:3000/api/v1/health > /dev/null && exit 0
  sleep 1
done
echo "daleelex-api did not report healthy after reload" >&2
exit 1
