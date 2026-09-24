BEGIN;

-- No source data is retained here: job JSON contains only bounded operation IDs,
-- revision fingerprints, measured counters, and progress.
CREATE TABLE IF NOT EXISTS measurement_repair_jobs (
    repair_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN (
        'preview', 'applying', 'applied', 'rolling_back', 'rolled_back', 'conflict'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    job JSONB NOT NULL,
    PRIMARY KEY (user_id, repair_id)
);

CREATE INDEX IF NOT EXISTS measurement_repair_jobs_history_idx
    ON measurement_repair_jobs(user_id, created_at DESC);

COMMIT;
