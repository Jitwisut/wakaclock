BEGIN;

-- Device-scoped diagnostics are metadata-only and expire quickly. The latest row per
-- user/device is enough for the dashboard; sequence ordering prevents a delayed
-- report from replacing a newer receipt.
CREATE TABLE IF NOT EXISTS ai_diagnostics_devices (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL CHECK (char_length(device_id) BETWEEN 1 AND 128),
    boot_id TEXT NOT NULL CHECK (char_length(boot_id) BETWEEN 1 AND 128),
    sequence BIGINT NOT NULL CHECK (sequence >= 0),
    measured_at TIMESTAMPTZ NOT NULL,
    receipt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    report JSONB NOT NULL,
    PRIMARY KEY (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS ai_diagnostics_devices_expiry_idx
    ON ai_diagnostics_devices(user_id, expires_at);

COMMIT;
