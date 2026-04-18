# Database schema

PostgreSQL. Prisma schema as the source of truth. What follows is the conceptual model; the exact Prisma file in the repo is what's authoritative for code.

## Core tables

### services

The central entity. One row per registered service.

```
id                text PRIMARY KEY              -- the stable ID from catalog-info.yaml
name              text NOT NULL
description       text
type              text NOT NULL                 -- api | db | web | ml | tool
tier              int  NOT NULL                 -- 1 | 2 | 3
lifecycle         text NOT NULL                 -- production | beta | deprecated
owner_team_id     text REFERENCES teams(id)
language          text
repository        text                          -- org/repo
slo_target        text                          -- e.g. "99.95%"
slo_window        text                          -- e.g. "30d"
tags              text[]
source_sha        text                          -- last-seen commit SHA of catalog-info.yaml
created_at        timestamptz NOT NULL
updated_at        timestamptz NOT NULL
deleted_at        timestamptz                   -- soft delete
```

Indexes on `(deleted_at, tier)`, `(deleted_at, owner_team_id)`, and `(deleted_at, type)` — these cover the common filter patterns from the catalog view. A trigram index on `name` for search.

### teams

Who owns what.

```
id                text PRIMARY KEY              -- e.g. "platform-identity"
name              text NOT NULL                 -- human name
slack_channel     text
on_call_schedule  text                          -- PagerDuty schedule ID or similar
created_at        timestamptz NOT NULL
updated_at        timestamptz NOT NULL
```

Teams are typically themselves defined in a `catalog-info.yaml` file — same ingestor picks them up, different `kind: Team` entries.

### service_dependencies

Join table for the service dependency graph.

```
service_id        text REFERENCES services(id)
depends_on_id     text REFERENCES services(id)
PRIMARY KEY (service_id, depends_on_id)
```

Kept as a separate table (rather than an array column) because we'll query it both directions — "what does X depend on" and "what depends on X." Array columns can't index the reverse lookup cleanly.

### scorecard_checks

The definition of each check. Synced from code to DB on deploy.

```
id                text PRIMARY KEY              -- e.g. "readme-present"
label             text NOT NULL
category          text NOT NULL                 -- basics | observability | security | reliability
weight            int  NOT NULL                 -- 1-10
enabled           boolean NOT NULL DEFAULT true
```

### scorecard_results

One row per (service, check, run). This table grows. Partition by month if it becomes a problem; don't pre-partition.

```
id                bigserial PRIMARY KEY
service_id        text REFERENCES services(id)
check_id          text REFERENCES scorecard_checks(id)
status            text NOT NULL                 -- pass | fail | skip
message           text
evidence          jsonb
ran_at            timestamptz NOT NULL
```

Index on `(service_id, check_id, ran_at DESC)` — this covers "what's the latest result for check X on service Y." Most queries want just the latest, so consider a materialized `scorecard_latest` view if performance demands it.

### users

Who's logged in.

```
id                text PRIMARY KEY              -- Clerk user ID
email             text UNIQUE NOT NULL
name              text
avatar_url        text
last_seen_at      timestamptz
created_at        timestamptz NOT NULL
```

Keep this thin. Real user state (preferences, roles) lives in Clerk until we outgrow it.

### links

Optional links attached to services (runbooks, dashboards, etc.). Could be a JSONB column on `services` instead; splitting it out lets us query "show me every runbook in the org" which turns out to be a useful admin view.

```
id                bigserial PRIMARY KEY
service_id        text REFERENCES services(id)
url               text NOT NULL
title             text
type              text                          -- runbook | dashboard | docs | other
```

## Migrations

Every schema change goes through a Prisma migration. No exceptions, including in dev. Migrations are how we keep environments in sync and how we get an audit trail of what changed when.

Migration naming: `YYYYMMDD_HHMMSS_short_description` (Prisma generates this automatically).

Migrations are forward-only in production. If we need to "revert," we write a new migration that reverts the change. Running `prisma migrate reset` is a dev-only, nuclear option.

## What not to do

- Don't use `ENUM` types in Postgres — they're annoying to modify. Use `text` + a check constraint or a lookup table.
- Don't use `uuid` for service IDs — the IDs come from humans writing YAML; they're chosen to be memorable. `text` with a sane pattern (`svc-<slug>-<n>`) is fine.
- Don't `ON DELETE CASCADE` freely. Soft-delete instead so we can recover from mistakes and preserve audit trails.
- Don't pre-optimize with complex indexes. Add them when queries are slow, not before.
- Don't denormalize for convenience. Denormalize for measured performance problems, and document why.
