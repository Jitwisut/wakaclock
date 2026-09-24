BEGIN;

-- Latest privacy-safe local queue snapshot per account, device, and authenticated
-- delivery queue. Snapshots expire on the same 30-day horizon as diagnostics.
CREATE TABLE IF NOT EXISTS delivery_status_devices (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL CHECK (char_length(device_id) BETWEEN 1 AND 128),
    queue_id TEXT NOT NULL CHECK (char_length(queue_id) = 64),
    sequence BIGINT NOT NULL CHECK (sequence >= 0),
    captured_at TIMESTAMPTZ NOT NULL,
    receipt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    snapshot JSONB NOT NULL,
    PRIMARY KEY (user_id, device_id, queue_id)
);

CREATE INDEX IF NOT EXISTS delivery_status_devices_expiry_idx
    ON delivery_status_devices(user_id, expires_at, receipt_at DESC);

COMMIT;
