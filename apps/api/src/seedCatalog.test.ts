import { describe, expect, it } from 'vitest';
import { services, teams } from '../prisma/seed.js';

const SAMPLE_TEAM_IDS = [
  'platform-identity',
  'platform-infra',
  'platform-data',
  'product-core',
  'product-growth',
  'product-ml',
];

const SAMPLE_SERVICE_IDS = [
  'svc-auth-001',
  'svc-gw-002',
  'svc-users-003',
  'svc-notify-004',
  'svc-search-005',
  'svc-pg-main-006',
  'svc-billing-007',
  'svc-analytics-008',
  'svc-web-009',
  'svc-recs-010',
  'svc-admin-011',
  'svc-feature-flags-012',
];

describe('sample catalog provenance', () => {
  it('keeps every seeded team portal-managed and editable', () => {
    expect(teams.map(({ id }) => id)).toEqual(SAMPLE_TEAM_IDS);
    expect(teams.map(({ managementSource }) => managementSource)).toEqual(
      SAMPLE_TEAM_IDS.map(() => 'portal'),
    );
  });

  it('keeps every seeded service portal-managed and editable', () => {
    expect(services.map(({ id }) => id)).toEqual(SAMPLE_SERVICE_IDS);
    expect(services.map(({ managementSource }) => managementSource)).toEqual(
      SAMPLE_SERVICE_IDS.map(() => 'portal'),
    );
  });
});
