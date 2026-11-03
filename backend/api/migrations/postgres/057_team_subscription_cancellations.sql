-- End-period cancellation operations are not new-purchase Checkout intents.
-- Metadata only. An operation reserves its subscription until explicitly
-- resolved; unknown/changed/owner-revoked states do not silently free the slot.
CREATE TABLE IF NOT EXISTS team_subscription_cancellations (
  operation_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  actor_id UUID NOT NULL,
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  frozen_request JSONB NOT NULL CHECK(jsonb_typeof(frozen_request)='object' AND octet_length(frozen_request::text)<=16384),
  request_sha256 TEXT NOT NULL CHECK(request_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_sha256 TEXT NOT NULL CHECK(idempotency_sha256 ~ '^[0-9a-f]{64}$'),
  read_evidence JSONB NOT NULL CHECK(jsonb_typeof(read_evidence)='object' AND octet_length(read_evidence::text)<=16384),
  read_sha256 TEXT NOT NULL CHECK(read_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at TIMESTAMPTZ NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'pending' CHECK(disposition IN
    ('pending','owner_changed','recovery_required','provider_scheduled','effective','withdrawn','changed')),
  revision BIGINT NOT NULL DEFAULT 1 CHECK(revision>0),
  first_attempt_at TIMESTAMPTZ,
  recovery_actor UUID,
  read_only BOOLEAN NOT NULL DEFAULT false,
  last_observation_id UUID,
  observed_at TIMESTAMPTZ,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  CHECK(first_attempt_at IS NULL OR first_attempt_at>=accepted_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_subscription_cancellations_one_active
  ON team_subscription_cancellations(account_id,livemode,subscription_id)
  WHERE disposition NOT IN ('effective','withdrawn');
CREATE INDEX IF NOT EXISTS team_subscription_cancellations_due
  ON team_subscription_cancellations(account_id,livemode,retry_at,lease_until);
CREATE TABLE IF NOT EXISTS team_subscription_cancellation_authorizations (
  operation_id UUID NOT NULL REFERENCES team_subscription_cancellations(operation_id) ON DELETE CASCADE,
  revision BIGINT NOT NULL CHECK(revision>0),
  actor_id UUID NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('request_cancel_at_period_end','reconcile_existing_cancellation')),
  PRIMARY KEY(operation_id,revision)
);
CREATE TABLE IF NOT EXISTS team_subscription_cancellation_audit (
  operation_id UUID NOT NULL REFERENCES team_subscription_cancellations(operation_id) ON DELETE CASCADE,
  revision BIGINT NOT NULL CHECK(revision>0),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('request_cancel_at_period_end','reconcile_existing_cancellation')),
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata_hash TEXT NOT NULL CHECK(metadata_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(operation_id,revision)
);
