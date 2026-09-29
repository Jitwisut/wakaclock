//! PostgreSQL transactional store for AtoAxis product state.
//!
//! ClickHouse remains the telemetry/analytics store. This client intentionally exposes only
//! connection, migration and health primitives for the first foundation slice; feature
//! repositories can be added without allowing request handlers to talk to a raw database
//! connection directly.

use anyhow::{Context, Result};
use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod, Runtime};
use std::time::Duration;
use tokio_postgres::{types::ToSql, Row, ToStatement};

use crate::config::PostgresConfig;

const FOUNDATION_MIGRATION: &str =
    include_str!("../../migrations/postgres/001_phase10_foundation.sql");
const PRESENCE_MIGRATION: &str = include_str!("../../migrations/postgres/002_presence_v2.sql");
const AI_DIAGNOSTICS_MIGRATION: &str =
    include_str!("../../migrations/postgres/003_ai_diagnostics.sql");

const EARLY_ACCESS_MIGRATION: &str = include_str!("../../migrations/postgres/004_early_access.sql");
const CREDENTIAL_MIGRATIONS_MIGRATION: &str =
    include_str!("../../migrations/postgres/005_credential_migrations.sql");
const API_KEY_READBACK_MIGRATION: &str =
    include_str!("../../migrations/postgres/006_api_key_readback.sql");
const ASYNC_JOBS_MIGRATION: &str = include_str!("../../migrations/postgres/007_async_jobs.sql");
const JOB_WORKER_STATE_MIGRATION: &str =
    include_str!("../../migrations/postgres/008_job_worker_state.sql");
const INGEST_STATE_MIGRATION: &str = include_str!("../../migrations/postgres/009_ingest_state.sql");
const HEARTBEAT_VERIFICATION_AUDIT_MIGRATION: &str =
    include_str!("../../migrations/postgres/010_heartbeat_verification_audits.sql");
const AI_USAGE_VERIFICATION_AUDIT_MIGRATION: &str =
    include_str!("../../migrations/postgres/011_ai_usage_verification_audits.sql");
const SYSTEM_JOB_IDEMPOTENCY_MIGRATION: &str =
    include_str!("../../migrations/postgres/012_system_job_idempotency.sql");
const INTEGRATION_SYNC_GENERATION_MIGRATION: &str =
    include_str!("../../migrations/postgres/013_integration_sync_generation.sql");
const ASYNC_JOB_PARAMS_HASH_MIGRATION: &str =
    include_str!("../../migrations/postgres/014_async_job_params_hash.sql");
const EXPORT_ASYNC_JOB_LINK_MIGRATION: &str =
    include_str!("../../migrations/postgres/015_export_async_job_link.sql");
const EXPORT_IDEMPOTENCY_MIGRATION: &str =
    include_str!("../../migrations/postgres/016_export_idempotency.sql");
const AI_USAGE_INGEST_IDENTITIES_MIGRATION: &str =
    include_str!("../../migrations/postgres/017_ai_usage_ingest_identities.sql");
const AI_USAGE_VERIFICATION_IDENTITY_MIGRATION: &str =
    include_str!("../../migrations/postgres/018_ai_usage_verification_identity.sql");
const REPORT_SCHEDULER_MIGRATION: &str =
    include_str!("../../migrations/postgres/019_report_scheduler.sql");
const ACCOUNT_DELETION_MIGRATION: &str =
    include_str!("../../migrations/postgres/020_account_deletion.sql");
const ACCOUNT_DELETION_CONSTRAINTS_MIGRATION: &str =
    include_str!("../../migrations/postgres/021_account_deletion_constraints.sql");
const ORG_ANALYTICS_CONSENT_MIGRATION: &str =
    include_str!("../../migrations/postgres/022_org_analytics_consent.sql");
const WAKATIME_IMPORT_JOBS_MIGRATION: &str =
    include_str!("../../migrations/postgres/023_wakatime_import_jobs.sql");
const DELIVERY_STATUS_MIGRATION: &str =
    include_str!("../../migrations/postgres/024_delivery_status.sql");
const MEASUREMENT_REPAIRS_MIGRATION: &str =
    include_str!("../../migrations/postgres/025_measurement_repairs.sql");
const WAKATIME_IMPORT_PREVIEWS_MIGRATION: &str =
    include_str!("../../migrations/postgres/026_wakatime_import_previews.sql");
const ORGANIZATION_USER_INVITES_MIGRATION: &str =
    include_str!("../../migrations/postgres/028_organization_user_invites.sql");
// PostgreSQL's hashtextextended seed and advisory-lock key are bigint values.
// Keep this as i64 so tokio-postgres serializes the parameter as int8 instead
// of sending int4, which PostgreSQL rejects for the prepared expression.
const ACCOUNT_ACTIVITY_LOCK_NAMESPACE: i64 = 73_111;

fn account_activity_lock_key(user_id: uuid::Uuid) -> String {
    format!("account-delete:v1:{user_id}")
}

pub struct PostgresClient {
    pool: Pool,
    max_connections: u32,
}

impl PostgresClient {
    pub async fn connect(config: &PostgresConfig) -> Result<Self> {
        let url = config
            .url
            .as_deref()
            .context("POSTGRES_URL is required to initialize PostgreSQL")?;

        let mut pg: tokio_postgres::Config = url
            .parse()
            .context("invalid PostgreSQL connection configuration")?;
        pg.connect_timeout(Duration::from_secs(10));
        pg.application_name("wakaclock-server");
        // Bound individual statements without retrying ambiguous writes.
        if pg.get_options().is_none() {
            pg.options("-c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000");
        }
        let roots =
            rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let tls = rustls::ClientConfig::builder_with_provider(std::sync::Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_safe_default_protocol_versions()?
        .with_root_certificates(roots)
        .with_no_client_auth();
        let manager = Manager::from_config(
            pg,
            tokio_postgres_rustls::MakeRustlsConnect::new(tls),
            ManagerConfig {
                recycling_method: RecyclingMethod::Verified,
            },
        );
        let pool = Pool::builder(manager)
            .max_size(config.max_connections as usize)
            .runtime(Runtime::Tokio1)
            .wait_timeout(Some(Duration::from_secs(10)))
            .create_timeout(Some(Duration::from_secs(10)))
            .recycle_timeout(Some(Duration::from_secs(10)))
            .build()
            .context("failed to create PostgreSQL pool")?;
        let store = Self {
            pool,
            max_connections: config.max_connections,
        };
        store
            .health_check()
            .await
            .context("failed to connect to PostgreSQL")?;
        Ok(store)
    }

    /// The configured pool size is used by long-running processors to leave a
    /// small reserve for lease transitions, relay and health checks.
    pub const fn max_connections(&self) -> u32 {
        self.max_connections
    }

    /// Return whether an account may no longer receive telemetry. Missing users
    /// are treated as unavailable too: after the final hard delete, an in-flight
    /// Kafka record must not recreate the account's analytics rows.
    pub async fn is_account_deleted(&self, user_id: uuid::Uuid) -> Result<bool> {
        let row = self
            .query_opt(
                "SELECT NOT is_active OR deleted_at IS NOT NULL AS unavailable
                 FROM users WHERE id = $1",
                &[&user_id],
            )
            .await?;
        Ok(row.is_none_or(|row| row.get("unavailable")))
    }

    /// Acquire the account activity lock shared by destructive account deletion
    /// and all Kafka fact sinks. The connection is detached from the pool and
    /// closed when dropped, so a session-level advisory lock can never leak into
    /// a later request that happens to reuse the same pooled connection.
    pub async fn account_activity_lock(
        &self,
        user_id: uuid::Uuid,
    ) -> Result<deadpool_postgres::ClientWrapper> {
        let client = deadpool_postgres::Object::take(self.transaction_client().await?);
        let lock_key = account_activity_lock_key(user_id);
        client
            .query_one(
                "SELECT pg_advisory_lock(hashtextextended($1, $2))",
                &[&lock_key, &ACCOUNT_ACTIVITY_LOCK_NAMESPACE],
            )
            .await
            .context("acquire account activity lock")?;
        Ok(client)
    }

    /// Acquire the transaction-scoped half of the account activity lock. All
    /// user-scoped job creation and destructive account tombstoning use this
    /// helper so a transaction that started before a tombstone cannot commit a
    /// new job after the deletion worker has already drained the queue.
    pub async fn account_activity_transaction_lock(
        tx: &tokio_postgres::Transaction<'_>,
        user_id: uuid::Uuid,
    ) -> Result<()> {
        let lock_key = account_activity_lock_key(user_id);
        tx.query_one(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, $2))",
            &[&lock_key, &ACCOUNT_ACTIVITY_LOCK_NAMESPACE],
        )
        .await
        .context("acquire account activity transaction lock")?;
        Ok(())
    }

    /// Check account availability on the same connection that owns an account
    /// activity lock. Callers must keep that connection alive through every
    /// account-scoped side effect that follows this check.
    pub async fn is_account_deleted_on(
        &self,
        client: &tokio_postgres::Client,
        user_id: uuid::Uuid,
    ) -> Result<bool> {
        let row = client
            .query_opt(
                "SELECT NOT is_active OR deleted_at IS NOT NULL AS unavailable
                 FROM users WHERE id = $1",
                &[&user_id],
            )
            .await?;
        Ok(row.is_none_or(|row| row.get("unavailable")))
    }

    pub async fn transaction_client(&self) -> Result<deadpool_postgres::Object> {
        self.pool
            .get()
            .await
            .context("PostgreSQL connection unavailable")
    }

    /// A dedicated connection owns this session lock. Dropping it closes the
    /// connection, releasing the lock even when a migration fails or is cancelled.
    pub async fn migration_guard(&self) -> Result<deadpool_postgres::ClientWrapper> {
        let client = deadpool_postgres::Object::take(self.transaction_client().await?);
        client
            .query_one("SELECT pg_advisory_lock(731092026)", &[])
            .await?;
        Ok(client)
    }

    pub async fn migrate(&self) -> Result<()> {
        // Pin one connection for the migration scripts' BEGIN/COMMIT pairs.
        let client = deadpool_postgres::Object::take(self.transaction_client().await?);
        client
            .query_one("SELECT pg_advisory_lock(731092027)", &[])
            .await?;
        for (name, sql) in [
            ("foundation", FOUNDATION_MIGRATION),
            ("presence", PRESENCE_MIGRATION),
            (
                "presence office",
                include_str!("../../migrations/postgres/007_presence_office.sql"),
            ),
            ("AI diagnostics", AI_DIAGNOSTICS_MIGRATION),
            ("early access", EARLY_ACCESS_MIGRATION),
            ("credential migrations", CREDENTIAL_MIGRATIONS_MIGRATION),
            ("API key readback", API_KEY_READBACK_MIGRATION),
            ("async jobs", ASYNC_JOBS_MIGRATION),
            ("job worker state", JOB_WORKER_STATE_MIGRATION),
            ("ingest state", INGEST_STATE_MIGRATION),
            (
                "heartbeat verification audits",
                HEARTBEAT_VERIFICATION_AUDIT_MIGRATION,
            ),
            (
                "AI usage verification audits",
                AI_USAGE_VERIFICATION_AUDIT_MIGRATION,
            ),
            ("system job idempotency", SYSTEM_JOB_IDEMPOTENCY_MIGRATION),
            (
                "integration sync generation",
                INTEGRATION_SYNC_GENERATION_MIGRATION,
            ),
            ("async job params hash", ASYNC_JOB_PARAMS_HASH_MIGRATION),
            ("export async job link", EXPORT_ASYNC_JOB_LINK_MIGRATION),
            ("export idempotency", EXPORT_IDEMPOTENCY_MIGRATION),
            (
                "AI usage ingest identities",
                AI_USAGE_INGEST_IDENTITIES_MIGRATION,
            ),
            (
                "AI usage verification identity",
                AI_USAGE_VERIFICATION_IDENTITY_MIGRATION,
            ),
            ("report scheduler", REPORT_SCHEDULER_MIGRATION),
            ("account deletion", ACCOUNT_DELETION_MIGRATION),
            (
                "account deletion constraints",
                ACCOUNT_DELETION_CONSTRAINTS_MIGRATION,
            ),
            (
                "organization analytics consent",
                ORG_ANALYTICS_CONSENT_MIGRATION,
            ),
            ("WakaTime import jobs", WAKATIME_IMPORT_JOBS_MIGRATION),
            ("delivery status", DELIVERY_STATUS_MIGRATION),
            ("measurement repairs", MEASUREMENT_REPAIRS_MIGRATION),
            (
                "WakaTime import previews",
                WAKATIME_IMPORT_PREVIEWS_MIGRATION,
            ),
            (
                "organization user invites",
                ORGANIZATION_USER_INVITES_MIGRATION,
            ),
        ] {
            client
                .batch_execute(sql)
                .await
                .with_context(|| format!("failed to apply PostgreSQL {name} migration"))?;
        }
        Ok(())
    }

    pub async fn health_check(&self) -> Result<()> {
        self.query_one("SELECT 1", &[])
            .await
            .context("PostgreSQL health check failed")?;
        Ok(())
    }

    /// A small query facade retains service call sites while every operation leases
    /// a live connection. Transactions explicitly pin one lease via transaction_client.
    pub fn client(&self) -> &Self {
        self
    }

    pub async fn query<T: ?Sized + ToStatement>(
        &self,
        sql: &T,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<Vec<Row>> {
        Ok(self.transaction_client().await?.query(sql, params).await?)
    }
    pub async fn query_one<T: ?Sized + ToStatement>(
        &self,
        sql: &T,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<Row> {
        Ok(self
            .transaction_client()
            .await?
            .query_one(sql, params)
            .await?)
    }
    pub async fn query_opt<T: ?Sized + ToStatement>(
        &self,
        sql: &T,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<Option<Row>> {
        Ok(self
            .transaction_client()
            .await?
            .query_opt(sql, params)
            .await?)
    }
    pub async fn execute<T: ?Sized + ToStatement>(
        &self,
        sql: &T,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<u64> {
        Ok(self
            .transaction_client()
            .await?
            .execute(sql, params)
            .await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn foundation_migration_contains_transactional_domains() {
        for table in [
            "users",
            "organizations",
            "oauth_apps",
            "integration_connections",
            "goals",
            "export_jobs",
            "subscriptions",
            "sso_connections",
            "scim_tokens",
            "vcs_connections",
            "repositories",
            "commits",
            "vcs_identities",
            "audit_logs",
        ] {
            assert!(
                FOUNDATION_MIGRATION.contains(&format!("CREATE TABLE IF NOT EXISTS {table}")),
                "migration is missing {table}"
            );
        }
        assert!(
            FOUNDATION_MIGRATION.contains("'atoaxis_figma'"),
            "migration is missing the first-party Figma OAuth client"
        );
        assert!(PRESENCE_MIGRATION.contains("CREATE EXTENSION IF NOT EXISTS pgcrypto"));
        assert!(PRESENCE_MIGRATION.contains("Pairing Table A"));
        for table in [
            "presence_rooms",
            "presence_room_zones",
            "presence_room_grants",
            "presence_room_invites",
        ] {
            assert!(
                PRESENCE_MIGRATION.contains(&format!("CREATE TABLE IF NOT EXISTS {table}")),
                "presence migration is missing {table}"
            );
        }
        assert!(AI_DIAGNOSTICS_MIGRATION.contains("ai_diagnostics_devices"));
        assert!(AI_DIAGNOSTICS_MIGRATION.contains("expires_at"));
        assert!(DELIVERY_STATUS_MIGRATION.contains("delivery_status_devices"));
        assert!(DELIVERY_STATUS_MIGRATION.contains("ON DELETE CASCADE"));
        assert!(MEASUREMENT_REPAIRS_MIGRATION.contains("measurement_repair_jobs"));
        assert!(MEASUREMENT_REPAIRS_MIGRATION.contains("ON DELETE CASCADE"));
        assert!(ORGANIZATION_USER_INVITES_MIGRATION
            .contains("CREATE TABLE IF NOT EXISTS organization_user_invites"));
        assert!(ORGANIZATION_USER_INVITES_MIGRATION.contains("WHERE status = 'pending'"));
        assert!(ASYNC_JOBS_MIGRATION.contains("CREATE TABLE IF NOT EXISTS async_jobs"));
        assert!(
            ASYNC_JOBS_MIGRATION.contains("async_jobs_idempotency_idx"),
            "async_jobs migration is missing the idempotency-key unique index"
        );
        assert!(JOB_WORKER_STATE_MIGRATION.contains("lease_owner UUID"));
        assert!(JOB_WORKER_STATE_MIGRATION.contains("publish_attempts INTEGER"));
        assert!(JOB_WORKER_STATE_MIGRATION.contains("retry_delay_seconds INTEGER"));
        assert!(JOB_WORKER_STATE_MIGRATION.contains("failed_at TIMESTAMPTZ"));
        assert!(JOB_WORKER_STATE_MIGRATION.contains("failure_code TEXT"));
        assert!(INGEST_STATE_MIGRATION.contains("CREATE TABLE IF NOT EXISTS user_ingest_access"));
        assert!(INGEST_STATE_MIGRATION.contains("CREATE TABLE IF NOT EXISTS project_rules"));
        assert!(INGEST_STATE_MIGRATION.contains("project_rules_active_priority_idx"));
        assert!(HEARTBEAT_VERIFICATION_AUDIT_MIGRATION
            .contains("CREATE TABLE IF NOT EXISTS heartbeat_verification_audits"));
        assert!(HEARTBEAT_VERIFICATION_AUDIT_MIGRATION.contains("field_flags TEXT[]"));
        assert!(HEARTBEAT_VERIFICATION_AUDIT_MIGRATION.contains("resolved_at TIMESTAMPTZ"));
        assert!(SYSTEM_JOB_IDEMPOTENCY_MIGRATION.contains("async_jobs_system_idempotency_idx"));
        assert!(INTEGRATION_SYNC_GENERATION_MIGRATION.contains("sync_generation BIGINT"));
        assert!(ASYNC_JOB_PARAMS_HASH_MIGRATION.contains("idempotency_params_hash TEXT"));
        assert!(EXPORT_ASYNC_JOB_LINK_MIGRATION.contains("export_jobs_async_job_idx"));
        assert!(EXPORT_IDEMPOTENCY_MIGRATION.contains("export_jobs_user_idempotency_idx"));
        assert!(AI_USAGE_INGEST_IDENTITIES_MIGRATION
            .contains("CREATE TABLE IF NOT EXISTS ai_usage_ingest_identities"));
        assert!(AI_USAGE_INGEST_IDENTITIES_MIGRATION.contains("payload_hash"));
        assert!(AI_USAGE_INGEST_IDENTITIES_MIGRATION.contains("published_at"));
        assert!(AI_USAGE_VERIFICATION_IDENTITY_MIGRATION.contains("identity_hash"));
        assert!(AI_USAGE_VERIFICATION_IDENTITY_MIGRATION
            .contains("ai_usage_verification_audits_identity_unique"));
        assert!(ACCOUNT_DELETION_MIGRATION.contains("account_deletion_requests"));
        assert!(ACCOUNT_DELETION_MIGRATION.contains("ON DELETE SET NULL"));
        assert!(ACCOUNT_DELETION_MIGRATION.contains("account_deletion_audits"));
        assert!(ACCOUNT_DELETION_CONSTRAINTS_MIGRATION
            .contains("ai_usage_ingest_identities_user_id_fkey"));
        assert!(
            ACCOUNT_DELETION_CONSTRAINTS_MIGRATION.contains("credential_migrations_user_id_fkey")
        );
        assert!(ACCOUNT_DELETION_CONSTRAINTS_MIGRATION.contains("ON DELETE CASCADE"));
    }

    #[test]
    fn account_activity_lock_key_is_stable_and_account_scoped() {
        let first = uuid::Uuid::from_u128(1);
        let second = uuid::Uuid::from_u128(2);
        assert_eq!(
            account_activity_lock_key(first),
            "account-delete:v1:00000000-0000-0000-0000-000000000001"
        );
        assert_ne!(
            account_activity_lock_key(first),
            account_activity_lock_key(second)
        );
    }
}
