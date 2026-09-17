use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::account_analytics::AccountProjectionRebuildData;
use crate::model::date_range::MAX_RANGE_DAYS;
use crate::repository::account_analytics::AccountAnalyticsRepository;

pub struct AccountAnalyticsService {
    repo: Arc<AccountAnalyticsRepository>,
}

impl AccountAnalyticsService {
    pub fn new(repo: Arc<AccountAnalyticsRepository>) -> Self {
        Self { repo }
    }

    pub async fn rebuild(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<AccountProjectionRebuildData> {
        validate_date_range(start, end)?;
        let (source_heartbeats, source_usage_events) =
            self.repo.source_counts(user_id, start, end).await?;
        // UTC microseconds make versions monotonically sortable and unique in normal
        // operation without a central counter. The publish pointer, not insertion time,
        // controls what readers see.
        let data_version = chrono::Utc::now().timestamp_micros().max(0) as u64;
        self.repo
            .build_snapshot(user_id, start, end, data_version)
            .await?;
        self.repo
            .publish_snapshot(user_id, start, end, data_version, data_version)
            .await?;

        Ok(AccountProjectionRebuildData {
            user_id,
            start: start.to_string(),
            end: end.to_string(),
            data_version,
            source_heartbeats,
            source_usage_events,
        })
    }

    /// Validate a queued rebuild before a worker claims it. Keeping the pure
    /// validation next to the synchronous implementation prevents the async
    /// worker from accepting a range that the direct path would reject.
    pub fn validate_request(start: &str, end: &str) -> Result<()> {
        validate_date_range(start, end)
    }
}

fn validate_date_range(start: &str, end: &str) -> Result<()> {
    let start_date = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .context("Invalid start date format, expected YYYY-MM-DD")?;
    let end_date = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")
        .context("Invalid end date format, expected YYYY-MM-DD")?;
    if start_date > end_date {
        anyhow::bail!("start must be less than or equal to end");
    }
    let days = (end_date - start_date).num_days() + 1;
    if days > MAX_RANGE_DAYS {
        anyhow::bail!("range of {days} days exceeds the {MAX_RANGE_DAYS}-day maximum");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_date_range;

    #[test]
    fn rebuild_range_requires_ordered_iso_dates() {
        assert!(validate_date_range("2026-08-01", "2026-08-31").is_ok());
        assert!(validate_date_range("2026-08-31", "2026-08-01").is_err());
        assert!(validate_date_range("not-a-date", "2026-08-01").is_err());
    }
}
