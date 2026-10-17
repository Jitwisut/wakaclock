-- Financial metadata is separate from personal telemetry and estimated AI cost.
-- Bindings are populated only after a verified server-side customer/subscription flow.
CREATE TABLE IF NOT EXISTS team_stripe_bindings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  revision BIGINT NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id,livemode,customer_id),
  UNIQUE(account_id,livemode,subscription_id)
);
CREATE TABLE IF NOT EXISTS team_stripe_inbox (
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  event_created TIMESTAMPTZ NOT NULL,
  customer_id TEXT,
  subscription_id TEXT,
  invoice_id TEXT,
  requested_revision BIGINT,
  disposition TEXT NOT NULL CHECK(disposition IN ('pending','processed','ignored')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY(account_id,livemode,event_id)
);
CREATE TABLE IF NOT EXISTS team_stripe_reconcile_jobs (
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  subscription_id TEXT NOT NULL,
  requested_revision BIGINT NOT NULL DEFAULT 1,
  applied_revision BIGINT NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  last_success_at TIMESTAMPTZ,
  PRIMARY KEY(account_id,livemode,subscription_id)
);
CREATE TABLE IF NOT EXISTS team_stripe_snapshots (
  organization_id UUID PRIMARY KEY REFERENCES team_stripe_bindings(organization_id) ON DELETE CASCADE,
  binding_revision BIGINT NOT NULL,
  source_revision BIGINT NOT NULL,
  provider_status TEXT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL,
  latest_invoice_id TEXT,
  first_payment_failure_at TIMESTAMPTZ,
  price_id TEXT,
  currency TEXT,
  amount_minor BIGINT,
  quantity BIGINT,
  items_complete BOOLEAN NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS team_stripe_due_jobs ON team_stripe_reconcile_jobs(retry_at,lease_until);
