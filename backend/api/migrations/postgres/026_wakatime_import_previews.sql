BEGIN;

-- A resumable, metadata-only preflight. Raw WakaTime dumps are never staged in
-- PostgreSQL; the digest binds the user's confirmation to the exact chunk.
CREATE TABLE IF NOT EXISTS wakatime_import_chunk_previews (
    job_id UUID NOT NULL REFERENCES wakatime_import_jobs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    digest TEXT NOT NULL CHECK (char_length(digest) = 64),
    valid_heartbeats INTEGER NOT NULL CHECK (valid_heartbeats >= 0),
    invalid_heartbeats INTEGER NOT NULL CHECK (invalid_heartbeats >= 0),
    possible_legacy_duplicates INTEGER NOT NULL CHECK (possible_legacy_duplicates >= 0),
    legacy_scan_limited BOOLEAN NOT NULL DEFAULT false,
    requires_confirmation BOOLEAN NOT NULL DEFAULT false,
    previewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, chunk_index)
);

ALTER TABLE wakatime_import_chunks
    ADD COLUMN IF NOT EXISTS possible_legacy_duplicates INTEGER NOT NULL DEFAULT 0
        CHECK (possible_legacy_duplicates >= 0),
    ADD COLUMN IF NOT EXISTS legacy_scan_limited BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS confirmed_legacy_ambiguity BOOLEAN NOT NULL DEFAULT false;

COMMIT;
