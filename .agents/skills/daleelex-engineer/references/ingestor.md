# The ingestor

The ingestor is the component that turns scattered `catalog-info.yaml` files across an organization's GitHub repos into a coherent, queryable catalog in the DaleelEx database. Understanding how it works matters because a lot of the product's "magic" is just the ingestor doing its job correctly and reliably.

## What it does, in order

1. **Discovery** — enumerate repositories in configured organizations. Supports allowlist (only these orgs), denylist (skip these repos), and topic-tag filter (only repos tagged with `daleelex`).
2. **Fetch** — for each repo, fetch `catalog-info.yaml` at HEAD of the default branch. Cache the commit SHA so we can skip unchanged files on the next scan.
3. **Parse** — validate the YAML against the schema. Collect errors but keep going; one broken file shouldn't stop the scan.
4. **Resolve** — normalize references (owners → teams, dependencies → service IDs). Flag unresolved references as warnings, not hard failures.
5. **Diff and apply** — compare parsed entities against what's in the DB. Insert new, update changed, soft-delete missing. Soft-delete because a temporarily-inaccessible repo shouldn't nuke a service's history.
6. **Run scorecards** — for each service, run every registered check. Save results with timestamps.
7. **Emit events** — publish `service.created`, `service.updated`, `scorecard.changed` events. Other subsystems (notifications, webhooks) subscribe as needed.

## Why it's a separate process

The API serves page loads; it needs to be fast and stateless. The ingestor does slow, bursty work — GitHub API calls, YAML parsing across hundreds of repos, scorecard runs that hit external services. Mixing them means page loads block on ingestion, which is unacceptable.

Separate process → separate scaling. The API can run on a tiny instance; the ingestor can run on a beefier one on a cron schedule or a queue.

## Scheduling

Default: the ingestor runs on a cron every hour. Manual triggers are exposed via an admin endpoint (`POST /admin/scan?org=<org>`) for when someone just registered a new service and wants it to show up now.

Webhook-driven incremental scans come later. They're the right long-term answer but a cron is fine for the first 1000 services.

## Rate limiting and resilience

GitHub's rate limit is the most common ingestor failure mode. The ingestor must:

- Use a GitHub App token (higher rate limit than a personal token) in production.
- Respect the `X-RateLimit-Remaining` header and back off before hitting zero.
- Implement exponential backoff with jitter on 5xx responses.
- Persist scan progress so an interrupted scan resumes from where it left off instead of starting over.

None of this is clever; all of it is necessary.

## Error handling philosophy

Three categories of ingestor errors, handled differently:

- **Transient** (timeouts, 5xx, rate limits): retry with backoff, eventually skip this scan cycle, try again next cycle. Don't alert.
- **Per-service** (broken YAML, unresolved owner): surface as a warning on the affected service's detail page, don't block the rest of the scan. Owning team sees the warning and fixes their YAML.
- **Systemic** (can't reach GitHub at all, DB connection dead): fail loudly. This is an ops-page-the-on-call situation.

Separating these is what keeps the ingestor from either being too noisy (waking people up for transient blips) or too quiet (a systemic problem sits for hours because everything looks green).

## Testing strategy

Unit test the parser and the diff logic. Integration test the full pipeline against a recorded fixture of YAML files. Don't mock GitHub in unit tests; use a fixture loader that reads the same YAML shapes the real thing would return. Mocking shapes you made up is cargo-cult testing.

## Observability

The ingestor emits structured logs (JSON, one per event) and Prometheus-style metrics. Key metrics:

- `ingestor_scan_duration_seconds` — how long a full scan takes
- `ingestor_services_total` — how many services are in the catalog
- `ingestor_parse_errors_total` — counter of YAML parse failures, labeled by repo
- `ingestor_github_api_calls_total` — rate-limit visibility

The ingestor's own health is visible in the portal it feeds. Meta, but correct.
