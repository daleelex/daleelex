# Getting started — day one

This is the "I just opened Claude Code in an empty repo" guide. Follow it in order. Don't skip steps; each one earns its place.

## 1. Initialize the repo

```bash
git init
pnpm init                         # creates root package.json
echo "node_modules" > .gitignore
echo ".env" >> .gitignore
echo "dist" >> .gitignore
```

Set `package.json` to have:

```json
{
  "name": "daleelex",
  "private": true,
  "packageManager": "pnpm@9.0.0"
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## 2. Write the non-code docs first

These exist before any code does. They're short and they define the project:

- **README.md** — what DaleelEx is, how to run it locally (the commands you'll define in step 6), how to contribute.
- **ARCHITECTURE.md** — the four-layer model (source of truth → ingestor → DB → API → web), why each layer is separate, the stack with rationale, the catalog-info.yaml schema.
- **CLAUDE.md** — notes for Claude Code specifically: "this is a monorepo with pnpm workspaces; always run commands from the relevant app directory; always write migrations, never edit the DB directly; etc."

The skill you're reading now is the authoritative source for most of this; the repo docs can link to it or summarize it.

## 3. Scaffold the three apps

```bash
mkdir -p apps/api apps/web apps/ingestor packages/shared
```

Each `apps/*/package.json` gets a name like `@daleelex/api` and its own dependencies. `packages/shared` is published as `@daleelex/shared` and imported via workspace protocol (`"@daleelex/shared": "workspace:*"`).

### apps/api

Fastify + Prisma + TypeScript. Starts with a single `/api/v1/health` endpoint. That's it. Ship the shell before you ship features.

### apps/web

`pnpm create vite web -- --template react-ts` then clean up. Delete the default App content and replace it with the sidebar shell from the POC (you've already designed this; port it in as the layout component).

### apps/ingestor

Just a TypeScript project with a `src/index.ts` that logs "ingestor booted" and exits. Same principle — ship the shell first.

### packages/shared

Export an initial `Service` type that matches the catalog-info schema. Both apps/api and apps/web will import this.

## 4. Docker Compose for local dependencies

`docker-compose.yml` at the root with one service: Postgres 16. That's all you need for local dev. Add Redis later if and when we need it for queues.

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: daleelex
      POSTGRES_PASSWORD: daleelex
      POSTGRES_DB: daleelex
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  pg_data:
```

`docker compose up -d` and you have a database.

## 5. Prisma schema v1

In `apps/api`, run `pnpm prisma init`. Define the core tables from the schema reference — `services`, `teams`, `service_dependencies`, minimum. Run the first migration:

```bash
pnpm prisma migrate dev --name init
```

Seed data goes in `apps/api/prisma/seed.ts`. Copy the 12 services from the POC as seed rows so the UI has something to show immediately. `pnpm prisma db seed` runs it.

## 6. Root-level scripts

Root `package.json` gets scripts that orchestrate the whole monorepo:

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "db:up": "docker compose up -d postgres",
    "db:migrate": "pnpm --filter @daleelex/api prisma migrate dev",
    "db:seed": "pnpm --filter @daleelex/api prisma db seed"
  }
}
```

`pnpm dev` starts api, web, and ingestor in parallel. That's the one command a new contributor learns.

## 7. First end-to-end slice

Now you're ready for feature work. First slice: **list services**.

1. API: implement `GET /api/v1/services` in Fastify. Query the seeded `services` table via Prisma. Return the shape defined in `packages/shared`.
2. Web: add a route that calls `listServices()` via React Query, renders each one as the `ServiceCard` component ported from the POC. Apply the search filter (frontend-only for now; it's fine at 12 services).
3. Verify: `pnpm dev`, open `http://localhost:5173`, see the cards rendered with real data from Postgres.
4. Commit: one commit for the API handler, one for the frontend page, one for the wiring.

That slice is small but it exercises every layer. Every future feature follows the same shape.

## 8. What not to do yet

Things that feel urgent but aren't:

- **Authentication** — use a stub "is logged in" context for now. Real Clerk integration is a single focused task later, not something to thread through while you're building features.
- **Deployment** — nothing is deployed until the app does something. Local-first.
- **CI/CD** — set it up after the first real merge, not before. An empty CI pipeline is worse than no pipeline.
- **Observability stack** — structured logs from day one, yes. Prometheus metrics, dashboards, alerting — later, when there's something to observe.
- **A plugin architecture for everything** — the scorecard engine has a plugin pattern because we genuinely need it. The API doesn't. The frontend doesn't. Don't build a plugin system for a system with no plugins.

## 9. The first day's definition of done

By end of day one you should have:

- Repo initialized, monorepo structure in place
- Three app shells + shared package, all booting
- Postgres running locally via Docker Compose
- Prisma schema v1 applied, seed data loaded
- `GET /api/v1/services` returning real data
- Web route rendering those services as cards
- Running `pnpm dev` brings the whole thing up

That's a real foundation. Everything else is features on top of it.
