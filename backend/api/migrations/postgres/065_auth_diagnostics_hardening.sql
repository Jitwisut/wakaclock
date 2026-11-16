-- Additive metadata only; no heartbeat/usage tables or time-counting changes.
ALTER TABLE ai_diagnostics_devices
    ADD COLUMN IF NOT EXISTS retired_boot_ids TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS oauth_device_codes_expiry_idx ON oauth_device_codes(expires_at);
CREATE INDEX IF NOT EXISTS oauth_device_codes_pending_app_idx
    ON oauth_device_codes(app_id, expires_at) WHERE consumed_at IS NULL;
