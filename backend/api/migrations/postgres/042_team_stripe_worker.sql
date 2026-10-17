-- Shared worker cooldown prevents another process/restart bypassing Retry-After.
CREATE TABLE IF NOT EXISTS team_stripe_runtime_status (
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  last_tick_at TIMESTAMPTZ,
  last_provider_success_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  PRIMARY KEY(account_id,livemode)
);
