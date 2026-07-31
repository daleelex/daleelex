-- The prior 20260730233000 migration defaulted existing team rows to "portal" in error.
-- Only rows created before that migration ran could have received the erroneous default,
-- and at that point the portal had no team-creation path (POST /teams shipped later), so
-- every such row is a repository/seed team. Teams created after the column exists carry an
-- explicit value chosen by their writer ('portal' from POST /teams, 'repository' from the
-- seed) and must not be touched — flipping a portal team to 'repository' permanently locks
-- it out of editing, and nothing ever writes it back.
-- The cutoff is 20260730233000's nominal UTC timestamp; created_at is stored in UTC.
UPDATE "teams"
SET "management_source" = 'repository'
WHERE "created_at" < TIMESTAMP '2026-07-30 23:30:00';

-- Drop the default so every future writer must choose the management source explicitly.
ALTER TABLE "teams"
ALTER COLUMN "management_source" DROP DEFAULT;
