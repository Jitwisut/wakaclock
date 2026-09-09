use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::report::{CreateReportScheduleRequest, ReportSchedule};

pub struct ReportService {
    postgres: Option<Arc<PostgresClient>>,
}

impl ReportService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        request: CreateReportScheduleRequest,
    ) -> Result<ReportSchedule> {
        super::require_background_processor()?;
        validate(&request)?;
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let timezone = request.timezone.unwrap_or_else(|| "UTC".to_string());
        let delivery_hour = request.delivery_hour.unwrap_or(9);
        let enabled = request.enabled.unwrap_or(true);
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO report_schedules
                    (id, user_id, report_type, timezone, delivery_hour, enabled)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, report_type, timezone, delivery_hour, enabled,
                           last_sent_at, created_at",
                &[
                    &id,
                    &user_id,
                    &request.report_type,
                    &timezone,
                    &delivery_hour,
                    &enabled,
                ],
            )
            .await
            .context("failed to create report schedule")?;
        schedule_from_row(row)
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ReportSchedule>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, report_type, timezone, delivery_hour, enabled,
                        last_sent_at, created_at
                 FROM report_schedules WHERE user_id = $1
                 ORDER BY created_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list report schedules")?;
        rows.into_iter().map(schedule_from_row).collect()
    }

    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let deleted = postgres
            .client()
            .execute(
                "DELETE FROM report_schedules WHERE id = $1 AND user_id = $2",
                &[&id, &user_id],
            )
            .await
            .context("failed to delete report schedule")?;
        Ok(deleted == 1)
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate(request: &CreateReportScheduleRequest) -> Result<()> {
    if !matches!(request.report_type.as_str(), "daily" | "weekly" | "monthly") {
        return Err(anyhow!("report_type must be daily, weekly or monthly"));
    }
    if request
        .delivery_hour
        .is_some_and(|hour| !(0..=23).contains(&hour))
    {
        return Err(anyhow!("delivery_hour must be between 0 and 23"));
    }
    if let Some(timezone) = &request.timezone {
        timezone
            .parse::<chrono_tz::Tz>()
            .map_err(|_| anyhow!("timezone must be a valid IANA timezone"))?;
    }
    Ok(())
}

fn schedule_from_row(row: Row) -> Result<ReportSchedule> {
    Ok(ReportSchedule {
        id: row.try_get("id")?,
        report_type: row.try_get("report_type")?,
        timezone: row.try_get("timezone")?,
        delivery_hour: row.try_get("delivery_hour")?,
        enabled: row.try_get("enabled")?,
        last_sent_at: row.try_get::<_, Option<DateTime<Utc>>>("last_sent_at")?,
        created_at: row.try_get("created_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_schedule_validation_is_strict() {
        assert!(validate(&CreateReportScheduleRequest {
            report_type: "weekly".into(),
            timezone: Some("Asia/Bangkok".into()),
            delivery_hour: Some(9),
            enabled: Some(true),
        })
        .is_ok());
        assert!(validate(&CreateReportScheduleRequest {
            report_type: "hourly".into(),
            timezone: None,
            delivery_hour: None,
            enabled: None,
        })
        .is_err());
    }
}
