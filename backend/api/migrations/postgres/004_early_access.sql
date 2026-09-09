-- Early Access signup metadata; no account or credentials are created.
CREATE TABLE IF NOT EXISTS early_access_signups (
    email TEXT PRIMARY KEY CHECK (length(email) BETWEEN 3 AND 254),
    interest TEXT NOT NULL CHECK (interest IN ('solo', 'teams')),
    locale TEXT NOT NULL CHECK (locale IN ('en', 'th')),
    source_page TEXT NOT NULL CHECK (length(source_page) <= 128),
    consent_version TEXT NOT NULL DEFAULT 'early-access-v1',
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
