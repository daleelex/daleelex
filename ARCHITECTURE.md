# Architecture

## System model

DaleelEx has four separable concerns, each in its own layer:

```
GitHub repos (catalog-info.yaml)
        ↓
    Ingestor (apps/ingestor)
    Scans repos, parses YAML, runs scorecards, writes to DB
        ↓
    Database (Postgres)
    Single source of truth for the portal's data
        ↓
    API (apps/api)
    Fastify REST service; all data access goes through here
        ↓
    Web (apps/web)
    React SPA; reads only from the API, never from the DB directly
```

Each boundary is a hard contract. The web app doesn't import Prisma. The API doesn't know about GitHub. The ingestor doesn't serve HTTP. Keeping these concerns separate is what makes the system testable, deployable independently, and understandable by a new engineer.

## Stack decisions

These are decided. Don't relitigate them in PRs unless something material has changed.

**Backend:** Node.js + TypeScript + Fastify. Schema-driven validation and built-in TypeScript types remove a whole category of bugs that Express leaves to the developer.

**Database:** PostgreSQL in all environments. Docker Compose for local dev. SQLite is not used anywhere — environment parity matters.

**ORM:** Prisma. Schema-first, typed, mature migration story.

**Frontend:** React + Vite + TypeScript. No SSR — DaleelEx is an internal app, not a public website.

**Styling:** Plain CSS with CSS variables. No utility framework.

**Auth:** Clerk for MVP. Solves SSO + user management + org support without a week of plumbing.

**Package manager:** pnpm with workspaces.

**Deployment:** Docker containers. Single VM or Railway/Fly.io to start.

**Testing:** Vitest (unit), Playwright (e2e frontend).

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

Service IDs are immutable. Names can change. Dependencies reference IDs, not names. Unknown fields produce a soft warning, not a hard error — one team's experiment shouldn't break everyone else's page.

## Scorecard model

Scorecards tell a team whether their service meets the bar for production. Each check implements:

```typescript
interface Check {
  id: string;
  label: string;
  category: 'basics' | 'observability' | 'security' | 'reliability';
  weight: number;  // 1-10
  run(ctx: CheckContext): Promise<CheckResult>;
}
```

Each check lives in its own file under `apps/ingestor/src/checks/`. Adding a check is one file plus one registry entry — no engine changes.

Default checks (in priority order): README present, Owner assigned, Repository accessible, SLO defined, Runbook linked, Vulnerability scan clean.

## Database schema summary

Core tables: `services`, `teams`, `service_dependencies`, `scorecard_checks`, `scorecard_results`, `users`, `links`. Full schema in `apps/api/prisma/schema.prisma`. Every change goes through a Prisma migration — no exceptions, including in dev.

## Repo layout

```
daleelex/
├── apps/
│   ├── api/          Fastify backend
│   ├── web/          React frontend
│   └── ingestor/     Background worker
├── packages/
│   └── shared/       Shared TypeScript types
├── docker-compose.yml
├── pnpm-workspace.yaml
├── ARCHITECTURE.md   ← you are here
├── CLAUDE.md
└── README.md
```
