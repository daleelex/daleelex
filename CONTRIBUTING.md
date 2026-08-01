# Contributing to DaleelEx

Thanks for taking the time to contribute. DaleelEx is an internal developer portal and service catalogue: a place engineers go to find every service their company runs, see who owns it, check its health, read its docs, and understand its dependencies.

This document covers how to get set up, how we work, and what a change needs to look like to get merged. If something here is unclear or out of date, that's a bug — open an issue.

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [How we work](#how-we-work)
- [Branching and commits](#branching-and-commits)
- [Coding conventions](#coding-conventions)
- [Database changes](#database-changes)
- [Tests](#tests)
- [Opening a pull request](#opening-a-pull-request)
- [Review expectations](#review-expectations)
- [Reporting bugs](#reporting-bugs)
- [Proposing features](#proposing-features)
- [Security issues](#security-issues)
- [Adding a dependency](#adding-a-dependency)
- [Adding a scorecard check](#adding-a-scorecard-check)
- [Project decisions that are settled](#project-decisions-that-are-settled)

## Code of conduct

Be decent. Assume good faith, critique the code and not the person, and accept that reviewers may disagree with you and still be acting in the project's interest. Harassment, personal attacks, and demeaning behaviour aren't welcome and will get a contributor removed.

## Ways to contribute

You don't have to write code to help:

- **Report a bug** with clear reproduction steps.
- **Improve the docs** — README, `ARCHITECTURE.md`, `docs/CICD.md`, or inline comments that explain a decision.
- **Add test coverage** for behaviour that currently isn't proven.
- **Propose a feature** by opening an issue and describing the problem before the solution.
- **Fix something** — small, well-scoped PRs are the easiest to merge.

## Development setup

Full setup lives in the [README](./README.md#quick-start). The short version:

```bash
corepack enable && pnpm install
```

```bash
pnpm db:up
```

```bash
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env && cp apps/ingestor/.env.example apps/ingestor/.env
```

```bash
pnpm db:migrate && pnpm db:seed && pnpm dev
```

You need Node.js 20+, pnpm 9+, and Docker. Sign-in needs a Clerk account, but browsing the catalogue locally doesn't — you only need Clerk keys to work on authenticated or admin features.

Before you push, the same three commands CI runs:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## How we work

Four habits, in order. They feel slower than diving in; they aren't.

**Plan before you code.** For anything beyond a one-line fix, write down what you're trying to accomplish, the shape of the solution, what's explicitly out of scope, and what could go wrong. For a non-trivial change, put that in the issue or the PR description _before_ you write the code, so a reviewer can redirect you cheaply. Misunderstood intent is the most expensive kind of rework.

**Implement in vertical slices.** Don't build the whole database layer, then the whole API layer, then the whole UI. Take one thin capability all the way through — migration → endpoint → shared type → frontend call → render — and prove it works. The smallest useful slice that runs end to end beats the largest slice that's internally consistent but never exercised.

**Verify before you claim it's done.** If you changed a migration, apply it. If you changed an endpoint, hit it with `curl`. If you changed the UI, load the page. "It should work" isn't a completion signal; "I ran it and saw X" is. If you couldn't verify something — no DB, no browser, no Clerk key — say so in the PR rather than implying you did.

**Push back with reasons.** If a request would make the codebase worse, say so and explain what you'd do instead. Disagree, then commit. Silent compliance with something you think is wrong helps nobody.

## Branching and commits

Branch from `master` (that's the default branch — not `main`). Name branches by intent:

```
feat/service-dependency-graph
fix/techdocs-relative-links
docs/contributing-guide
test/api-admin-authorization
ci/cache-playwright-binary
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.

Types in use here: `feat`, `fix`, `test`, `docs`, `refactor`, `style`, `chore`, `ci`. Scope is the area touched — `api`, `web`, `ingestor`, `db`, `catalog`, `ci`.

```
feat(api): keep log backends behind a stable query contract
fix(web): keep loaded log pages visible when a fetch fails
test(api): prove catalog mutations require admin
fix(db): scope team provenance backfill to pre-column rows
```

Write the subject line about _why the change matters_, not which files moved. Prefer many small commits over one large one — they review, revert, and read better six months out. If the reasoning behind a change isn't obvious from the diff, put it in the commit body, not just the PR description; the commit is what survives.

## Coding conventions

**TypeScript everywhere**, strict. No `any` to silence the compiler — if a type is genuinely unknown, model it as `unknown` and narrow it.

**Respect the layer boundaries.** They're the point of the architecture:

- The web app talks only to the API. It never imports Prisma or reaches the database.
- The API owns all data access. It knows nothing about GitHub.
- The ingestor writes to the database and serves no HTTP.

**Shared types go in `packages/shared`.** Any request or response shape crossing the API/web boundary belongs there, so both ends fail to typecheck together rather than drifting apart quietly.

**One error envelope.** API errors go through `sendApiError` (`apps/api/src/apiError.ts`) and come out as `{ error: { code, message, details } }`. Pick a stable `code` — clients branch on it. Distinguish _the caller did something wrong_ (4xx) from _this server is misconfigured_ (5xx): a missing `CLERK_SECRET_KEY` returns `503 clerk_auth_not_configured`, not a 401 that sends a valid user off to sign in again for no reason.

**Routes are one file per resource** under `apps/api/src/routes/`, registered in `src/index.ts` with the `/api/v1` prefix. Guards go in the route's `preHandler`, not inline in the body.

**Frontend pages are one component plus one CSS file** under `apps/web/src/pages/`. Styling is plain CSS with CSS variables — no utility framework. Server state goes through TanStack Query; don't hand-roll fetch-and-cache.

**Comments explain _why_.** The code already says what it does. A comment earns its place by recording a decision, a constraint, or a trap someone will otherwise re-discover the hard way.

**Formatting is Prettier's job**, and `pnpm format:check` gates it in CI. Run `pnpm format` before pushing rather than arguing with the linter.

## Database changes

**Every schema change goes through a Prisma migration. No exceptions, including in dev.**

1. Edit `apps/api/prisma/schema.prisma`.
2. Run `pnpm db:migrate` and give the migration a descriptive name.
3. Commit the generated migration directory _with_ the schema change, in the same commit.
4. Check that `pnpm db:seed` still works against a fresh database.

Backfills need care about which rows they touch — scope them to the rows that actually predate the change rather than rewriting the whole table. Never point a migration at anything but your local database; production migrations run from CD.

## Tests

| Layer              | Tool                  | Command                           |
| ------------------ | --------------------- | --------------------------------- |
| Unit / integration | Vitest                | `pnpm test`                       |
| Browser e2e        | Playwright (Chromium) | `pnpm --filter @daleelex/web e2e` |

API route tests currently mock `./db.js` and `@clerk/backend`, so `pnpm test` runs without Postgres. The only coverage that touches a real database and real migrations is the Playwright e2e job, which seeds a live Postgres and boots the actual API. Keep that in mind when a change is mostly about a query or a migration: a passing unit suite says nothing about it, so exercise it locally against `pnpm db:up` and say in the PR what you saw.

Write tests that prove real behaviour, not mocked-up contract theater. A test that asserts a non-admin gets `403` from `POST /services` is worth more than a hundred lines asserting that a mock was called. Name the file after what it proves (`catalogAdminAuthorization.test.ts`), so a failure reads as a sentence about what broke.

Any bug fix should come with a test that fails before the fix and passes after it.

## Opening a pull request

Before you open it:

- [ ] `pnpm lint` passes
- [ ] `pnpm format:check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Schema changes include their migration
- [ ] New behaviour has a test
- [ ] Docs updated if you changed setup, env vars, or the API surface

In the description, cover:

1. **What problem this solves** — link the issue if there is one.
2. **The approach**, and any alternative you rejected and why.
3. **How you verified it** — the command you ran, the response you saw, the page you loaded.
4. **Anything you didn't do** and deliberately left out of scope.

Screenshots for UI changes. Keep PRs focused: one concern per PR. A drive-by refactor bundled into a bug fix makes both harder to review and impossible to revert cleanly — send it separately.

## Review expectations

CI runs `lint`, `typecheck`, `test`, and `e2e` on every PR as independent jobs. All four need to be green.

Reviewers look for: correct layer boundaries, a migration for every schema change, real test coverage of the new behaviour, error codes that clients can rely on, and comments that explain decisions rather than restate the code. Expect questions about _why_ as often as _what_ — being asked to justify an approach is normal, not an accusation.

If a review comment is wrong, say so with your reasoning. If it's right, fix it and push a follow-up commit rather than force-pushing over the history mid-review, so the reviewer can see what changed.

## Reporting bugs

Open an issue with:

- What you expected, and what happened instead
- Exact reproduction steps
- Which app (`api`, `web`, `ingestor`) and which branch or commit
- Relevant logs or the full error, as text rather than a screenshot
- Environment: OS, Node version, whether Postgres is the Docker one or a host install

A local Postgres already bound to port 5432 shadowing the Docker container is a common source of confusing failures — worth ruling out first.

## Proposing features

Open an issue describing the **problem** before the solution: who hits it, how often, and what they do today instead. Features that make one team's page better at the cost of everyone else's are usually the wrong trade for a catalogue. Wait for a maintainer to agree on the shape before writing a large PR — it's much cheaper to redirect a paragraph than a thousand lines.

## Security issues

Don't open a public issue for a vulnerability. Report it privately to the maintainers so a fix can ship before the details are public. Never include real tokens, keys, or production connection strings in an issue, a PR, or a test fixture.

## Adding a dependency

New dependencies need a one-line justification in the PR: what does it do that we can't reasonably do ourselves in a weekend, and what's its maintenance footprint? Small, focused, well-typed libraries are usually fine. Frameworks that want to take over a layer usually aren't.

## Adding a scorecard check

Checks are the main extension point and are deliberately cheap to add. One file under `apps/ingestor/src/checks/` implementing the `Check` interface, plus one registry entry — no engine changes:

```typescript
export interface Check {
  id: string; // e.g. 'readme-present'
  label: string; // human-readable
  category: 'basics' | 'observability' | 'security' | 'reliability';
  weight: number; // relative importance, 1-10
  run(ctx: CheckContext): Promise<CheckResult>;
}

export interface CheckResult {
  status: 'pass' | 'fail' | 'skip';
  message: string; // shown in the UI
  evidence?: Record<string, unknown>; // links, counts, whatever
}
```

`message` is read by the team that owns the failing service, so make it actionable: say what's missing and where to add it.

## Project decisions that are settled

These are decided. They can change, but a PR isn't the place to reopen them — start a discussion issue instead, with what's materially changed since the decision was made.

- **Fastify**, not Express — schema-driven validation and built-in types remove a class of bugs.
- **PostgreSQL everywhere**, no SQLite. Environment parity matters more than local convenience.
- **Prisma**, schema-first, with migrations for every change.
- **React + Vite**, no SSR. DaleelEx is an internal app, not a public website.
- **Plain CSS with variables**, no utility framework.
- **Clerk** for auth.
- **pnpm workspaces**.
- **Vitest + Playwright** for tests.

The reasoning behind each lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

By contributing, you agree that your contributions are licensed under the same license as this project.
