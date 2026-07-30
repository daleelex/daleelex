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

# Self-heal from the pinned-cwd bug: pm2 keeps an app's original cwd across
# startOrReload, and older ecosystem configs derived cwd from __dirname — which Node
# realpaths to a specific releases/<sha> dir, so those processes reload old code
# forever. Delete any app whose cwd doesn't go through the `current` symlink so
# startOrReload below re-registers it with the corrected config. One hard restart
# for affected apps, then this is a no-op on every future deploy.
for app in daleelex-api daleelex-ingestor; do
  pinned=$(pm2 jlist 2>/dev/null | node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c)).on("end", () => {
      const proc = JSON.parse(d.trim() || "[]").find((p) => p.name === process.argv[1]);
      console.log(proc?.pm2_env?.pm_cwd ?? "");
    });' "$app" || true)
  if [ -n "$pinned" ] && [[ "$pinned" != "$BASE_DIR/current/"* ]]; then
    echo "pm2 app $app pinned to $pinned — deleting so it re-registers via current/"
    pm2 delete "$app"
  fi
done

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
