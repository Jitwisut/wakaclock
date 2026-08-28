-- AtoAxis Phase 10 transactional foundation.
--
-- Telemetry stays in ClickHouse. These tables own identity, access, OAuth, integrations,
-- productivity configuration, billing and audit state. IDs are supplied by the application as
-- UUIDv7 values so inserts remain time sortable without depending on a database extension.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_emails (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_emails_primary_idx
    ON user_emails(user_id) WHERE is_primary AND is_verified;

CREATE TABLE IF NOT EXISTS password_credentials (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_active_idx
    ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['write_logged_time'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_user_active_idx
    ON api_keys(user_id, created_at DESC) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    afk_timeout_seconds INTEGER NOT NULL DEFAULT 900 CHECK (afk_timeout_seconds BETWEEN 60 AND 86400),
    browser_title_tracking BOOLEAN NOT NULL DEFAULT FALSE,
    report_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    privacy_mode BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    personal_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    seat_type TEXT NOT NULL DEFAULT 'viewer' CHECK (seat_type IN ('developer', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON organization_members(user_id);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_domains (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    verification_token_hash TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    UNIQUE (organization_id, domain)
);

CREATE TABLE IF NOT EXISTS oauth_apps (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    client_id TEXT NOT NULL UNIQUE,
    client_secret_hash TEXT,
    is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

INSERT INTO oauth_apps
    (id, owner_user_id, organization_id, name, client_id, client_secret_hash, is_confidential)
VALUES
    ('019c91f4-4c3e-7b31-a102-3a5f9d0b7e10', NULL, NULL, 'AtoAxis Figma', 'atoaxis_figma', NULL, FALSE)
ON CONFLICT (client_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS oauth_redirect_uris (
    app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    PRIMARY KEY (app_id, redirect_uri)
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    code_hash TEXT PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT,
    code_challenge_method TEXT,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id UUID PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id UUID PRIMARY KEY,
    access_token_id UUID NOT NULL REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    rotated_to UUID REFERENCES oauth_refresh_tokens(id),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_consents (
    app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (app_id, user_id)
);

CREATE TABLE IF NOT EXISTS oauth_device_codes (
    device_code_hash TEXT PRIMARY KEY,
    user_code TEXT NOT NULL UNIQUE,
    app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    interval_seconds INTEGER NOT NULL DEFAULT 5,
    last_polled_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_device_codes_user_code_idx
    ON oauth_device_codes(user_code) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS integration_connections (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'syncing', 'error', 'disconnected')),
    scopes TEXT[] NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    disconnected_at TIMESTAMPTZ,
    CHECK (organization_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS integration_connections_owner_idx
    ON integration_connections(organization_id, provider) WHERE disconnected_at IS NULL;

CREATE TABLE IF NOT EXISTS integration_credentials (
    connection_id UUID PRIMARY KEY REFERENCES integration_connections(id) ON DELETE CASCADE,
    encrypted_payload BYTEA NOT NULL,
    key_version TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_sync_states (
    connection_id UUID PRIMARY KEY REFERENCES integration_connections(id) ON DELETE CASCADE,
    cursor TEXT,
    provider_version TEXT,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
    provider TEXT NOT NULL,
    delivery_id TEXT NOT NULL,
    connection_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
    payload_hash TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    PRIMARY KEY (provider, delivery_id)
);

CREATE TABLE IF NOT EXISTS vcs_connections (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
    external_account_id TEXT NOT NULL,
    encrypted_credentials_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    disconnected_at TIMESTAMPTZ,
    UNIQUE (organization_id, provider, external_account_id)
);

CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY,
    vcs_connection_id UUID NOT NULL REFERENCES vcs_connections(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    default_branch TEXT,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vcs_connection_id, external_id)
);

CREATE TABLE IF NOT EXISTS repository_projects (
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,
    mapping_source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (repository_id, project_id)
);

CREATE TABLE IF NOT EXISTS commits (
    id UUID PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    hash TEXT NOT NULL,
    branch TEXT,
    author_external_id TEXT,
    authored_at TIMESTAMPTZ,
    committed_at TIMESTAMPTZ,
    message_length INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (repository_id, hash)
);

CREATE TABLE IF NOT EXISTS pull_requests (
    id UUID PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    head_branch TEXT,
    base_branch TEXT,
    author_external_id TEXT,
    opened_at TIMESTAMPTZ,
    merged_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (repository_id, external_id)
);

CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (repository_id, external_id)
);

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    metric TEXT NOT NULL CHECK (metric IN ('time', 'manual_time', 'ai_time', 'heartbeats')),
    filter_kind TEXT NOT NULL CHECK (filter_kind IN ('project', 'language', 'category', 'editor', 'all')),
    filter_value TEXT,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    target_seconds BIGINT NOT NULL CHECK (target_seconds >= 0),
    direction TEXT NOT NULL CHECK (direction IN ('minimum', 'maximum')),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    starts_on DATE NOT NULL,
    ends_on DATE,
    priority INTEGER NOT NULL DEFAULT 0,
    public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS goal_notification_rules (
    id UUID PRIMARY KEY,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app')),
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'on_miss', 'on_complete')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (goal_id, channel, cadence)
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    delivery_hour SMALLINT NOT NULL DEFAULT 9 CHECK (delivery_hour BETWEEN 0 AND 23),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS leaderboards (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
    metric TEXT NOT NULL CHECK (metric IN ('time', 'manual_time', 'ai_time', 'ai_spend')),
    period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly')),
    language TEXT,
    country TEXT,
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (organization_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS leaderboard_members (
    leaderboard_id UUID NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (leaderboard_id, user_id)
);

CREATE TABLE IF NOT EXISTS public_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    show_projects BOOLEAN NOT NULL DEFAULT FALSE,
    show_languages BOOLEAN NOT NULL DEFAULT FALSE,
    show_ai_metrics BOOLEAN NOT NULL DEFAULT FALSE,
    badge TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (owner_user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS embed_tokens (
    id UUID PRIMARY KEY,
    share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('svg', 'json')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'zip')),
    scope TEXT NOT NULL CHECK (scope IN ('heartbeats', 'summaries', 'projects', 'ai', 'external_durations', 'goals', 'organization', 'all')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'expired', 'cancelled')),
    progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    error_code TEXT,
    CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS export_artifacts (
    id UUID PRIMARY KEY,
    export_job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    bytes BIGINT NOT NULL,
    signed_url_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_customer_id TEXT NOT NULL UNIQUE,
    billing_email TEXT,
    tax_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    billing_customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
    provider_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'individual', 'team', 'business')),
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'incomplete')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_items (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    provider_item_id TEXT,
    product_key TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    unit_amount_microusd BIGINT NOT NULL DEFAULT 0,
    UNIQUE (subscription_id, product_key)
);

CREATE TABLE IF NOT EXISTS entitlements (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    value JSONB NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,
    UNIQUE (subscription_id, feature_key, effective_from)
);

CREATE TABLE IF NOT EXISTS organization_seats (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    billing_period DATE NOT NULL,
    seat_type TEXT NOT NULL CHECK (seat_type IN ('developer', 'viewer')),
    active_seconds BIGINT NOT NULL DEFAULT 0,
    billable BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (organization_id, user_id, billing_period)
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY,
    billing_customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
    provider_invoice_id TEXT UNIQUE,
    number TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal_microusd BIGINT NOT NULL DEFAULT 0,
    total_microusd BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    pdf_object_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sso_connections (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL CHECK (protocol IN ('oidc', 'saml')),
    issuer TEXT,
    entity_id TEXT,
    encrypted_config BYTEA NOT NULL,
    enforced BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, protocol)
);

CREATE TABLE IF NOT EXISTS scim_tokens (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    request_id TEXT,
    ip_address INET,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON outbox_events(created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs(organization_id, created_at DESC);

INSERT INTO schema_migrations(version, name)
VALUES (1001, 'phase10_foundation')
ON CONFLICT (version) DO NOTHING;

COMMIT;
