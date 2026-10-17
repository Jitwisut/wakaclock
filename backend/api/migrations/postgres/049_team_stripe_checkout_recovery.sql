-- Reauthorization never permits another provider create request.
ALTER TABLE team_stripe_checkout_intents ADD COLUMN IF NOT EXISTS lookup_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE team_stripe_checkout_intents ADD COLUMN IF NOT EXISTS recovery_actor UUID;
CREATE TABLE IF NOT EXISTS team_stripe_checkout_authorizations (
  operation_id UUID NOT NULL REFERENCES team_stripe_checkout_intents(operation_id) ON DELETE CASCADE,
  revision BIGINT NOT NULL,
  actor_id UUID NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK(action='reconcile_existing_checkout'),
  PRIMARY KEY(operation_id,revision)
);
