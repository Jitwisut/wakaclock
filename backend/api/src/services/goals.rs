use anyhow::{anyhow, Context, Result};
use chrono::NaiveDate;
use clickhouse::Row as ClickHouseRow;
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::postgres::PostgresClient;
use crate::model::date_range::ResolvedRange;
use crate::model::goal::{CreateGoalRequest, Goal, GoalProgress, UpdateGoalRequest};
use crate::services::activity_timeline::{ActivityTimelineService, BridgeConfig, Dimension};
use wakaclock_core::heartbeat::ActorType;

pub struct GoalService {
    postgres: Option<Arc<PostgresClient>>,
    clickhouse: Option<Arc<ClickHouseClient>>,
    /// Duration goals are measured against this, not `daily_totals`. See `progress`.
    timeline: Option<ActivityTimelineService>,
}

impl GoalService {
    pub fn with_clickhouse(
        postgres: Option<Arc<PostgresClient>>,
        clickhouse: Arc<ClickHouseClient>,
        bridge: impl Into<BridgeConfig>,
    ) -> Self {
        Self {
            postgres,
            timeline: Some(ActivityTimelineService::new(clickhouse.clone(), bridge)),
            clickhouse: Some(clickhouse),
        }
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Goal>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, name, metric, filter_kind, filter_value, period, target_seconds,
                        direction, timezone, starts_on, ends_on, priority, public,
                        created_at, updated_at
                 FROM goals
                 WHERE user_id = $1
                 ORDER BY priority DESC, created_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list goals")?;
        rows.into_iter().map(goal_from_row).collect()
    }

    pub async fn create(&self, user_id: Uuid, input: CreateGoalRequest) -> Result<Goal> {
        validate_goal(&input)?;
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let timezone = input.timezone.unwrap_or_else(|| "UTC".to_string());
        let priority = input.priority.unwrap_or(0);
        let public = input.public.unwrap_or(false);
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO goals
                    (id, user_id, name, metric, filter_kind, filter_value, period,
                     target_seconds, direction, timezone, starts_on, ends_on, priority, public)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING id, name, metric, filter_kind, filter_value, period, target_seconds,
                           direction, timezone, starts_on, ends_on, priority, public,
                           created_at, updated_at",
                &[
                    &id,
                    &user_id,
                    &input.name,
                    &input.metric,
                    &input.filter_kind,
                    &input.filter_value,
                    &input.period,
                    &input.target_seconds,
                    &input.direction,
                    &timezone,
                    &input.starts_on,
                    &input.ends_on,
                    &priority,
                    &public,
                ],
            )
            .await
            .context("failed to create goal")?;
        goal_from_row(row)
    }

    pub async fn get(&self, user_id: Uuid, goal_id: Uuid) -> Result<Option<Goal>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT id, name, metric, filter_kind, filter_value, period, target_seconds,
                        direction, timezone, starts_on, ends_on, priority, public,
                        created_at, updated_at
                 FROM goals WHERE id = $1 AND user_id = $2",
                &[&goal_id, &user_id],
            )
            .await
            .context("failed to load goal")?;
        row.map(goal_from_row).transpose()
    }

    pub async fn update(
        &self,
        user_id: Uuid,
        goal_id: Uuid,
        input: UpdateGoalRequest,
    ) -> Result<Option<Goal>> {
        let Some(existing) = self.get(user_id, goal_id).await? else {
            return Ok(None);
        };
        let merged = CreateGoalRequest {
            name: input.name.unwrap_or(existing.name),
            metric: input.metric.unwrap_or(existing.metric),
            filter_kind: input.filter_kind.unwrap_or(existing.filter_kind),
            filter_value: input.filter_value.or(existing.filter_value),
            period: input.period.unwrap_or(existing.period),
            target_seconds: input.target_seconds.unwrap_or(existing.target_seconds),
            direction: input.direction.unwrap_or(existing.direction),
            timezone: input.timezone.or(Some(existing.timezone)),
            starts_on: input.starts_on.unwrap_or(existing.starts_on),
            ends_on: input.ends_on.or(existing.ends_on),
            priority: input.priority.or(Some(existing.priority)),
            public: input.public.or(Some(existing.public)),
        };
        validate_goal(&merged)?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_one(
                "UPDATE goals
                 SET name = $3, metric = $4, filter_kind = $5, filter_value = $6,
                     period = $7, target_seconds = $8, direction = $9, timezone = $10,
                     starts_on = $11, ends_on = $12, priority = $13, public = $14,
                     updated_at = now()
                 WHERE id = $1 AND user_id = $2
                 RETURNING id, name, metric, filter_kind, filter_value, period, target_seconds,
                           direction, timezone, starts_on, ends_on, priority, public,
                           created_at, updated_at",
                &[
                    &goal_id,
                    &user_id,
                    &merged.name,
                    &merged.metric,
                    &merged.filter_kind,
                    &merged.filter_value,
                    &merged.period,
                    &merged.target_seconds,
                    &merged.direction,
                    &merged.timezone.unwrap_or_else(|| "UTC".to_string()),
                    &merged.starts_on,
                    &merged.ends_on,
                    &merged.priority.unwrap_or(0),
                    &merged.public.unwrap_or(false),
                ],
            )
            .await
            .context("failed to update goal")?;
        goal_from_row(row).map(Some)
    }

    pub async fn progress(&self, user_id: Uuid, goal_id: Uuid) -> Result<Option<GoalProgress>> {
        let Some(goal) = self.get(user_id, goal_id).await? else {
            return Ok(None);
        };
        let clickhouse = self
            .clickhouse
            .as_deref()
            .ok_or_else(|| anyhow!("ClickHouse is required to calculate goal progress"))?;
        let today = ResolvedRange::today_date_string(Some(&goal.timezone))
            .map_err(|error| anyhow!(error.to_string()))?
            .parse::<NaiveDate>()?;
        let mut start = goal.starts_on;
        let period_days = match goal.period.as_str() {
            "daily" => 1,
            "weekly" => 7,
            "monthly" => 30,
            _ => 1,
        };
        let period_start = today - chrono::Duration::days(period_days - 1);
        if period_start > start {
            start = period_start;
        }
        let end = goal.ends_on.unwrap_or(today).min(today);
        if end < start {
            return Ok(Some(GoalProgress {
                goal_id,
                period: goal.period,
                current_seconds: 0.0,
                target_seconds: goal.target_seconds,
                percentage: 0.0,
                direction: goal.direction.clone(),
                on_track: goal.direction == "maximum",
                coverage: 0.0,
            }));
        }

        #[derive(Debug, ClickHouseRow, serde::Deserialize)]
        struct ProgressRow {
            value: f64,
            samples: u64,
        }

        // Every duration metric comes from the canonical timeline. Reading `daily_totals`
        // meant a "code 4 hours today" goal was measured against a `sum(active_seconds)`
        // rollup — a different number from the one the dashboard showed the user, and one
        // that a `SummingMergeTree` can leave permanently high after any repair. Only the
        // heartbeat-count metric is still a genuine row count. See
        // docs/duration-accuracy-audit.md, Finding 4.
        let row = match goal.metric.as_str() {
            "heartbeats" => {
                let (start_epoch, end_epoch) = goal_period_bounds(start, end, &goal.timezone)?;
                let (query, bind_filter) = progress_query(&goal);
                let mut request = clickhouse
                    .get_client()
                    .query(&query)
                    .bind(user_id)
                    .bind(start_epoch)
                    .bind(end_epoch);
                if let Some(filter) = bind_filter {
                    request = request.bind(filter);
                }
                request
                    .fetch_one::<ProgressRow>()
                    .await
                    .context("failed to calculate goal progress")?
            }
            _ => {
                let (start_epoch, end_epoch) = goal_period_bounds(start, end, &goal.timezone)?;
                let canonical = self
                    .timeline
                    .as_ref()
                    .ok_or_else(|| anyhow!("timeline is required to calculate goal progress"))?
                    .canonical(user_id, start_epoch, end_epoch)
                    .await?;
                let mut value = 0.0;
                let mut heartbeats = std::collections::HashSet::new();
                for interval in &canonical {
                    if !goal_matches(&goal, interval) {
                        continue;
                    }
                    value += interval.end - interval.start;
                    heartbeats.insert(interval.heartbeat_id.as_str());
                }
                ProgressRow {
                    value,
                    samples: heartbeats.len() as u64,
                }
            }
        };
        let percentage = if goal.target_seconds > 0 {
            (row.value / goal.target_seconds as f64 * 100.0).min(100.0)
        } else if row.value > 0.0 {
            100.0
        } else {
            0.0
        };
        let on_track = if goal.direction == "minimum" {
            row.value >= goal.target_seconds as f64
        } else {
            row.value <= goal.target_seconds as f64
        };
        Ok(Some(GoalProgress {
            goal_id,
            period: goal.period,
            current_seconds: row.value,
            target_seconds: goal.target_seconds,
            percentage,
            direction: goal.direction,
            on_track,
            coverage: if row.samples > 0 { 1.0 } else { 0.0 },
        }))
    }

    pub async fn delete(&self, user_id: Uuid, goal_id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let deleted = postgres
            .client()
            .execute(
                "DELETE FROM goals WHERE id = $1 AND user_id = $2",
                &[&goal_id, &user_id],
            )
            .await
            .context("failed to delete goal")?;
        Ok(deleted == 1)
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate_goal(input: &CreateGoalRequest) -> Result<()> {
    if input.name.trim().is_empty() || input.name.len() > 160 {
        return Err(anyhow!("goal name must contain 1-160 characters"));
    }
    if !matches!(
        input.metric.as_str(),
        "time" | "manual_time" | "ai_time" | "heartbeats"
    ) {
        return Err(anyhow!("unsupported goal metric"));
    }
    if !matches!(
        input.filter_kind.as_str(),
        "project" | "language" | "category" | "editor" | "all"
    ) {
        return Err(anyhow!("unsupported goal filter"));
    }
    if !matches!(input.period.as_str(), "daily" | "weekly" | "monthly") {
        return Err(anyhow!("unsupported goal period"));
    }
    if !matches!(input.direction.as_str(), "minimum" | "maximum") {
        return Err(anyhow!("goal direction must be minimum or maximum"));
    }
    if input.target_seconds < 0 {
        return Err(anyhow!("target_seconds cannot be negative"));
    }
    if input.ends_on.is_some_and(|end| end < input.starts_on) {
        return Err(anyhow!("ends_on must be on or after starts_on"));
    }
    if let Some(timezone) = input.timezone.as_deref() {
        ResolvedRange::today_date_string(Some(timezone))
            .map_err(|error| anyhow!(error.to_string()))?;
    }
    Ok(())
}

/// Inclusive goal-period days as epoch bounds, matching the `date BETWEEN ? AND ?` the
/// heartbeat-count metric still uses.
fn goal_period_bounds(
    start: chrono::NaiveDate,
    end: chrono::NaiveDate,
    timezone: &str,
) -> Result<(f64, f64)> {
    let range = ResolvedRange::parse(&start.to_string(), &end.to_string(), Some(timezone))
        .map_err(|error| anyhow!(error.to_string()))?;
    Ok(range.unix_bounds())
}

/// Does this interval count towards the goal?
///
/// `ai_time` and `manual_time` split on the interval's canonical actor type, which is the same
/// attribution the evidence split reports — a goal and the dashboard can no longer
/// disagree about which seconds were the developer's.
fn goal_matches(
    goal: &Goal,
    interval: &crate::services::activity_timeline::CanonicalInterval,
) -> bool {
    let metric_ok = match goal.metric.as_str() {
        "ai_time" => interval.actor_type.is_ai(),
        "manual_time" => interval.actor_type == ActorType::Human,
        _ => true,
    };
    if !metric_ok {
        return false;
    }
    let Some(wanted) = goal.filter_value.as_deref() else {
        return goal.filter_kind == "all";
    };
    if goal.filter_kind == "all" {
        return true;
    }
    let dimension = match goal.filter_kind.as_str() {
        "language" => Dimension::Language,
        "category" => Dimension::Category,
        "editor" => Dimension::Editor,
        _ => Dimension::Project,
    };
    dimension.value_of(interval) == wanted
}

fn progress_query(goal: &Goal) -> (String, Option<String>) {
    let filter = goal.filter_value.clone();
    let value_expression = match goal.metric.as_str() {
        "heartbeats" => "count()",
        "ai_time" => {
            "sumIf(ifNull(active_seconds, 0.0), actor_type IN ('ai_verified', 'ai_inferred'))"
        }
        "manual_time" => "sumIf(ifNull(active_seconds, 0.0), actor_type = 'human')",
        _ => "sum(ifNull(active_seconds, 0.0))",
    };
    if goal.filter_kind == "all" {
        if goal.metric == "heartbeats" {
            return (
                "SELECT count() AS value, count() AS samples
                 FROM wakaclock.heartbeats_canonical
                 WHERE user_id = ? AND time >= ? AND time < ?"
                    .to_string(),
                None,
            );
        }
        return (
            format!(
                "SELECT {value_expression} AS value, count() AS samples
                 FROM wakaclock.heartbeats_canonical
                 WHERE user_id = ? AND time >= ? AND time < ?"
            ),
            None,
        );
    }
    let dimension = match goal.filter_kind.as_str() {
        "project" => "project",
        "language" => "language",
        "category" => "toString(category)",
        "editor" => "editor",
        _ => "project",
    };
    let query = format!(
        "SELECT {value_expression} AS value, count() AS samples
         FROM wakaclock.heartbeats_canonical
         WHERE user_id = ? AND time >= ? AND time < ? AND {dimension} = ?"
    );
    (query, filter)
}

fn goal_from_row(row: Row) -> Result<Goal> {
    Ok(Goal {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        metric: row.try_get("metric")?,
        filter_kind: row.try_get("filter_kind")?,
        filter_value: row.try_get("filter_value")?,
        period: row.try_get("period")?,
        target_seconds: row.try_get("target_seconds")?,
        direction: row.try_get("direction")?,
        timezone: row.try_get("timezone")?,
        starts_on: row.try_get::<_, NaiveDate>("starts_on")?,
        ends_on: row.try_get::<_, Option<NaiveDate>>("ends_on")?,
        priority: row.try_get("priority")?,
        public: row.try_get("public")?,
        created_at: row
            .try_get::<_, chrono::DateTime<chrono::Utc>>("created_at")?
            .naive_utc(),
        updated_at: row
            .try_get::<_, chrono::DateTime<chrono::Utc>>("updated_at")?
            .naive_utc(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> CreateGoalRequest {
        CreateGoalRequest {
            name: "Daily Rust".to_string(),
            metric: "time".to_string(),
            filter_kind: "language".to_string(),
            filter_value: Some("Rust".to_string()),
            period: "daily".to_string(),
            target_seconds: 3_600,
            direction: "minimum".to_string(),
            timezone: Some("Asia/Bangkok".to_string()),
            starts_on: NaiveDate::from_ymd_opt(2026, 8, 23).unwrap(),
            ends_on: None,
            priority: Some(1),
            public: Some(false),
        }
    }

    #[test]
    fn validates_goal_contract() {
        assert!(validate_goal(&request()).is_ok());
        let mut invalid = request();
        invalid.metric = "unknown".to_string();
        assert!(validate_goal(&invalid).is_err());
    }
}
