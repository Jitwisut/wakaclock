ALTER TABLE team_stripe_customer_operations ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE team_stripe_customer_operations ADD COLUMN IF NOT EXISTS lookup_only BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS team_stripe_customer_authorizations (
  operation_id UUID NOT NULL REFERENCES team_stripe_customer_operations(operation_id) ON DELETE CASCADE,
  revision BIGINT NOT NULL,
  actor_id UUID NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK(action='reconcile_existing_customer'),
  PRIMARY KEY(operation_id,revision)
);
