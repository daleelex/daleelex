# DaleelEx

Internal developer portal and service catalogue. Engineers use it to find every service the company runs, see who owns it, check its health score, read its docs, and understand its dependencies.

## Architecture

Four layers: **source of truth** (catalog-info.yaml files in service repos) → **ingestor** (background worker that scans repos) → **database** (Postgres) → **API** (Fastify) → **web** (React). See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local Postgres)

## Running locally

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres
pnpm db:up

# 3. Apply migrations and seed data
pnpm db:migrate
pnpm db:seed

# 4. Start everything
pnpm dev
```

The web app runs at http://localhost:5173, the API at http://localhost:3000.

## Workspace structure

```
apps/api/        Fastify backend
apps/web/        React frontend
apps/ingestor/   Background repo-scanning worker
packages/shared/ TypeScript types shared across apps
```

## Common tasks

| Task | Command |
|------|---------|
| Start all apps | `pnpm dev` |
| Run all tests | `pnpm test` |
| Lint everything | `pnpm lint` |
| Start Postgres | `pnpm db:up` |
| New DB migration | `pnpm db:migrate` |
| Seed the database | `pnpm db:seed` |

## Contributing

1. Branch from `main`.
2. Write a plan before implementing non-trivial changes.
3. Ship in vertical slices — each commit touches one layer end-to-end.
4. Every schema change goes through a Prisma migration, no exceptions.
5. Run `pnpm lint` and `pnpm test` before opening a PR.
