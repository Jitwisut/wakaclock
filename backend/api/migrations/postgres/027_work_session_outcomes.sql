CREATE TABLE IF NOT EXISTS work_session_outcomes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL CHECK (session_id ~ '^[0-9a-f]{64}$'),
    outcome TEXT CHECK (outcome IN ('completed', 'needs_work', 'abandoned')),
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, session_id)
);
CREATE TABLE IF NOT EXISTS work_session_outcome_history (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    version BIGINT NOT NULL,
    outcome TEXT CHECK (outcome IN ('completed', 'needs_work', 'abandoned')),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, session_id, version),
    FOREIGN KEY (user_id, session_id) REFERENCES work_session_outcomes(user_id, session_id) ON DELETE CASCADE
);
