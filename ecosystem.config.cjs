// Deployed into every release directory (see .github/workflows/cd.yml and
// scripts/deploy-remote.sh) and invoked via the `current` symlink. Paths are
// spelled out through that symlink on purpose — NOT via __dirname: Node resolves
// symlinks when loading this file, so __dirname is the realpath of whichever
// releases/<sha> dir was current at the time, and pm2 keeps an app's original cwd
// across startOrReload. Together those pinned the API to the first-ever release
// while every later deploy silently reloaded the same old code. With the literal
// symlinked cwd, each reload re-spawns through `current` and picks up whatever
// release the symlink points at.
const BASE_DIR = '/opt/daleelex';

module.exports = {
  apps: [
    {
      name: 'daleelex-api',
      cwd: `${BASE_DIR}/current/api`,
      script: './dist/index.js',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'daleelex-ingestor',
      cwd: `${BASE_DIR}/current/ingestor`,
      script: './dist/index.js',
      // A long-running worker: INGEST_INTERVAL_MINUTES makes it repeat its run
      // (catalogue, docs, scorecards) instead of exiting after one. The schedule
      // lives in the process rather than in pm2's cron_restart because pm2
      // documents that option as needing the app to be running, and a one-shot
      // has exited by then.
      //
      // It exits non-zero when it has no DATABASE_URL. The delay and cap stop
      // that from becoming a tight crash loop: pm2 marks it errored and leaves
      // the API alone.
      restart_delay: 30_000,
      max_restarts: 10,
      env: { NODE_ENV: 'production', INGEST_INTERVAL_MINUTES: '60' },
    },
  ],
};
