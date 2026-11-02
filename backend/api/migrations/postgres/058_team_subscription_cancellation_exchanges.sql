-- One prepared exchange per actual HTTP attempt, before any possible send.
-- This never records that a request ran or a cancellation became effective.
CREATE TABLE IF NOT EXISTS team_subscription_cancellation_exchanges (
  exchange_id UUID PRIMARY KEY,
  operation_id UUID NOT NULL REFERENCES team_subscription_cancellations(operation_id) ON DELETE CASCADE,
  authorization_revision BIGINT NOT NULL CHECK(authorization_revision>0),
  actor_id UUID NOT NULL,
  lease_id UUID NOT NULL,
  account_lease_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('mutation','resource_read')),
  prepared_at TIMESTAMPTZ NOT NULL,
  first_attempt_at TIMESTAMPTZ,
  authorization_sha256 TEXT NOT NULL CHECK(authorization_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_sha256 TEXT NOT NULL CHECK(metadata_sha256 ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY(operation_id,authorization_revision) REFERENCES team_subscription_cancellation_authorizations(operation_id,revision),
  CHECK(first_attempt_at IS NULL OR first_attempt_at<=prepared_at),
  CHECK(kind<>'mutation' OR (authorization_revision=1 AND first_attempt_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS team_subscription_cancellation_exchanges_operation
  ON team_subscription_cancellation_exchanges(operation_id,prepared_at,exchange_id);
CREATE TABLE IF NOT EXISTS team_subscription_cancellation_exchange_audit (
  exchange_id UUID PRIMARY KEY REFERENCES team_subscription_cancellation_exchanges(exchange_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL REFERENCES team_subscription_cancellations(operation_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata_sha256 TEXT NOT NULL CHECK(metadata_sha256 ~ '^[0-9a-f]{64}$')
);
-- Drop/re-add only the metadata CHECK constraint; no row or column is deleted.
ALTER TABLE team_subscription_cancellation_audit
  DROP CONSTRAINT IF EXISTS team_subscription_cancellation_audit_action_check;
ALTER TABLE team_subscription_cancellation_audit
  ADD CONSTRAINT team_subscription_cancellation_audit_action_check
  CHECK(action IN ('request_cancel_at_period_end','reconcile_existing_cancellation','stop_existing_cancellation'));
