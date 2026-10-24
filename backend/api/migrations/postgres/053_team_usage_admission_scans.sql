-- Bounded, restartable scans of personal canonical metadata for explicitly enrolled Teams.
-- This checkpoint neither enrolls organizations nor copies usage or cost.
CREATE TABLE IF NOT EXISTS team_usage_admission_scans (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    scan_from TIMESTAMPTZ,
    scan_before TIMESTAMPTZ,
    after_user TEXT NOT NULL DEFAULT '',
    after_event TEXT NOT NULL DEFAULT '',
    lease_token UUID,
    lease_until TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_success_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,
    error_code TEXT,
    CHECK ((scan_from IS NULL) = (scan_before IS NULL)),
    CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
