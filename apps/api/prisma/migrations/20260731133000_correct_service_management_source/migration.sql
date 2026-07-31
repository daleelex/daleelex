-- The 20260730233000 migration gave "services"."management_source" a DEFAULT of 'portal', which
-- lets a writer omit the column and silently claim portal provenance. Drop the default so every
-- writer chooses explicitly, matching the teams correction in 20260731124500.
--
-- Unlike teams, existing rows are deliberately NOT backfilled. Services have had a portal creation
-- path (POST /services) since before this column existed, and the ingestor has never written a
-- service row, so 'portal' is the correct value for every row that exists today. Flipping them to
-- 'repository' would lock genuinely portal-created services out of edit and delete with no way
-- back. Repository provenance starts being recorded when the ingestor learns to write services.
ALTER TABLE "services"
ALTER COLUMN "management_source" DROP DEFAULT;
