-- Derived invoice coverage; never a payment redirect or paid access grant.
ALTER TABLE team_stripe_snapshots ADD COLUMN IF NOT EXISTS payment_assessment JSONB;
