BEGIN;
-- Hashes of canonical fact identities only; retained with the publication barrier.
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS fact_membership TEXT[];
COMMIT;
