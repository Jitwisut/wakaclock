//! Backfill ClickHouse access/project-rule state into PostgreSQL (plan K0.5).
//!
//! Dry-run is the default.  `--apply` is the only mode that writes rows, and
//! output is intentionally limited to counts and mismatch categories.

use anyhow::{Context, Result};
use clap::Parser;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use wakaclock_server::config::Config;
use wakaclock_server::infrastructure::database::ClickHouseClient;
use wakaclock_server::infrastructure::postgres::PostgresClient;
use wakaclock_server::model::project_rule::ProjectRuleRow;
use wakaclock_server::repository::ingest_state::{AccessState, IngestStateRepository};

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

#[derive(Debug, Default, PartialEq, Eq)]
struct RuleParity {
    missing_in_postgres: usize,
    extra_in_postgres: usize,
    mismatched: usize,
}

#[derive(Debug, Default, PartialEq, Eq)]
struct AccessParity {
    missing_in_postgres: usize,
    extra_in_postgres: usize,
    mismatched: usize,
}

fn epoch(value: u32) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(value), 0)
}

fn access_matches(clickhouse: &AccessRow, postgres: &AccessState) -> bool {
    clickhouse.subscription_status == postgres.status
        && epoch(clickhouse.trial_ends_at) == postgres.trial_ends_at
        && clickhouse.subscription_period_end.and_then(epoch) == postgres.subscription_period_end
}

fn compare_access(clickhouse: &[AccessRow], postgres: &HashMap<Uuid, AccessState>) -> AccessParity {
    let clickhouse_users: HashSet<Uuid> = clickhouse.iter().map(|row| row.user_id).collect();
    let mut parity = AccessParity {
        extra_in_postgres: postgres
            .keys()
            .filter(|user_id| !clickhouse_users.contains(user_id))
            .count(),
        ..AccessParity::default()
    };
    for row in clickhouse {
        match postgres.get(&row.user_id) {
            None => parity.missing_in_postgres += 1,
            Some(mirror) if !access_matches(row, mirror) => parity.mismatched += 1,
            Some(_) => {}
        }
    }
    parity
}

fn rule_matches(left: &ProjectRuleRow, right: &ProjectRuleRow) -> bool {
    left.user_id == right.user_id
        && left.rule_id == right.rule_id
        && left.pattern == right.pattern
        && left.project_name == right.project_name
        && left.priority == right.priority
        && left.is_active == right.is_active
}

fn compare_rules(clickhouse: &[ProjectRuleRow], postgres: &[ProjectRuleRow]) -> RuleParity {
    let mut postgres_by_key: HashMap<(Uuid, Uuid), &ProjectRuleRow> = postgres
        .iter()
        .map(|row| ((row.user_id, row.rule_id), row))
        .collect();
    let mut parity = RuleParity::default();
    for row in clickhouse {
        match postgres_by_key.remove(&(row.user_id, row.rule_id)) {
            None => parity.missing_in_postgres += 1,
            Some(mirror) if !rule_matches(row, mirror) => parity.mismatched += 1,
            Some(_) => {}
        }
    }
    parity.extra_in_postgres = postgres_by_key.len();
    parity
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

    let postgres_access_before = state.list_access().await?;
    let postgres_rules_before = state.list_rules_all().await?;
    let access_parity_before = compare_access(&users, &postgres_access_before);
    let mut missing_identities = HashSet::new();
    let rule_parity = compare_rules(&rules, &postgres_rules_before);
    let mut access_applied = 0_u64;
    let mut rules_applied = 0_u64;
    for row in &users {
        if !state.has_user(row.user_id).await? {
            missing_identities.insert(row.user_id);
            continue;
        }
        if args.apply {
            let trial =
                chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(row.trial_ends_at), 0);
            let period = row.subscription_period_end.and_then(|value| {
                chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(value), 0)
            });
            state
                .upsert_access(row.user_id, &row.subscription_status, trial, period)
                .await?;
            access_applied += 1;
        }
    }
    for row in &rules {
        if !state.has_user(row.user_id).await? {
            missing_identities.insert(row.user_id);
            continue;
        }
        if args.apply {
            state.upsert_rule(row).await?;
            rules_applied += 1;
        }
    }

    let postgres_access_after = state.list_access().await?;
    let postgres_rules_after = state.list_rules_all().await?;
    let access_parity_after = compare_access(&users, &postgres_access_after);
    let rule_parity_after = compare_rules(&rules, &postgres_rules_after);
    println!("mode={}", if args.apply { "apply" } else { "dry-run" });
    println!("clickhouse_access_rows={}", users.len());
    println!("postgres_access_rows={}", postgres_access_after.len());
    println!("clickhouse_project_rule_rows={}", rules.len());
    println!("postgres_project_rule_rows={}", postgres_rules_after.len());
    println!(
        "mismatch_before_missing_access={}",
        access_parity_before.missing_in_postgres
    );
    println!(
        "mismatch_before_extra_access={}",
        access_parity_before.extra_in_postgres
    );
    println!(
        "mismatch_before_access_values={}",
        access_parity_before.mismatched
    );
    println!(
        "mismatch_before_missing_project_rules={}",
        rule_parity.missing_in_postgres
    );
    println!(
        "mismatch_before_extra_project_rules={}",
        rule_parity.extra_in_postgres
    );
    println!(
        "mismatch_before_project_rule_values={}",
        rule_parity.mismatched
    );
    println!(
        "mismatch_after_missing_access={}",
        access_parity_after.missing_in_postgres
    );
    println!(
        "mismatch_after_extra_access={}",
        access_parity_after.extra_in_postgres
    );
    println!(
        "mismatch_after_access_values={}",
        access_parity_after.mismatched
    );
    println!(
        "mismatch_after_missing_project_rules={}",
        rule_parity_after.missing_in_postgres
    );
    println!(
        "mismatch_after_extra_project_rules={}",
        rule_parity_after.extra_in_postgres
    );
    println!(
        "mismatch_after_project_rule_values={}",
        rule_parity_after.mismatched
    );
    println!(
        "mismatch_missing_postgres_identity={}",
        missing_identities.len()
    );
    println!("applied_access_rows={access_applied}");
    println!("applied_project_rule_rows={rules_applied}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(user_id: Uuid, rule_id: Uuid, project_name: &str) -> ProjectRuleRow {
        ProjectRuleRow {
            user_id,
            rule_id,
            pattern: "src/.*".to_string(),
            project_name: project_name.to_string(),
            priority: 10,
            is_active: true,
            created_at: 100,
            updated_at: 200,
        }
    }

    #[test]
    fn access_parity_compares_values_not_only_row_counts() {
        let clickhouse = AccessRow {
            user_id: Uuid::now_v7(),
            subscription_status: "active".to_string(),
            trial_ends_at: 1_700_000_000,
            subscription_period_end: Some(1_800_000_000),
        };
        let matching = AccessState {
            status: "active".to_string(),
            trial_ends_at: epoch(clickhouse.trial_ends_at),
            subscription_period_end: epoch(clickhouse.subscription_period_end.unwrap()),
        };
        assert!(access_matches(&clickhouse, &matching));

        let mut changed = matching.clone();
        changed.status = "trialing".to_string();
        assert!(!access_matches(&clickhouse, &changed));

        let mut mirror = HashMap::new();
        mirror.insert(clickhouse.user_id, changed);
        mirror.insert(Uuid::now_v7(), matching);
        assert_eq!(
            compare_access(&[clickhouse], &mirror),
            AccessParity {
                missing_in_postgres: 0,
                extra_in_postgres: 1,
                mismatched: 1,
            }
        );
    }

    #[test]
    fn rule_parity_reports_missing_extra_and_value_mismatches() {
        let user = Uuid::now_v7();
        let present = Uuid::now_v7();
        let missing = Uuid::now_v7();
        let extra = Uuid::now_v7();
        let clickhouse = vec![rule(user, present, "alpha"), rule(user, missing, "beta")];
        let postgres = vec![rule(user, present, "changed"), rule(user, extra, "gamma")];
        assert_eq!(
            compare_rules(&clickhouse, &postgres),
            RuleParity {
                missing_in_postgres: 1,
                extra_in_postgres: 1,
                mismatched: 1,
            }
        );
    }
}
