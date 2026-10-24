-- Accepted purchase intent is separate from provider session, payment and entitlement.
CREATE TABLE IF NOT EXISTS team_stripe_checkout_intents (
  operation_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  quote_id UUID NOT NULL UNIQUE REFERENCES team_stripe_quotes(id),
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'pending' CHECK(disposition IN
    ('pending','session_open','awaiting_verification','expired','owner_changed','recovery_required','bound')),
  revision BIGINT NOT NULL DEFAULT 1,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_attempt_at TIMESTAMPTZ,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  session_id TEXT,
  session_expires_at TIMESTAMPTZ,
  subscription_id TEXT,
  observed_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  UNIQUE(account_id,livemode,session_id)
);
-- Ambiguous/owner-changed operations still reserve the organization. Only provider-
-- verified expiration may release it; cancel/back buttons cannot expire a payment.
CREATE UNIQUE INDEX IF NOT EXISTS team_stripe_checkout_one_open
  ON team_stripe_checkout_intents(organization_id) WHERE disposition<>'expired';
CREATE INDEX IF NOT EXISTS team_stripe_checkout_due
  ON team_stripe_checkout_intents(account_id,livemode,retry_at,lease_until);
