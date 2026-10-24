-- Frozen server-built parameters; no token, raw webhook, PII, or hosted Checkout URL.
ALTER TABLE team_stripe_checkout_intents ADD COLUMN IF NOT EXISTS request_metadata JSONB;
ALTER TABLE team_stripe_checkout_intents ADD COLUMN IF NOT EXISTS request_sha256 TEXT;
