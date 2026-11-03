-- Additive private publication support. NULL means unknown legacy evidence,
-- never an empty/complete equation ledger. No historical reconstruction.
ALTER TABLE team_weekly_publications
    ADD COLUMN IF NOT EXISTS cost_equations JSONB;
