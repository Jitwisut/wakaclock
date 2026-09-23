CREATE TABLE IF NOT EXISTS wakatime_import_jobs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_chunks INTEGER NOT NULL CHECK (total_chunks BETWEEN 1 AND 10000),
    before_total_seconds DOUBLE PRECISION NOT NULL,
    before_calculation_version TEXT NOT NULL,
    after_total_seconds DOUBLE PRECISION,
    after_calculation_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wakatime_import_jobs_user_idx
    ON wakatime_import_jobs (user_id, created_at DESC);

-- Only counts and hashes are retained. Raw WakaTime export chunks are ingested
-- into the existing heartbeat store and are not staged in PostgreSQL.
CREATE TABLE IF NOT EXISTS wakatime_import_chunks (
    job_id UUID NOT NULL REFERENCES wakatime_import_jobs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    digest TEXT NOT NULL,
    imported_heartbeats INTEGER NOT NULL CHECK (imported_heartbeats >= 0),
    skipped_heartbeats INTEGER NOT NULL CHECK (skipped_heartbeats >= 0),
    issue_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, chunk_index)
);
