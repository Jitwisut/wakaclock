-- Short-lived, immutable base package price evidence; not a payment authorization.
CREATE TABLE IF NOT EXISTS team_stripe_quotes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  customer_operation UUID NOT NULL REFERENCES team_stripe_customer_operations(operation_id),
  customer_revision BIGINT NOT NULL,
  customer_id TEXT NOT NULL,
  package_seats INTEGER NOT NULL CHECK(package_seats IN (10,25,50,100)),
  price_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK(amount_minor>=0),
  tax_behavior TEXT NOT NULL,
  catalog_revision TEXT NOT NULL,
  catalog_sha256 TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS team_stripe_quotes_scope ON team_stripe_quotes(organization_id,actor_id,expires_at);
