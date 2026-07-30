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
      // The current implementation (apps/ingestor/src/index.ts) is a one-shot stub that
      // logs and exits — not a long-running worker yet. autorestart: false keeps pm2 from
      // crash-looping it. Revisit once ingestor actually does its scanning-worker job.
      autorestart: false,
      env: { NODE_ENV: 'production' },
    },
  ],
};
