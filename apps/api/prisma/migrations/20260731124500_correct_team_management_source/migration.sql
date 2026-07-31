-- The prior 20260730233000 migration defaulted existing team rows to "portal" in error.
-- Backfill them to "repository" before removing the default so every future writer
-- must choose the management source explicitly.
UPDATE "teams"
SET "management_source" = 'repository';

ALTER TABLE "teams"
ALTER COLUMN "management_source" DROP DEFAULT;
