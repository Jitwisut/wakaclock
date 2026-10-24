-- Empty, additive scaffolding. Never initialize a head from restored SQL rows.
-- Source writes/seed approval and account ingress proof are separate runtime gates.
CREATE TABLE IF NOT EXISTS team_financial_source_heads (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  schema_version SMALLINT NOT NULL CHECK(schema_version=1),
  revision BIGINT NOT NULL CHECK(revision>0),
  record_count BIGINT NOT NULL CHECK(record_count>=0),
  root_hash TEXT NOT NULL CHECK(root_hash ~ '^[0-9a-f]{64}$'),
  transition_id UUID,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(organization_id,account_id,livemode)
);
-- No cascading FK: deletion evidence must survive removal of the live scope.
-- No automatic cleanup/backfill or administrative approval is supplied here.
CREATE TABLE IF NOT EXISTS team_financial_source_tombstones (
  organization_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  record_kind TEXT NOT NULL CHECK(record_kind IN
    ('customer','customer_authorization','quote','checkout','checkout_authorization',
     'binding','snapshot','inbox','reconciliation')),
  record_key_hash TEXT NOT NULL CHECK(record_key_hash ~ '^[0-9a-f]{64}$'),
  prior_record_hash TEXT NOT NULL CHECK(prior_record_hash ~ '^[0-9a-f]{64}$'),
  customer_id TEXT,
  subscription_id TEXT,
  reason TEXT NOT NULL CHECK(reason IN ('retention','organization_deleted','approved_recovery')),
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(organization_id,account_id,livemode,record_kind,record_key_hash)
);
CREATE INDEX IF NOT EXISTS team_financial_tombstone_customer
  ON team_financial_source_tombstones(account_id,livemode,customer_id,organization_id);
CREATE INDEX IF NOT EXISTS team_financial_tombstone_subscription
  ON team_financial_source_tombstones(account_id,livemode,subscription_id,organization_id);
CREATE INDEX IF NOT EXISTS team_stripe_inbox_customer_scope
  ON team_stripe_inbox(account_id,livemode,customer_id,event_id);
CREATE INDEX IF NOT EXISTS team_stripe_inbox_subscription_scope
  ON team_stripe_inbox(account_id,livemode,subscription_id,event_id);
CREATE INDEX IF NOT EXISTS team_stripe_quotes_customer_scope
  ON team_stripe_quotes(account_id,livemode,customer_id,organization_id);
