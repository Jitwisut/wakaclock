-- Durable report scheduling state.  A scheduler claims due rows with
-- FOR UPDATE SKIP LOCKED, creates one report.deliver job per occurrence and
-- advances next_run_at in the same transaction.  The delivery provider/worker
-- remains fail-closed until one is registered.
BEGIN;

ALTER TABLE report_schedules
    ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

ALTER TABLE report_schedules
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Existing schedules were created before the durable scheduler existed.  A schedule
-- that already has a sent watermark must resume at the following occurrence; using
-- `last_sent_at` itself would enqueue the same period a second time after migration.
-- Schedules that have never sent retain their creation instant as the first durable
-- due point.  The application applies the timezone/hour rules for newly created rows.
UPDATE report_schedules
SET next_run_at = CASE
    WHEN last_sent_at IS NULL THEN created_at
    WHEN report_type = 'daily' THEN last_sent_at + interval '1 day'
    WHEN report_type = 'weekly' THEN last_sent_at + interval '7 days'
    WHEN report_type = 'monthly' THEN last_sent_at + interval '1 month'
    ELSE created_at
END
WHERE next_run_at IS NULL;

ALTER TABLE report_schedules
    ALTER COLUMN next_run_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS report_schedules_due_idx
    ON report_schedules (next_run_at, id)
    WHERE enabled = TRUE;

-- The first delivery processor is account-owned only. Keep organization schedules
-- durable and visible, but do not make them compete for the account scheduler's
-- due-row scan until recipient/authorization semantics are implemented.
CREATE INDEX IF NOT EXISTS report_schedules_account_due_idx
    ON report_schedules (next_run_at, id)
    WHERE enabled = TRUE AND user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS report_deliveries (
    id UUID PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    occurrence_key TEXT NOT NULL,
    async_job_id UUID NOT NULL REFERENCES async_jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
    attempted_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (period_end > period_start),
    CHECK (octet_length(occurrence_key) BETWEEN 1 AND 128),
    UNIQUE (schedule_id, occurrence_key),
    UNIQUE (async_job_id)
);

CREATE INDEX IF NOT EXISTS report_deliveries_schedule_period_idx
    ON report_deliveries (schedule_id, period_start DESC);

INSERT INTO schema_migrations (version, name)
VALUES (19, 'report_scheduler')
ON CONFLICT (version) DO NOTHING;

COMMIT;
