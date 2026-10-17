-- Server-created customer provenance, separate from subscription/paid entitlements.
CREATE TABLE IF NOT EXISTS team_stripe_customer_operations (
  operation_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'pending' CHECK(disposition IN ('pending','verified','owner_changed','recovery_required')),
  customer_id TEXT,
  first_attempt_at TIMESTAMPTZ,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_at TIMESTAMPTZ,
  UNIQUE(organization_id,account_id,livemode),
  UNIQUE(account_id,livemode,customer_id)
);
CREATE INDEX IF NOT EXISTS team_stripe_customer_due ON team_stripe_customer_operations(account_id,livemode,retry_at) WHERE disposition='pending';
