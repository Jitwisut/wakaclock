-- Accepted provider metadata projections; never a payment/coverage grant.
CREATE TABLE IF NOT EXISTS team_subscription_cancellation_projections (
  observation_id UUID PRIMARY KEY,
  operation_id UUID NOT NULL REFERENCES team_subscription_cancellations(operation_id) ON DELETE CASCADE,
  exchange_id UUID NOT NULL REFERENCES team_subscription_cancellation_exchanges(exchange_id),
  projected_at TIMESTAMPTZ NOT NULL,
  projection_metadata JSONB NOT NULL CHECK(jsonb_typeof(projection_metadata)='object' AND octet_length(projection_metadata::text)<=65536),
  metadata_sha256 TEXT NOT NULL CHECK(metadata_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS team_subscription_cancellation_projections_operation
  ON team_subscription_cancellation_projections(operation_id,projected_at,observation_id);
