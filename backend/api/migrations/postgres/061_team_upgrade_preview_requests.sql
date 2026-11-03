-- Original readonly preview requests, not a charge/subscription entitlement.
-- Immutable business metadata is distinct from operational retry/lease fields.
CREATE TABLE IF NOT EXISTS team_subscription_upgrade_previews (
  quote_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  actor_id UUID NOT NULL,
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  request_metadata JSONB NOT NULL CHECK(jsonb_typeof(request_metadata)='object' AND octet_length(request_metadata::text)<=65536),
  request_sha256 TEXT NOT NULL CHECK(request_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_sha256 TEXT NOT NULL CHECK(idempotency_sha256 ~ '^[0-9a-f]{64}$'),
  requested_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'pending' CHECK(disposition IN ('pending','previewed','expired','owner_changed','recovery_required','unconfirmed')),
  revision BIGINT NOT NULL DEFAULT 1 CHECK(revision>0),
  observed_at TIMESTAMPTZ,
  last_observation_id UUID,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  CHECK(requested_at<expires_at),
  CHECK((lease_id IS NULL)=(lease_until IS NULL)),
  CHECK((last_observation_id IS NULL)=(observed_at IS NULL))
);
CREATE INDEX IF NOT EXISTS team_subscription_upgrade_previews_due
  ON team_subscription_upgrade_previews(account_id,livemode,retry_at,lease_until);
CREATE TABLE IF NOT EXISTS team_subscription_upgrade_preview_audit (
  quote_id UUID PRIMARY KEY REFERENCES team_subscription_upgrade_previews(quote_id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  request_sha256 TEXT NOT NULL CHECK(request_sha256 ~ '^[0-9a-f]{64}$'),
  action TEXT NOT NULL CHECK(action='request_upgrade_preview')
);
