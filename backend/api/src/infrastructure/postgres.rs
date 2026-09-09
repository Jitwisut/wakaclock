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

pub struct PostgresClient {
    pool: Pool,
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
            .max_size(config.max_connections.max(1) as usize)
            .runtime(Runtime::Tokio1)
            .wait_timeout(Some(Duration::from_secs(10)))
            .create_timeout(Some(Duration::from_secs(10)))
            .recycle_timeout(Some(Duration::from_secs(10)))
            .build()
            .context("failed to create PostgreSQL pool")?;
        let store = Self { pool };
        store
            .health_check()
            .await
            .context("failed to connect to PostgreSQL")?;
        Ok(store)
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
            ("AI diagnostics", AI_DIAGNOSTICS_MIGRATION),
            ("early access", EARLY_ACCESS_MIGRATION),
            (
                "credential migrations",
                include_str!("../../migrations/postgres/005_credential_migrations.sql"),
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
    }
}
