# DaleelEx

Internal developer portal and service catalogue.

## Critical context

Read `.agents/skills/daleelex-engineer/SKILL.md` at the start of every session. It defines:
- The stack (locked in — don't relitigate)
- The workflow discipline (plan → slice → verify → commit)
- The repo layout, schema, and conventions

Also read the references in `.agents/skills/daleelex-engineer/references/` when relevant:
- `schema.md` — database schema
- `api.md` — API contract
- `ingestor.md` — the repo-scanning worker
- `frontend.md` — React app conventions
- `getting-started.md` — the original day-one scaffolding plan. Historical: the scaffolding
  it describes is done. Useful for the reasoning behind the layout, not as instructions.

## Status

Building on an established codebase — `apps/api`, `apps/web`, `apps/ingestor`, and
`packages/shared` all exist and run. See [README.md](./README.md) for local setup and
[ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces fit together.
