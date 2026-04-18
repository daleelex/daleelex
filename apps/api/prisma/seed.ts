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
    description: 'Edge proxy routing traffic to internal services. Handles rate limiting and auth verification.',
    type: 'api',
    tier: 1,
    lifecycle: 'production',
    ownerTeamId: 'platform-infra',
    language: 'Go',
    repository: 'platform/api-gateway',
    sloTarget: '99.99%',
    sloWindow: '30d',
    tags: ['critical', 'public'],
    links: [
      { url: 'https://runbook.internal/gateway', title: 'Runbook', type: 'runbook' },
    ],
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
    links: [
      { url: 'https://docs.internal/user-service', title: 'API Docs', type: 'docs' },
    ],
  },
  {
    id: 'svc-notify-004',
    name: 'Notification Service',
    description: 'Email, push, and in-app notification delivery. Supports templates and scheduling.',
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
    links: [
      { url: 'https://runbook.internal/postgres', title: 'Runbook', type: 'runbook' },
    ],
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
    links: [
      { url: 'https://runbook.internal/billing', title: 'Runbook', type: 'runbook' },
    ],
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
    links: [
      { url: 'https://docs.internal/feature-flags', title: 'Docs', type: 'docs' },
    ],
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

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
