# DaleelEx

Internal developer portal and service catalogue. Engineers use it to find every service the company runs, see who owns it, check its health score, read its docs, and understand its dependencies.

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Workspace structure](#workspace-structure)
- [Common tasks](#common-tasks)
- [The catalog-info.yaml contract](#the-catalog-infoyaml-contract)
- [API surface](#api-surface)
- [Authentication and authorization](#authentication-and-authorization)
- [Database and migrations](#database-and-migrations)
- [TechDocs repository sync](#techdocs-repository-sync)
- [Local Jenkins integration](#local-jenkins-integration)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## What it does

| Area | What you get |
|------|--------------|
| **Service catalogue** | Every service with its type, tier, lifecycle, language, repository, tags, and links. Services register themselves via a `catalog-info.yaml` in their own repo, or are created directly in the portal. |
| **Ownership** | Teams own services. Each service shows its owning team; each team page shows what it runs. |
| **Dependencies** | Services declare the services they depend on, by stable ID. |
| **Scorecards** | Weighted checks (README present, owner assigned, repository accessible, SLO defined, runbook linked, no open high-severity Dependabot alerts) roll up into a health score per service. |
| **TechDocs** | Markdown docs published from a service's own repo (`docs/**/*.md`), or uploaded through the portal. |
| **Readiness** | A checklist per service: SLO target, owner, runbook, dashboard, lifecycle. Declared in the catalog, not measured. |
| **Logs** | Paged service logs behind a stable query contract, so the backing log source can be swapped without changing the UI. |

## Architecture

Four layers, each a hard boundary:

```
GitHub repos (catalog-info.yaml)
        ↓
    Ingestor (apps/ingestor)   scans repos, parses YAML, runs scorecards, syncs docs
        ↓
    Database (Postgres)        single source of truth for the portal
        ↓
    API (apps/api)             Fastify REST service; all data access goes through here
        ↓
    Web (apps/web)             React SPA; reads only from the API, never the DB
```

The web app doesn't import Prisma. The API doesn't know about GitHub. The ingestor doesn't serve HTTP. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture and the stack decisions behind it.

**Stack:** Node.js 20 · TypeScript · Fastify · Prisma · PostgreSQL 16 · React 18 · Vite · TanStack Query · React Router · Clerk (auth) · Vitest (unit) · Playwright (e2e) · pnpm workspaces.

## Prerequisites

- **Node.js 20+** — check with `node -v`
- **pnpm 9+** — `corepack enable` installs the exact pinned version from `package.json`'s `packageManager` field
- **Docker** — for local Postgres (and optionally Jenkins)
- A **Clerk** account if you want sign-in to work locally (the catalogue itself is readable without it)

## Quick start

```bash
pnpm install
```

```bash
pnpm db:up
```

Create local env files from the examples:

```bash
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env && cp apps/ingestor/.env.example apps/ingestor/.env
```

Apply migrations and seed sample data:

```bash
pnpm db:migrate && pnpm db:seed
```

Start everything:

```bash
pnpm dev
```

The web app runs at http://localhost:5173 and the API at http://localhost:3000. The Vite dev server proxies `/api` through to the API, so the browser only ever talks to one origin — the same shape Caddy serves in production.

Verify the API is up:

```bash
curl -s http://localhost:3000/api/v1/health
```

## Environment variables

Each app loads a plain `.env` from its own directory (`apps/api/src/env.ts` does this without a dotenv dependency). Copy the `.env.example` next to it and fill in the blanks. None of these files are committed.

### `apps/api/.env`

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string. The example matches `docker-compose.yml`. |
| `CLERK_SECRET_KEY` | for signed-in actions | Verifies session tokens and resolves the caller's admin role. Without it, guarded endpoints return `503 clerk_auth_not_configured` rather than pretending the session is bad. |
| `CORS_ORIGIN` | no | Allowed browser origin. Defaults to `http://localhost:5173`. Production sets the real site origin. |
| `JENKINS_BASE_URL` | no | Jenkins instance for the health integration. |
| `JENKINS_USERNAME` | no | Jenkins user for API calls. |
| `JENKINS_API_TOKEN` | no | Jenkins API token (not the account password). |
| `DALEELEX_ADMIN_API_TOKEN` | no | Static-token admin guard (`apps/api/src/auth.ts`). Route authorization is Clerk-based today — see [Authentication and authorization](#authentication-and-authorization). |

### `apps/web/.env`

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | yes, to boot | Clerk publishable key (`pk_…`). Publishable, not secret — Vite bakes `VITE_*` values into the client bundle at build time, so the build needs it present. |

### `apps/ingestor/.env`

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Same Postgres as the API. |
| `GITHUB_TOKEN` | for any sync | Token with read access to the repositories being scanned. The vulnerability scorecard check also needs read access to Dependabot alerts; without it that check is skipped, not failed. |
| `GITHUB_API_URL` | no | Defaults to `https://api.github.com`; override for GitHub Enterprise. |
| `GITHUB_ORG` | for catalog sync | Organisation to scan for `catalog-info.yaml`. Unset disables catalog ingestion. |
| `CATALOG_SYNC_REF` | no | Branch/tag/commit to read `catalog-info.yaml` from. Defaults to each repo's default branch. |
| `DOCS_SYNC_REF` | no | Git ref to sync docs from. Defaults to `HEAD`. |
| `INGEST_INTERVAL_MINUTES` | no | Minutes between runs. Unset runs once and exits, which is what `pnpm docs:sync` wants; production sets `60` so the ingestor stays up and repeats. |

## Workspace structure

```
daleelex/
├── apps/
│   ├── api/                     Fastify backend
│   │   ├── prisma/              schema.prisma, migrations, seed.ts
│   │   └── src/
│   │       ├── routes/          one file per resource (services, teams, docs, …)
│   │       ├── logs/            pluggable log sources behind one interface
│   │       ├── integrations/    Jenkins client
│   │       ├── auth.ts,
│   │       │   clerkAuth.ts     request guards
│   │       └── apiError.ts      the shared error envelope
│   ├── web/                     React frontend
│   │   └── src/
│   │       ├── pages/           one page component + its CSS per route
│   │       ├── components/      shared UI
│   │       └── lib/             API client, hooks, helpers
│   └── ingestor/                Background repo-scanning worker
├── packages/
│   └── shared/                  TypeScript types shared across apps (@daleelex/shared)
├── docs/CICD.md                 pipeline reference
├── scripts/deploy-remote.sh     what runs on the production VM
├── docker-compose.yml           Postgres + Jenkins for local dev
├── ecosystem.config.cjs         pm2 process definitions for production
├── ARCHITECTURE.md
└── README.md
```

Request and response types live in `packages/shared` so the API and the web app can't drift apart silently — if a response shape changes, both ends fail to typecheck.

## Common tasks

| Task | Command |
|------|---------|
| Start all apps | `pnpm dev` |
| Build everything | `pnpm build` |
| Run all tests | `pnpm test` |
| Lint everything | `pnpm lint` |
| Typecheck everything | `pnpm typecheck` |
| Format with Prettier | `pnpm format` |
| Check formatting (what CI runs) | `pnpm format:check` |
| Start Postgres | `pnpm db:up` |
| New DB migration | `pnpm db:migrate` |
| Seed the database | `pnpm db:seed` |
| Sync repository docs | `pnpm docs:sync` |
| Run one workspace's tests | `pnpm --filter @daleelex/api test` |
| Browser e2e suite | `pnpm --filter @daleelex/web e2e` |

## The catalog-info.yaml contract

Services register themselves by placing a `catalog-info.yaml` at the root of their repository:

```yaml
apiVersion: daleelex.io/v1
kind: Service
metadata:
  id: svc-auth-001          # stable — never changes
  name: Authentication Gateway
  description: |
    OAuth2 / OIDC gateway handling SSO and token issuance.
spec:
  type: api                 # api | db | web | ml | tool
  tier: 1                   # 1 | 2 | 3
  lifecycle: production     # production | beta | deprecated
  owner: platform-identity  # must match a team ID
  language: Go
  repository: platform/auth-gateway
  slo:
    target: "99.95%"
    window: 30d
  tags: [critical, security]
  links:
    - url: https://runbook.internal/auth
      title: Runbook
      type: runbook
  dependencies:
    - svc-gw-005
```

Rules that matter:

- **Service IDs are immutable.** Names can change; IDs never do.
- **Dependencies reference IDs, not names.**
- **Unknown fields are a soft warning, not a hard error** — one team's experiment shouldn't break everyone else's page.
- **Provenance is tracked.** Entities record whether they're portal-managed or repository-managed. Repository-managed entities must be changed at their source, so ingestion can't silently overwrite a portal edit.

### Running ingestion

Set `GITHUB_ORG` and run the ingestor. It lists every non-archived repository in the
organisation, reads `catalog-info.yaml` from each (a repository without one is simply not
registered), and upserts the services it finds as repository-managed.

```bash
pnpm docs:sync -- --dry-run   # report what would change, write nothing
pnpm docs:sync                # apply, then sync TechDocs as before
```

Behaviour worth knowing before you point it at a real organisation:

- A file that fails validation is reported and skipped; the rest of the run continues.
- An `owner` that doesn't match a team imports the service **unowned**, with a warning, rather than dropping it.
- A service id already managed in the portal is **not** taken over — remove it there first.
- If two repositories claim the same id, the first alphabetically wins and the other is reported.
- Links and dependencies are replaced wholesale on each run — neither has a stable identity in the
  file, so they are not diffed.
- A dependency on a service outside the catalogue is reported and dropped, not created as a stub.
- A repository-managed service that no repository declares any more — its `catalog-info.yaml` was
  removed, or the repository archived or deleted — is retired: soft-deleted, so it leaves the
  portal but keeps its history, and returns if a repository declares it again.
- A service is only retired when the run could tell it was gone. A file that failed to download or
  to validate keeps its service, and a run that finds no catalog files at all retires nothing,
  since that points at the token or `GITHUB_ORG` rather than at every service being withdrawn.
- Portal-managed services are never retired by ingestion.

DaleelEx registers itself: see [catalog-info.yaml](./catalog-info.yaml) at the repository root.

## API surface

All routes are served under the `/api/v1` prefix.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/health` | — | Liveness check; used by CI and the deploy health gate. |
| `GET` | `/stats` | — | Portal-wide counts and rollups. |
| `GET` | `/services` | — | List services with their teams, tags, and scores. |
| `POST` | `/services` | admin | Create a portal-managed service. |
| `PATCH` | `/services/:id` | admin | Update a portal-managed service. |
| `DELETE` | `/services/:id` | admin | Delete a portal-managed service. |
| `GET` | `/services/:id/logs` | signed in | Paged logs for one service. |
| `GET` | `/teams` | — | List teams. |
| `POST` | `/teams` | admin | Create a team. |
| `PATCH` | `/teams/:id` | admin | Update a team. |
| `DELETE` | `/teams/:id` | admin | Delete a portal-managed team that owns no services. |
| `GET` | `/docs` | — | TechDocs index across services. |
| `GET` | `/services/:id/docs` | — | Documents for one service. |
| `GET` | `/services/:id/docs/:docId` | — | One document. |
| `POST` | `/services/:id/docs` | signed in | Upload a document to a service. |
| `PATCH` | `/services/:id/docs/:docId` | signed in | Edit an uploaded document. |
| `GET` | `/me` | signed in | The current Clerk user as the portal sees them. |
| `GET` | `/integrations/jenkins` | — | Current Jenkins configuration. |
| `PUT` | `/integrations/jenkins` | — | Update Jenkins configuration. |
| `POST` | `/integrations/jenkins/test` | — | Test a Jenkins connection. |
| `GET` | `/integrations/jenkins/health` | — | Jenkins reachability for the Health & SLO page. |
| `GET` | `/integrations/loki` | admin | Current Loki configuration and where it comes from. |
| `PUT` | `/integrations/loki` | admin | Save the Loki URL and service label. |
| `DELETE` | `/integrations/loki` | admin | Remove the saved Loki configuration. |
| `POST` | `/integrations/loki/test` | admin | Test a Loki connection. |

Errors use one envelope everywhere ([apiError.ts](apps/api/src/apiError.ts)):

```json
{
  "error": {
    "code": "admin_forbidden",
    "message": "This action requires an administrator account.",
    "details": {}
  }
}
```

Client code should branch on `error.code`, never on the message text.

## Authentication and authorization

Sign-in is [Clerk](https://clerk.com). The web app holds the session; the API verifies the bearer token on every guarded request.

Three levels:

- **Public** — reading the catalogue, teams, stats, and docs.
- **Signed in** (`requireClerkUser`) — `/me`, service logs, doc upload and edit. Missing token → `401 missing_session_token`; bad token → `401 invalid_session_token`.
- **Admin** (`requireClerkAdmin`) — creating, updating, and deleting services and teams. An admin is a Clerk user whose `publicMetadata.role` is `"admin"`; set that on your own user in the Clerk dashboard to make catalogue edits locally. Non-admin → `403 admin_forbidden`.

Misconfiguration is reported as a server problem, not a user problem: with no `CLERK_SECRET_KEY`, guarded routes return `503 clerk_auth_not_configured` instead of telling a perfectly valid user their session expired.

## Database and migrations

PostgreSQL in every environment — no SQLite anywhere, because environment parity matters. Prisma is the ORM; the schema lives in [schema.prisma](apps/api/prisma/schema.prisma).

Core models: `Team`, `Service`, `ServiceDependency`, `Link`, `ScorecardCheck`, `ScorecardResult`, `ServiceDoc`, `User`, `IntegrationConfig`.

**Every schema change goes through a Prisma migration — no exceptions, including in dev.**

```bash
pnpm db:migrate
```

That creates the migration, applies it, and regenerates the client. Commit the generated migration directory alongside the schema change. To reset a local database to a clean seeded state:

```bash
pnpm --filter @daleelex/api exec prisma migrate reset
```

## TechDocs repository sync

Services with an `org/repo` value in their `repository` field can publish Markdown from `docs/**/*.md`. Set `GITHUB_TOKEN` in `apps/ingestor/.env` with read access to those repositories, then run:

```bash
pnpm docs:sync
```

Each sync reads documents at a stable commit, updates changed pages, and removes pages that no longer exist in the repository. Repository-relative links and images resolve against that same commit when rendered in the portal.

## Loki integration

Each service's Logs tab reads from Grafana Loki. An administrator connects it under **Settings → Integrations → Loki** by entering the Loki URL and the stream label that carries the catalog service ID (`service_id` by default); the change applies immediately, without restarting the API. `LOKI_URL` and `LOKI_SERVICE_LABEL` in the API's environment act as a fallback when nothing is saved. With neither, the Logs tab shows generated sample lines. Loki authentication is not supported yet.

See [docs/LOGS.md](./docs/LOGS.md) for how services label their logs, how to try it locally, and troubleshooting.

## Jenkins integration

The API can report the health of a Jenkins instance. Set `JENKINS_BASE_URL`, `JENKINS_USERNAME`, and `JENKINS_API_TOKEN` in `apps/api/.env` (or the root `.env` when running under Compose) and point them at an existing instance. The Health & SLO page shows the resulting connection status via `GET /api/v1/integrations/jenkins/health`.

Compose no longer ships a local Jenkins container. It published `0.0.0.0:8080`, which collided with the web container in the production overlay, and it was a heavyweight thing to start for a feature most work never touches.

## Testing

| Layer | Tool | Command |
|-------|------|---------|
| Unit / integration | Vitest | `pnpm test` |
| Browser e2e | Playwright (Chromium) | `pnpm --filter @daleelex/web e2e` |

The Vitest suites run without a database: API route tests mock `./db.js` and `@clerk/backend`, so `pnpm test` needs nothing running. Real database and migration behaviour is only exercised by the Playwright e2e job, which seeds a live Postgres and boots the actual API against it.

Test files are named for what they prove, not what they touch: `catalogAdminAuthorization.test.ts` asserts that catalogue mutations reject non-admins, and reads that way in the output.

## Docker

All three apps ship as container images. This runs alongside the pm2 deploy rather than replacing it — nothing about `ecosystem.config.cjs`, `cd.yml`, or the host Caddy changed.

### Local development

```bash
docker compose up -d --build
```

Source is bind-mounted and the watchers run inside the containers, so editing a file on the host reloads the service: `tsx watch` for the API, Vite HMR for the web app. The web app is on http://localhost:5173, the API on http://localhost:3000, Postgres on 5432.

The ingestor is a one-shot job rather than a service, so it sits behind a Compose profile and is not started by `up`:

```bash
docker compose build ingestor && docker compose run --rm ingestor
```

The explicit build matters: `up --build` skips services in inactive profiles, so without it `run` silently reuses the previous image.

Each service masks its `node_modules` with an anonymous volume, so the host's macOS build never shadows the container's Linux one. Those volumes survive `--build`, which means after changing dependencies or regenerating the Prisma client you need `docker compose up -d --build -V` (`-V` renews them). The symptom of forgetting is a module that is definitely installed being reported missing.

### Production

```bash
export DALEELEX_TAG=<git-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Naming both files is required, not stylistic: Compose auto-loads `docker-compose.override.yml`, and there is no implicit way to opt out, so a plain `up` on the VM would inherit the dev bind mounts. `DALEELEX_TAG` has no default and the stack refuses to start without it — deploying should name an exact commit.

Only the web container publishes a port, bound to `127.0.0.1:8080`, and Caddy stays on the host proxying into it. The API and Postgres have no host port at all; nginx inside the web container reaches the API over the Compose network.

Migrations are never run automatically on container start — a bad migration would otherwise take the service down on every restart with no review step:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm --entrypoint sh api -c './node_modules/.bin/prisma migrate deploy'
```

### Images and architectures

Images are published to GHCR as `ghcr.io/daleelex/daleelex-{api,web,ingestor}`, tagged with both the git SHA and `latest`, built for `linux/amd64` and `linux/arm64`. The arm64 half is what the Ampere production VM runs; amd64 covers developer machines and CI runners.

`apps/api/prisma/schema.prisma` therefore lists four `binaryTargets`. The two `-musl-` ones exist because the images are Alpine: Prisma's glibc engines will not load there, and the failure is a runtime `could not locate the Query Engine` on every database call rather than a build error.

To build and push by hand — normally CI's job:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_... ./scripts/build-images.sh
```

The web image bakes its Clerk key in at build time, because Vite inlines `VITE_*` into the bundle. A published web image is therefore pinned to one Clerk instance and cannot be repointed at another without rebuilding. Dev is unaffected — `vite dev` reads the variable at process start.

> **After the first successful push, confirm each package is private.** GHCR packages default to the source repository's visibility, but this is worth checking rather than assuming: GitHub → Packages → each of the three → Package settings → Danger Zone → Change visibility.

## CI/CD

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and every push to `master`: `lint`, `typecheck`, `test`, and `e2e` as four independent jobs, so a slow one never blocks a fast one from reporting. A concurrency group cancels superseded runs. On a push to `master` — never on a pull request — a fifth job, `images`, builds and pushes the three multi-arch images to GHCR once all four have passed. It authenticates with the built-in `GITHUB_TOKEN` and `packages: write`; no registry secret is involved.
- **CD** (`.github/workflows/cd.yml`) is dispatched manually from the Actions tab. It builds a release tarball, rsyncs it to the VM, runs `prisma migrate deploy`, swaps the `current` symlink, reloads pm2, and health-checks the API before declaring success. **CD does not verify that the chosen ref passed CI — check that yourself.**

One thing worth knowing before debugging a red build: every CI job that touches Prisma-typed code runs `prisma generate` explicitly, because `@prisma/client`'s `postinstall` doesn't reliably fire under `pnpm install --frozen-lockfile` here. If you see `TS7006: Parameter '...' implicitly has an 'any' type` on a callback that looks correct, check that `prisma generate` ran in that job before suspecting the application code.

Both workflows read the web app's Clerk publishable key from repository **variables** (Settings → Secrets and variables → Actions → Variables) rather than secrets, since publishable keys are meant to ship in client bundles — but they read *different* ones, and the two are not interchangeable. CD uses `VITE_CLERK_PUBLISHABLE_KEY`, a production-instance `pk_live_` key, and fails before building if it is unset. CI's `e2e` job uses `VITE_CLERK_PUBLISHABLE_KEY_CI`, which must be a **development**-instance `pk_test_` key: the suite serves the app from `http://localhost:4173`, and Clerk production instances are bound to their own domain over HTTPS, so a `pk_live_` key there leaves ClerkJS unable to load and the smoke test failing as though routing were broken. See [docs/CICD.md](docs/CICD.md) for the full explanation.

Full details, including secret setup and rollback, are in [docs/CICD.md](docs/CICD.md).

## Troubleshooting

**`pnpm dev` starts but the web app can't reach the API.** Confirm the API is listening on 3000 (`curl http://localhost:3000/api/v1/health`) and that `CORS_ORIGIN` in `apps/api/.env` is empty or set to `http://localhost:5173`.

**`Can't reach database server at localhost:5432`.** Either `pnpm db:up` hasn't run, or another Postgres is already bound to 5432 and shadowing the container. Check with `lsof -i :5432`.

**`TS7006: implicitly has an 'any' type` on Prisma results.** The Prisma Client wasn't generated. Run `pnpm --filter @daleelex/api exec prisma generate`.

**`Cannot find module '.prisma/client/default'` after a build.** Same cause in a deployed artifact — `pnpm deploy` builds an independent `node_modules` tree, so the client has to be generated inside it.

**The app throws on boot about a missing Clerk key.** `VITE_CLERK_PUBLISHABLE_KEY` must be present at *build* time for the web app; `CLERK_SECRET_KEY` at *run* time for the API.

**A migration fails on a dirty local database.** `pnpm --filter @daleelex/api exec prisma migrate reset` drops, re-migrates, and re-seeds. Never run reset against anything but a local database.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) — it covers the branching model, commit conventions, the vertical-slice discipline, and what a PR needs to pass review. In short:

1. Branch from `master`.
2. Write a plan before implementing non-trivial changes.
3. Ship in vertical slices — each commit takes one thin capability end to end.
4. Every schema change goes through a Prisma migration, no exceptions.
5. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a PR.

## License

MIT — see [LICENSE](./LICENSE).
