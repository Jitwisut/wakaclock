-- Only normalized financial metadata; null means no invoice observation, never paid.
ALTER TABLE team_stripe_snapshots ADD COLUMN IF NOT EXISTS invoice_observation JSONB;
ALTER TABLE team_stripe_snapshots ADD COLUMN IF NOT EXISTS subscription_item_id TEXT;
