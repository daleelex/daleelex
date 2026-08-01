-- The built-in sample catalog is created by the DaleelEx seed script, not ingested from
-- catalog-info.yaml. These rows were incorrectly marked as repository-managed, which hid
-- the portal edit actions and caused the API to reject updates. Reclassify only the fixed
-- sample IDs; genuinely ingested entities keep repository provenance.
UPDATE "teams"
SET "management_source" = 'portal'
WHERE "management_source" = 'repository'
  AND "id" IN (
    'platform-identity',
    'platform-infra',
    'platform-data',
    'product-core',
    'product-growth',
    'product-ml'
  );

UPDATE "services"
SET "management_source" = 'portal'
WHERE "management_source" = 'repository'
  AND "id" IN (
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
    'svc-feature-flags-012'
  );
