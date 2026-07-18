// Deployed into every release directory (see .github/workflows/cd.yml and
// scripts/deploy-remote.sh) and invoked via the `current` symlink, so paths are
// resolved relative to this file rather than to whatever cwd pm2 happens to run from.
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'daleelex-api',
      cwd: path.join(__dirname, 'api'),
      script: './dist/index.js',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'daleelex-ingestor',
      cwd: path.join(__dirname, 'ingestor'),
      script: './dist/index.js',
      // The current implementation (apps/ingestor/src/index.ts) is a one-shot stub that
      // logs and exits — not a long-running worker yet. autorestart: false keeps pm2 from
      // crash-looping it. Revisit once ingestor actually does its scanning-worker job.
      autorestart: false,
      env: { NODE_ENV: 'production' },
    },
  ],
};
