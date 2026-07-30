ALTER TABLE "teams"
ADD COLUMN "management_source" TEXT NOT NULL DEFAULT 'portal';

ALTER TABLE "services"
ADD COLUMN "management_source" TEXT NOT NULL DEFAULT 'portal';

ALTER TABLE "teams"
ADD CONSTRAINT "teams_management_source_check"
CHECK ("management_source" IN ('portal', 'repository'));

ALTER TABLE "services"
ADD CONSTRAINT "services_management_source_check"
CHECK ("management_source" IN ('portal', 'repository'));
