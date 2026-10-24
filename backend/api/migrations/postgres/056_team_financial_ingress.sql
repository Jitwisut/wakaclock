-- Account-level signed-notification evidence. No automatic baseline/backfill.
ALTER TABLE team_stripe_inbox ADD COLUMN IF NOT EXISTS ingress_metadata JSONB;
ALTER TABLE team_stripe_inbox ADD COLUMN IF NOT EXISTS ingress_transition UUID;
CREATE TABLE IF NOT EXISTS team_stripe_ingress_heads (
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  schema_version SMALLINT NOT NULL CHECK(schema_version=1),
  revision BIGINT NOT NULL CHECK(revision>0),
  record_count BIGINT NOT NULL CHECK(record_count>=0),
  root_hash TEXT NOT NULL CHECK(root_hash ~ '^[0-9a-f]{64}$'),
  transition_id UUID,
  PRIMARY KEY(account_id,livemode)
);
