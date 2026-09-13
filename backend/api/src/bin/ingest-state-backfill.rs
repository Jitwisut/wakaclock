//! Backfill ClickHouse access/project-rule state into PostgreSQL (plan K0.5).
//!
//! Dry-run is the default.  `--apply` is the only mode that writes rows, and
//! output is intentionally limited to counts and mismatch categories.

use anyhow::{Context, Result};
use clap::Parser;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use wakaclock_server::config::Config;
use wakaclock_server::infrastructure::database::ClickHouseClient;
use wakaclock_server::infrastructure::postgres::PostgresClient;
use wakaclock_server::model::project_rule::ProjectRuleRow;
use wakaclock_server::repository::ingest_state::IngestStateRepository;

#[derive(Debug, Parser)]
struct Args {
    /// Actually write missing/mismatched rows.  Without this flag the command is read-only.
    #[arg(long)]
    apply: bool,
}

#[derive(Debug, Deserialize, clickhouse::Row)]
struct AccessRow {
    #[serde(with = "clickhouse::serde::uuid")]
    user_id: Uuid,
    subscription_status: String,
    trial_ends_at: u32,
    subscription_period_end: Option<u32>,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let args = Args::parse();
    let config = Config::from_env()?;
    let postgres = Arc::new(
        PostgresClient::connect(&config.postgres)
            .await
            .context("POSTGRES_URL is required for ingest-state-backfill")?,
    );
    postgres.migrate().await?;
    let clickhouse = Arc::new(ClickHouseClient::new(&config.clickhouse).await?);
    let state = IngestStateRepository::new(postgres.clone());
    let users = clickhouse
        .get_client()
        .query(
            "SELECT user_id, subscription_status, trial_ends_at, subscription_period_end
             FROM wakaclock.users FINAL",
        )
        .fetch_all::<AccessRow>()
        .await
        .context("read ClickHouse access state")?;
    let rules = clickhouse
        .get_client()
        .query(
            "SELECT user_id, rule_id, pattern, project_name, priority, is_active, created_at, updated_at
             FROM wakaclock.project_rules FINAL",
        )
        .fetch_all::<ProjectRuleRow>()
        .await
        .context("read ClickHouse project rules")?;

    let mut access_applied = 0_u64;
    let mut rules_applied = 0_u64;
    let mut missing_identities = 0_u64;
    for row in &users {
        if !state.has_user(row.user_id).await? {
            missing_identities += 1;
            continue;
        }
        if args.apply {
            let trial = chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(row.trial_ends_at), 0);
            let period = row
                .subscription_period_end
                .and_then(|value| chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(value), 0));
            state
                .upsert_access(row.user_id, &row.subscription_status, trial, period)
                .await?;
            access_applied += 1;
        }
    }
    for row in &rules {
        if !state.has_user(row.user_id).await? {
            missing_identities += 1;
            continue;
        }
        if args.apply {
            state.upsert_rule(row).await?;
            rules_applied += 1;
        }
    }

    let pg_access: i64 = postgres
        .query_one("SELECT count(*) FROM user_ingest_access", &[])
        .await?
        .get(0);
    let pg_rules: i64 = postgres
        .query_one("SELECT count(*) FROM project_rules", &[])
        .await?
        .get(0);
    println!("mode={}", if args.apply { "apply" } else { "dry-run" });
    println!("clickhouse_access_rows={}", users.len());
    println!("postgres_access_rows={pg_access}");
    println!("clickhouse_project_rule_rows={}", rules.len());
    println!("postgres_project_rule_rows={pg_rules}");
    println!("mismatch_missing_access={}", users.len().saturating_sub(pg_access as usize));
    println!("mismatch_missing_project_rules={}", rules.len().saturating_sub(pg_rules as usize));
    println!("mismatch_missing_postgres_identity={missing_identities}");
    println!("applied_access_rows={access_applied}");
    println!("applied_project_rule_rows={rules_applied}");
    Ok(())
}
