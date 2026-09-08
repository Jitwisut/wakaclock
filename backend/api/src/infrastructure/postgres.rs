//! PostgreSQL transactional store for AtoAxis product state.
//!
//! ClickHouse remains the telemetry/analytics store. This client intentionally exposes only
//! connection, migration and health primitives for the first foundation slice; feature
//! repositories can be added without allowing request handlers to talk to a raw database
//! connection directly.

use anyhow::{Context, Result};
use tokio_postgres::{Client, NoTls};

use crate::config::PostgresConfig;

const FOUNDATION_MIGRATION: &str =
    include_str!("../../migrations/postgres/001_phase10_foundation.sql");
const PRESENCE_MIGRATION: &str = include_str!("../../migrations/postgres/002_presence_v2.sql");
const AI_DIAGNOSTICS_MIGRATION: &str =
    include_str!("../../migrations/postgres/003_ai_diagnostics.sql");

pub struct PostgresClient {
    client: Client,
}

impl PostgresClient {
    pub async fn connect(config: &PostgresConfig) -> Result<Self> {
        let url = config
            .url
            .as_deref()
            .context("POSTGRES_URL is required to initialize PostgreSQL")?;

        let (client, connection) = tokio_postgres::connect(url, NoTls)
            .await
            .with_context(|| format!("failed to connect to PostgreSQL at {url}"))?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(%error, "PostgreSQL connection task stopped");
            }
        });

        Ok(Self { client })
    }

    pub async fn migrate(&self) -> Result<()> {
        self.client
            .batch_execute(FOUNDATION_MIGRATION)
            .await
            .context("failed to apply PostgreSQL Phase 10 foundation migration")?;
        self.client
            .batch_execute(PRESENCE_MIGRATION)
            .await
            .context("failed to apply PostgreSQL Presence v2 migration")?;
        self.client
            .batch_execute(AI_DIAGNOSTICS_MIGRATION)
            .await
            .context("failed to apply PostgreSQL AI diagnostics migration")
    }

    pub async fn health_check(&self) -> Result<()> {
        self.client
            .query_one("SELECT 1", &[])
            .await
            .context("PostgreSQL health check failed")?;
        Ok(())
    }

    pub fn client(&self) -> &Client {
        &self.client
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
