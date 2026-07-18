import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const teams = [
  { id: 'platform-identity', name: 'Platform Identity', slackChannel: '#platform-identity' },
  { id: 'platform-infra', name: 'Platform Infra', slackChannel: '#platform-infra' },
  { id: 'platform-data', name: 'Platform Data', slackChannel: '#platform-data' },
  { id: 'product-core', name: 'Product Core', slackChannel: '#product-core' },
  { id: 'product-growth', name: 'Product Growth', slackChannel: '#product-growth' },
  { id: 'product-ml', name: 'Product ML', slackChannel: '#product-ml' },
];

const services = [
  {
    id: 'svc-auth-001',
    name: 'Authentication Gateway',
    description: 'OAuth2 / OIDC gateway handling SSO, token issuance, and federated identity.',
    type: 'api',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'platform-identity',
    language: 'Go',
    repository: 'platform/auth-gateway',
    sloTarget: '99.95%',
    sloWindow: '30d',
    tags: ['critical', 'security', 'public'],
    links: [
      { url: 'https://runbook.internal/auth', title: 'Runbook', type: 'runbook' },
      { url: 'https://grafana.internal/d/auth', title: 'Dashboard', type: 'dashboard' },
    ],
  },
  {
    id: 'svc-gw-002',
    name: 'API Gateway',
    description:
      'Edge proxy routing traffic to internal services. Handles rate limiting and auth verification.',
    type: 'api',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'platform-infra',
    language: 'Go',
    repository: 'platform/api-gateway',
    sloTarget: '99.99%',
    sloWindow: '30d',
    tags: ['critical', 'public'],
    links: [{ url: 'https://runbook.internal/gateway', title: 'Runbook', type: 'runbook' }],
  },
  {
    id: 'svc-users-003',
    name: 'User Service',
    description: 'User profiles, preferences, and account management.',
    type: 'api',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'product-core',
    language: 'TypeScript',
    repository: 'product/user-service',
    sloTarget: '99.9%',
    sloWindow: '30d',
    tags: ['critical'],
    links: [{ url: 'https://docs.internal/user-service', title: 'API Docs', type: 'docs' }],
  },
  {
    id: 'svc-notify-004',
    name: 'Notification Service',
    description:
      'Email, push, and in-app notification delivery. Supports templates and scheduling.',
    type: 'api',
    tier: 2,
    lifecycle: 'production',
    ownerTeamId: 'product-core',
    language: 'TypeScript',
    repository: 'product/notification-service',
    sloTarget: '99.5%',
    sloWindow: '30d',
    tags: ['transactional'],
    links: [],
  },
  {
    id: 'svc-search-005',
    name: 'Search Service',
    description: 'Full-text and semantic search across platform content using Elasticsearch.',
    type: 'api',
    tier: 2,
    lifecycle: 'production',
    ownerTeamId: 'product-ml',
    language: 'Python',
    repository: 'product/search-service',
    sloTarget: '99.5%',
    sloWindow: '30d',
    tags: ['search', 'ml'],
    links: [],
  },
  {
    id: 'svc-pg-main-006',
    name: 'Primary Database',
    description: 'Main Postgres cluster. Shared by user, notification, and billing services.',
    type: 'db',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'platform-infra',
    language: null,
    repository: 'platform/db-config',
    sloTarget: '99.99%',
    sloWindow: '30d',
    tags: ['critical', 'data'],
    links: [{ url: 'https://runbook.internal/postgres', title: 'Runbook', type: 'runbook' }],
  },
  {
    id: 'svc-billing-007',
    name: 'Billing Service',
    description: 'Subscription management, invoicing, and Stripe integration.',
    type: 'api',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'product-core',
    language: 'TypeScript',
    repository: 'product/billing-service',
    sloTarget: '99.95%',
    sloWindow: '30d',
    tags: ['critical', 'payments', 'pci'],
    links: [{ url: 'https://runbook.internal/billing', title: 'Runbook', type: 'runbook' }],
  },
  {
    id: 'svc-analytics-008',
    name: 'Analytics Pipeline',
    description: 'Event ingestion and aggregation pipeline. Powers the growth dashboard.',
    type: 'api',
    tier: 2,
    lifecycle: 'production',
    ownerTeamId: 'product-growth',
    language: 'Python',
    repository: 'product/analytics-pipeline',
    sloTarget: '99%',
    sloWindow: '30d',
    tags: ['analytics', 'data'],
    links: [],
  },
  {
    id: 'svc-web-009',
    name: 'Web App',
    description: 'Customer-facing React SPA. Deployed to CDN.',
    type: 'web',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'product-core',
    language: 'TypeScript',
    repository: 'product/web',
    sloTarget: '99.9%',
    sloWindow: '30d',
    tags: ['public', 'frontend'],
    links: [],
  },
  {
    id: 'svc-recs-010',
    name: 'Recommendations Engine',
    description: 'ML model serving personalized content recommendations.',
    type: 'ml',
    tier: 2,
    lifecycle: 'beta',
    ownerTeamId: 'product-ml',
    language: 'Python',
    repository: 'product/recs-engine',
    sloTarget: '99%',
    sloWindow: '30d',
    tags: ['ml', 'beta'],
    links: [],
  },
  {
    id: 'svc-admin-011',
    name: 'Admin Portal',
    description: 'Internal ops tooling for support and trust-and-safety teams.',
    type: 'web',
    tier: 3,
    lifecycle: 'production',
    ownerTeamId: 'platform-infra',
    language: 'TypeScript',
    repository: 'platform/admin-portal',
    sloTarget: '99%',
    sloWindow: '30d',
    tags: ['internal'],
    links: [],
  },
  {
    id: 'svc-feature-flags-012',
    name: 'Feature Flag Service',
    description: 'Runtime feature flag evaluation. Used by all product services.',
    type: 'tool',
    tier: 2,
    lifecycle: 'production',
    ownerTeamId: 'platform-infra',
    language: 'Go',
    repository: 'platform/feature-flags',
    sloTarget: '99.9%',
    sloWindow: '30d',
    tags: ['infrastructure', 'release'],
    links: [{ url: 'https://docs.internal/feature-flags', title: 'Docs', type: 'docs' }],
  },
];

const serviceDocs: { serviceId: string; path: string; title: string; contentMd: string }[] = [
  {
    serviceId: 'svc-auth-001',
    path: 'docs/index.md',
    title: 'Overview',
    contentMd: `# Authentication Gateway

The Authentication Gateway is the single entry point for all identity and access management across the platform. It handles OAuth2 authorization code flows, OIDC token issuance, and federated identity via third-party providers (Google, GitHub).

## Responsibilities

- **Token issuance** — issues short-lived access tokens (15 min) and long-lived refresh tokens (7 days)
- **SSO** — brokers login via configured OIDC providers
- **Token validation** — exposes a fast introspection endpoint used by the API Gateway on every request
- **Session management** — tracks active sessions and supports force-logout for security incidents

## Quick start

Point your service at the gateway's introspection endpoint:

\`\`\`
POST /v1/introspect
Authorization: Bearer <token>
\`\`\`

Returns \`{ active: true, sub: "usr-xxx", scope: "..." }\` on success or \`{ active: false }\` on failure.

## SLO

99.95% availability over a 30-day window. Latency p99 < 50ms for introspection calls.
`,
  },
  {
    serviceId: 'svc-auth-001',
    path: 'docs/runbook.md',
    title: 'Runbook',
    contentMd: `# Auth Gateway Runbook

## High error rate on /v1/token

**Symptoms:** Error rate on \`POST /v1/token\` > 1% for > 5 minutes.

**Likely causes:**
1. Upstream DB (Postgres) unreachable — check \`pg-main\` health
2. Redis session store full — check memory usage on \`redis-sessions\`
3. Misconfigured OIDC provider — check provider config in Vault

**Steps:**
1. Check the gateway error logs: \`kubectl logs -l app=auth-gateway --tail=200\`
2. Confirm DB connectivity: \`kubectl exec -it <pod> -- psql $DATABASE_URL -c 'SELECT 1'\`
3. If Redis is the issue, flush expired sessions: \`SCAN + DEL\` with TTL filter (do not \`FLUSHALL\`)

## Token validation latency spike

Introspection p99 > 100ms sustained for > 2 minutes pages on-call.

**Check:** introspection is served from an in-memory cache (5s TTL). A cache miss hits Postgres. If Postgres is slow, every cold introspection is slow.

**Mitigation:** scale the gateway horizontally — each replica has its own warm cache, spreading load.
`,
  },
  {
    serviceId: 'svc-users-003',
    path: 'docs/index.md',
    title: 'Overview',
    contentMd: `# User Service

Manages user profiles, preferences, and account metadata. The source of record for identity data downstream of the Auth Gateway.

## Key concepts

- **User** — an authenticated human. Created on first login via the auth flow.
- **Profile** — display name, avatar, locale, timezone. Mutable by the user.
- **Preferences** — per-feature settings (notification cadence, theme, etc.). Stored as a JSON blob keyed by feature name.

## API surface

All endpoints require a valid Bearer token issued by the Auth Gateway.

| Method | Path | Description |
|--------|------|-------------|
| GET | /v1/users/:id | Fetch a user by ID |
| PATCH | /v1/users/:id | Update profile or preferences |
| DELETE | /v1/users/:id | Soft-delete (GDPR) |
| GET | /v1/users/:id/preferences | Fetch preferences blob |
| PUT | /v1/users/:id/preferences/:feature | Update one feature's prefs |

## Data model

Users are stored in the primary Postgres cluster (\`svc-pg-main-006\`). Preferences are stored as \`jsonb\` to avoid schema churn as features add preference keys.

## SLO

99.9% availability, p99 < 120ms.
`,
  },
  {
    serviceId: 'svc-users-003',
    path: 'docs/gdpr.md',
    title: 'GDPR & Data Deletion',
    contentMd: `# GDPR & Data Deletion

The User Service is the coordinator for right-to-erasure requests.

## Flow

1. Request comes in via \`DELETE /v1/users/:id\` (requires admin scope)
2. User record is **soft-deleted** immediately — \`deleted_at\` set, data intact
3. A \`user.deletion_requested\` event is published to the event bus
4. Downstream services (Notification, Analytics, Billing) consume the event and purge their own user data
5. After a 30-day hold (for legal/billing audit trail), a background job hard-deletes the Postgres row

## What gets deleted

| System | Data | Timeline |
|--------|------|----------|
| User Service DB | Profile, preferences | 30 days after request |
| Notification Service | Delivery history | Within 7 days |
| Analytics Pipeline | Event logs | Within 14 days |
| Billing Service | Invoices | Retained 7 years (legal requirement) |

## Testing deletion

Use the admin fixture account (\`test-deletion-user@internal\`) in staging. Never run deletion flows against production data for testing.
`,
  },
];

async function main() {
  console.log('Seeding teams...');
  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: team,
      create: team,
    });
  }

  console.log('Seeding services...');
  for (const { links, ...service } of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: { ...service, links: { deleteMany: {}, create: links } },
      create: { ...service, links: { create: links } },
    });
  }

  console.log('Seeding service docs...');
  for (const doc of serviceDocs) {
    await prisma.serviceDoc.upsert({
      where: { serviceId_path: { serviceId: doc.serviceId, path: doc.path } },
      update: { title: doc.title, contentMd: doc.contentMd },
      create: doc,
    });
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
