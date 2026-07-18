# CI/CD pipeline

## 1. Overview

Before this pipeline existed, shipping a change meant SSHing into the production VM,
pulling latest code, and restarting pm2 processes by hand — no automated checks, no
build step (the VM was running `pnpm dev` in production; see the CD section), no
record of who deployed what or when.

The shape now:

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and every push to
  `master`: lint, typecheck, tests, and a Playwright e2e smoke test, in parallel.
- **CD** (`.github/workflows/cd.yml`) is triggered manually from the Actions tab
  (`workflow_dispatch`) — it is **not** automatic. See §3 for why.

CI and CD are two independent workflows, not one pipeline with stages. CD does not
wait for or depend on a specific CI run; it rebuilds from whatever ref you select when
you dispatch it. That means dispatching CD on a commit that hasn't passed CI is
possible — nothing currently stops you. Check CI status yourself before deploying.

## 2. CI workflow (`ci.yml`)

**Triggers:** `pull_request` (any branch) and `push` to `master`. A `concurrency` group
keyed on `${{ github.ref }}` cancels a run in progress if you push again before it
finishes, so you're not waiting on stale results.

Four jobs, all independent (no `needs:` between them), so a slow job never blocks a
fast one from reporting:

### `lint`

`pnpm lint` (ESLint across all workspaces via `eslint.config.js` at the repo root) plus
`pnpm format:check` (Prettier, scoped to `apps/`, `packages/`, and root config — see
`.prettierignore` for what's excluded and why). Fastest job, no Postgres needed.

### `typecheck`

`pnpm typecheck`, which fans out to `tsc --noEmit` in every workspace. Needs a real
Prisma Client generated first — see the "why `prisma generate` is explicit" callout
below.

### `test`

Runs `pnpm -r test` (Vitest) across `api`, `web`, `ingestor` against a real
`postgres:16` service container (same credentials as `docker-compose.yml`:
`daleelex`/`daleelex`/`daleelex`, port 5432). Runs `prisma migrate deploy` against it
first.

There's deliberately no separate "unit tests only, no DB" job. Nothing in the codebase
currently distinguishes DB-touching tests from pure ones — there's one test file
(`apps/api/src/auth.test.ts`) and it doesn't touch the DB — so a Postgres-less job
would just be a strict subset of this one. Worth splitting if that changes.

### `e2e`

Runs on every PR, not just `master`. The suite is one Chromium smoke test
(`apps/web/e2e/smoke.spec.ts`); with the browser binary cached (`actions/cache`, keyed
on `pnpm-lock.yaml`), it's fast enough that gating every PR on it is worth it — there's
no staging environment, so catching an e2e break before merge is much cheaper than
finding it after a production deploy.

This job runs the **real stack**, not just a static preview: it builds and boots the
actual API (`pnpm --filter @daleelex/api build` then `pnpm --filter @daleelex/api
start &`, health-checked via a curl loop against `/api/v1/health` before proceeding),
builds web, then runs `vite preview` (via Playwright's `webServer` config in
`apps/web/playwright.config.ts`) against it. `apps/web/vite.config.ts`'s `preview.proxy`
forwards `/api` to `localhost:3000`, matching how Caddy routes in production (§5) and
how the dev server proxies in local dev.

### Why `prisma generate` is an explicit step

Every job that touches Prisma-typed code (`typecheck`, `test`, `e2e`) runs
`pnpm --filter @daleelex/api exec prisma generate` right after `pnpm install
--frozen-lockfile` and before anything else. This looks redundant — `@prisma/client`
ships a `postinstall` script that's supposed to do exactly this — but it doesn't
reliably fire under `pnpm install --frozen-lockfile` in this setup. No warning, it
silently doesn't run.

This was a real, reproduced bug, not a defensive guess: without an explicit generate
step, `@prisma/client`'s types fall back to an ungenerated stub, and every
un-annotated callback over a Prisma query result (e.g. `services.map(...)` in
`apps/api/src/routes/docs.ts`, `teams.map(...)`/`.filter(...)` in
`apps/api/src/routes/teams.ts`) loses contextual typing and becomes implicit `any` —
`tsc` fails with `TS7006`. Confirmed by wiping `node_modules` and reinstalling from
scratch and watching it fail identically to what CI reported, then fixed and
reconfirmed clean.

If you ever see `TS7006: Parameter '...' implicitly has an 'any' type` on a callback
that looks correctly structured, check whether `prisma generate` actually ran in that
job before assuming the application code is wrong.

## 3. CD workflow (`cd.yml`)

**Trigger:** `workflow_dispatch` only. You go to the Actions tab → CD → "Run workflow"
→ pick a branch/ref → run.

**This is a known gap, not the intended final design.** The `deploy` job is scoped to
a `production` GitHub Environment specifically so it can be gated by required
reviewers — but required-reviewer environment protection isn't available on this
repo's current GitHub plan. `workflow_dispatch` is standing in as the manual gate: as
long as nothing fires it automatically, a human has to deliberately choose to deploy.
The moment required reviewers become available, the trigger should go back to
reacting to CI success automatically (it originally did, via `workflow_run` watching
the CI workflow — see git history around commit `97e1abe` for the before/after), with
the environment's required-reviewer rule as the actual gate instead of the trigger
type itself.

Practical consequence: dispatching CD does **not** verify the chosen ref passed CI.
That check is on you.

### `build` job

Runs on whatever ref was selected in the dispatch UI (`ref: ${{ github.sha }}`).
Installs deps, generates the Prisma Client (same reason as CI — see §2), then:

1. `tsc` builds for `api` and `ingestor`, `tsc && vite build` for `web`.
2. `pnpm --filter @daleelex/api deploy --prod out/api` and the same for `ingestor` —
   pnpm's own workspace-deploy command, which resolves the `@daleelex/shared` link and
   prunes to production-only `node_modules` per app. This is why `prisma` (the CLI, not
   just `@prisma/client`) is a `dependencies` entry rather than `devDependencies` in
   `apps/api/package.json` — `--prod` would otherwise strip it, and `deploy-remote.sh`
   needs it on the VM.
3. **A second `prisma generate`, this time inside `out/api`.** `pnpm deploy` builds an
   entirely independent `node_modules` tree — the client generated in step 0 doesn't
   carry over. Without this second generate, the deployed artifact's `@prisma/client`
   can't even be imported (`Cannot find module '.prisma/client/default'`), which was
   confirmed by actually trying to import it from a deployed-artifact dry run. This
   would have crashed `daleelex-api` on boot the first time it reached the VM.
4. `web`'s built `dist/` is copied into `out/web/` — it's static files, no
   `pnpm deploy` needed (nothing runs it as a Node process; Caddy serves it directly,
   §5).
5. `ecosystem.config.cjs` (repo root) is copied alongside into `out/`.
6. Everything under `out/` is tarred into `release.tar.gz` and uploaded as a build
   artifact (`actions/upload-artifact`, 14-day retention).

### `deploy` job

`needs: build`, `environment: production` (see §4 for what that requires in repo
settings today). Downloads the artifact, extracts it, writes the SSH key and known
hosts from secrets into `~/.ssh/`, then:

1. `rsync -az --delete` the extracted `out/` to
   `/opt/daleelex/releases/<sha>/` on the VM.
2. Pipes `scripts/deploy-remote.sh` over SSH (`ssh ... 'bash -s' -- "<sha>" <
scripts/deploy-remote.sh`) to run everything that has to happen on the VM itself.

### What `deploy-remote.sh` actually does, step by step

Runs **on the VM**, not the runner. In order:

1. `ln -sfn /opt/daleelex/shared/api.env <release>/api/.env` — symlinks the
   persistent, VM-owned secrets file into this release. Both Prisma's CLI and
   `apps/api/src/env.ts`'s own loader read a plain `.env` from the process's cwd, so
   this one symlink covers both.
2. `cd <release>/api && ./node_modules/.bin/prisma migrate deploy` — applies any
   pending migrations, using the just-symlinked `DATABASE_URL`.
3. `ln -sfn <release> /opt/daleelex/current` — the atomic swap. The previous release
   stays on disk untouched (see §7, rollback).
4. `pm2 startOrReload /opt/daleelex/current/ecosystem.config.cjs` — starts
   `daleelex-api` and `daleelex-ingestor` if they're not running, or gracefully
   reloads them if they are. `pm2 save` persists the process list.
5. Prunes old releases: keeps the 5 most recent under `/opt/daleelex/releases/`,
   deletes the rest.
6. Health-checks: curls `http://localhost:3000/api/v1/health` in a retry loop for up
   to 15 seconds. If it never comes back healthy, the script exits 1 and the whole
   deploy job fails loudly — you'll know immediately if a deploy didn't actually come
   up, not find out later from a user report.

## 4. Required GitHub configuration

**Secrets** (repo Settings → Secrets and variables → Actions → New repository secret):

| Secret            | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| `SSH_HOST`        | The VM's address                                                |
| `SSH_USER`        | The SSH user (`opc` on the current Oracle Cloud VM)             |
| `SSH_PRIVATE_KEY` | Private half of a dedicated deploy keypair (not a personal key) |
| `SSH_KNOWN_HOSTS` | Output of `ssh-keyscan <SSH_HOST>`                              |

**Environment:** Settings → Environments → New environment → name it exactly
`production` (must match `environment: production` in `cd.yml`'s `deploy` job, or the
job will implicitly create/use a differently-configured environment). Required
reviewers isn't available on this plan yet (§3) — once it is, add reviewers here and
that becomes the real approval gate.

### Rotating the SSH key

If the deploy key is ever compromised:

1. Generate a new keypair: `ssh-keygen -t ed25519 -C "daleelex-ci-deploy" -f
./daleelex_deploy_new -N ""`.
2. On the VM, add the new public key to `~/.ssh/authorized_keys` for the `SSH_USER`
   account (append, don't replace yet).
3. Update the `SSH_PRIVATE_KEY` secret in GitHub with the new private key's contents.
4. Trigger a CD run (or just SSH in manually) to confirm the new key works end to end.
5. Only then remove the old public key line from `~/.ssh/authorized_keys` on the VM,
   and delete the local copies of both keypairs.

Don't skip step 5 — an old key left in `authorized_keys` after "rotation" isn't
actually rotated.

## 5. VM-side setup

### Directory layout

```
/opt/daleelex/
├── shared/
│   └── api.env              # persistent secrets, never touched by CD
├── releases/
│   ├── <sha>/
│   │   ├── api/              # pnpm deploy --prod output + symlinked .env
│   │   ├── ingestor/         # pnpm deploy --prod output
│   │   ├── web/               # static built assets
│   │   └── ecosystem.config.cjs
│   └── <older sha>/ ...       # up to 5 kept, oldest pruned automatically
└── current -> releases/<sha>  # symlink, flipped atomically on each deploy
```

### `/opt/daleelex/shared/api.env`

Must exist before the first deploy — nothing in the pipeline creates it. Required
keys (see `apps/api/.env.example` for the local-dev equivalents; production values
are not documented here on purpose):

- `DATABASE_URL`
- `DALEELEX_ADMIN_API_TOKEN`
- `CORS_ORIGIN` — set to the real site origin (e.g. `https://daleelex.com`); if unset,
  `apps/api/src/index.ts` falls back to `http://localhost:5173`, which is wrong for
  production.
- `JENKINS_BASE_URL`
- `JENKINS_USERNAME`
- `JENKINS_API_TOKEN`

### `ecosystem.config.cjs`

Lives at the repo root, gets copied into every release. Defines two pm2 apps:

- **`daleelex-api`** — `cwd` resolved as `path.join(__dirname, 'api')`, runs
  `./dist/index.js`, `NODE_ENV: production`.
- **`daleelex-ingestor`** — same shape, pointed at `ingestor/dist/index.js`, but with
  `autorestart: false`. The current implementation
  (`apps/ingestor/src/index.ts`) is a one-shot stub that logs and exits — it is
  **not** a real long-running worker yet. `autorestart: false` stops pm2 from
  crash-looping it. Once ingestor actually does its scanning-worker job, this needs
  revisiting (probably `autorestart: true` plus a real long-running process, or a
  `cron_restart` schedule if it's meant to run periodically rather than continuously).

There is intentionally **no `daleelex-web` pm2 app** in this config. See §8 — the old
manually-managed `daleelex-web` process (running `pnpm dev -- --host`, i.e. Vite's
dev server, in production) needs to be deleted separately; it's not part of what CD
manages.

### Caddy routing

Caddy needs to be configured (once, manually — this repo doesn't manage the
Caddyfile) to:

- Serve `/opt/daleelex/current/web` as static files (`file_server`) for everything
  that isn't `/api/*`.
- Reverse-proxy `/api/*` to `localhost:3000` (where `daleelex-api` listens —
  see `apps/api/src/index.ts`'s `app.listen({ port: 3000, host: '0.0.0.0' })`), with
  the path preserved as-is (no rewrite — `apps/api/src/index.ts` registers routes with
  `prefix: '/api/v1'`, so the incoming `/api/v1/...` path needs to reach Fastify
  unchanged, the same way `apps/web/vite.config.ts`'s dev/preview proxy already does
  it).

This mirrors exactly how local dev and the CI `e2e` job route traffic — same
`/api` prefix, same no-rewrite behavior — so what passes e2e in CI should behave the
same in production, module for the actual TLS termination Caddy adds on top.

## 6. How to deploy

1. Land your change on `master` the normal way — PR, CI green, merge.
2. Confirm CI actually passed on the specific commit you're about to deploy (CD does
   not check this for you — see §3).
3. Go to the repo's Actions tab → **CD** workflow → **Run workflow**.
4. Pick the branch/ref (normally `master`, at the commit you just confirmed).
5. Click **Run workflow**.
6. Watch the `build` job — it should be quick (build + package). If it fails, nothing
   has touched the VM yet; safe to just fix and re-dispatch.
7. The `deploy` job will wait if `production` environment protection is configured (or
   just start immediately if it isn't — see §4). Once it runs: watch the "Migrate,
   flip symlink, reload pm2" step's output. It ends with a health-check loop — if the
   step succeeds, `daleelex-api` reported healthy after the reload.
8. Spot check the live site.

## 7. How to roll back

There's no blue/green setup and no automated rollback — this is a manual, deliberate
step, by design, since automatically reversing a Prisma migration isn't something
that can be done safely in general.

**Quick reference — run on the VM, in order:**

```bash
ssh <SSH_USER>@<SSH_HOST>

# 1. See what's currently live (this is the release you're rolling back FROM).
readlink -f /opt/daleelex/current

# 2. See what's available (most recent first — up to 5 kept, older ones auto-pruned).
#    Pick the newest one that ISN'T the sha readlink just showed you.
ls -dt /opt/daleelex/releases/*/

# 3. Point `current` at it and reload pm2.
ln -sfn /opt/daleelex/releases/<target-sha> /opt/daleelex/current
pm2 startOrReload /opt/daleelex/current/ecosystem.config.cjs
pm2 save

# 4. Confirm it's actually up.
curl -sf http://localhost:3000/api/v1/health
```

That's the whole rollback. Steps below are the same four things with the reasoning
behind each, for when you have time to read it (or if step 4 above didn't come back
healthy and you need to figure out why):

1. `readlink -f /opt/daleelex/current` — identifies the bad release so you know which
   sha you're moving away from, and so step 2 doesn't accidentally re-select it.
2. `ls -dt /opt/daleelex/releases/*/` lists releases newest-first. `deploy-remote.sh`
   prunes anything past the 5 most recent on every successful deploy, so the previous
   good release should still be on disk unless you're rolling back further than that.
3. `ln -sfn <target> /opt/daleelex/current` is the same atomic symlink swap
   `deploy-remote.sh` does on every deploy — nothing special about doing it by hand.
   `pm2 startOrReload` picks up the new `current` path via `ecosystem.config.cjs`'s
   `path.join(__dirname, 'api')` (§5); `pm2 save` persists it so a VM reboot doesn't
   revert to the bad release.
4. Same health check `deploy-remote.sh` runs after every deploy. If this doesn't
   return healthy, the problem likely isn't the rollback itself — check
   `pm2 logs daleelex-api` next.

**This does not undo database migrations.** A bad migration that already ran against
production has no automated undo in this pipeline — rolling back the symlink swaps
which _code_ is live, not the database schema it talks to. If the bad deploy included
a migration incompatible with the older release's code, you need to manually assess
whether it's safe to leave applied (additive changes usually are) or needs a
hand-written down-migration before the rollback above is actually safe to do. There's
no tooling for this yet; treat it as a "stop and think" moment, not a scripted step.

## 8. Known gaps / follow-ups

- **`workflow_dispatch` instead of required reviewers** (§3). Standing in for
  environment protection that isn't available on this GitHub plan. Revisit the
  trigger once it is — the original `workflow_run`-based design (auto-trigger off CI
  success, environment required-reviewers as the actual gate) is preserved in git
  history around commit `97e1abe` if useful as a reference when switching back.

- **The old `daleelex-web` pm2 process needs manual cleanup.** Before this pipeline,
  `daleelex-web` ran `pnpm dev -- --host` (Vite's dev server) directly against
  production traffic for roughly two weeks — this is also why `apps/api/src/index.ts`
  used to hardcode its CORS origin to `http://localhost:5173`, since that's the dev
  server's port. The new setup serves `web` as static files via Caddy with no pm2
  process at all. After the **first successful** automated deploy under this
  pipeline, and after confirming the Caddyfile change (§5) is live and working, run
  `pm2 delete daleelex-web` on the VM. Don't do this before the Caddyfile is updated —
  you'd take the site down with nothing serving it.

- **`apps/ingestor` is a stub, not a real worker.** `autorestart: false` in
  `ecosystem.config.cjs` reflects this honestly rather than papering over it — see
  §5. When ingestor becomes real, its pm2 config needs to change too.

- **No DB backup step before `prisma migrate deploy` in production.** In practice: a
  bad migration that reaches `master` and gets deployed has no automated undo — see
  §7's rollback caveat, which is this same gap described from the other side.
  `deploy-remote.sh` runs migrations directly against the production database with no
  automatic backup or dry-run first. This isn't a fresh risk this pipeline introduced
  — manual SSH deploys had the exact same exposure, just without a health check
  catching the aftermath. The safety net today is the deliberate,
  `workflow_dispatch`-gated trigger (§3) giving a human a chance to look at what's
  about to ship before it runs. Worth adding a `pg_dump` step before the migrate line
  if this pipeline ends up carrying schema changes regularly rather than mostly
  application-code deploys.

- **Sixteen pre-existing `any` casts in `apps/api/src/routes/{docs,teams,services}.ts`**
  are ESLint warnings (`@typescript-eslint/no-explicit-any` downgraded from error),
  not fixed. They're Prisma relation-shape casts that need real
  `Prisma.XGetPayload<{ include: {...} }>` typing to remove properly — out of scope
  for standing up the pipeline, but worth cleaning up separately.

- **No automated test/DB-test split** (§2, `test` job). Fine today with one test file;
  revisit if the test suite grows enough that Postgres startup time becomes a drag on
  PRs that don't need it.

- **CD's `build` job re-clones and reinstalls from scratch** rather than reusing
  anything from the CI run that validated the commit. Simpler and more isolated, but
  means CD doesn't actually know CI passed — see the first bullet above; the two gaps
  are related and would likely get fixed together if `workflow_run` comes back as the
  trigger.
