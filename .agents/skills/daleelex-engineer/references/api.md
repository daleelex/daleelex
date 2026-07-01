# API contract

Fastify, TypeScript, JSON over HTTPS. The API serves three kinds of callers: the web frontend (most traffic), internal scripts and automation (some), and eventually third-party integrations (later). The contract should be stable enough that breaking it requires thought.

## Conventions

- **Base path**: `/api/v1`. The v1 is load-bearing; when we change contracts incompatibly, we bump to `/api/v2` and run both for a window.
- **Auth**: Every endpoint under `/api/v1` requires authentication (Clerk JWT in the `Authorization: Bearer <token>` header) except the explicitly-listed public ones below.
- **Content type**: `application/json` in and out. No form posts, no multipart unless we're handling file uploads.
- **Errors**: Use HTTP status codes correctly. 400 for client errors, 401 for unauthenticated, 403 for unauthorized, 404 for not found, 409 for conflicts, 422 for validation failures, 5xx for server errors. The body follows the shape below.
- **Pagination**: Cursor-based, not offset. `?cursor=<opaque>&limit=50`. Response includes `next_cursor` or null. Offset pagination is wrong for this kind of catalog — if a service is added mid-scroll, offset produces duplicates or skips.
- **Time**: ISO 8601 strings in UTC, always. `2026-04-18T14:23:11Z`. No Unix timestamps in the wire format; they're ambiguous and unreadable.

## Error shape

Every error response has this body:

```json
{
  "error": {
    "code": "service_not_found",
    "message": "Human-readable explanation of what happened.",
    "details": {}
  },
  "request_id": "req_01HQ3..."
}
```

The `code` is a stable identifier the frontend switches on. The `message` is for humans. The `request_id` matches the `x-request-id` response header so the user can paste it into a bug report and we can find the log line.

## Endpoints

Grouped by resource. Only the shape is here; exact field names match the Prisma schema.

### Services

```
GET    /api/v1/services                   List with filters
GET    /api/v1/services/:id               Single service detail
POST   /api/v1/services                   Create (admin only)
PATCH  /api/v1/services/:id               Update (admin only)
DELETE /api/v1/services/:id               Soft-delete (admin only)

GET    /api/v1/services/:id/scorecard     Latest scorecard results
GET    /api/v1/services/:id/dependencies  Both directions — what it depends on, what depends on it
```

Filter params on the list endpoint: `?tier=1&type=api&owner=platform-identity&lifecycle=production&tag=critical&q=<search>`. Multiple values per param are AND'd across params, OR'd within. `q` is fulltext across name, description, id.

### Teams

```
GET    /api/v1/teams                       List
GET    /api/v1/teams/:id                   Detail + member services
```

### Scorecards

```
GET    /api/v1/scorecards/checks           List all registered checks
GET    /api/v1/scorecards/summary          Aggregate pass rate across the catalog
```

### Admin

```
POST   /api/v1/admin/ingest                Trigger an ingestor scan (admin only)
GET    /api/v1/admin/ingest/runs           History of scan runs
```

### Public (no auth)

```
GET    /api/v1/health                      Liveness (just returns 200)
GET    /api/v1/health/ready                Readiness (checks DB, returns 200 or 503)
```

## Validation

Every request body and query string is validated via Fastify's JSON schema support. Invalid requests get a 422 with a `details` payload showing which fields failed. This catches most client errors at the door and saves the rest of the handler from defensive coding.

## Rate limiting

Per-user limits, not per-IP — behind SSO we always know who's calling. Sensible defaults: 1000 requests/minute on reads, 100/minute on writes, 10/minute on admin endpoints. Exceed → 429 with a `Retry-After` header.

## Caching

Read endpoints can return `Cache-Control: private, max-age=30`. A 30-second client cache is plenty for a catalog that changes on an hourly ingestor cycle; it keeps interactive UIs snappy without serving stale data. Don't cache write responses.

## Observability

Every request gets a request ID (either from the caller's `x-request-id` header or a newly generated one). Every log line, metric label, and error response includes it. This is how a user's "something broke" becomes a debuggable incident instead of a paragraph of guessing.

Export metrics for: request count by route and status, p50/p95/p99 latency by route, error rate by route. Prometheus format, scraped by whatever we're running for dashboards.

## Versioning principle

Don't break contracts. If a field's meaning changes, add a new field and deprecate the old one with a sunset header. If an endpoint's semantics change, add a new endpoint. Only bump the major version (`/v2`) for changes that genuinely can't be done compatibly. Every broken contract is a week of chased-down integrations.
