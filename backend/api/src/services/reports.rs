use anyhow::{anyhow, Context, Result};
use chrono::{
    DateTime, Datelike, Duration as ChronoDuration, LocalResult, NaiveDate, TimeZone, Utc,
};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::contracts::JobKind;
use crate::infrastructure::postgres::PostgresClient;
use crate::model::report::{CreateReportScheduleRequest, ReportSchedule};
use crate::services::jobs::JobService;

pub struct ReportService {
    postgres: Option<Arc<PostgresClient>>,
}

/// One occurrence claimed by the durable scheduler.  The delivery worker reads
/// the schedule and period from PostgreSQL using `job_id`; this value is returned
/// for scheduler metrics and controlled worker hand-off only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaimedReportDelivery {
    pub delivery_id: Uuid,
    pub schedule_id: Uuid,
    pub job_id: Uuid,
    pub user_id: Uuid,
    pub report_type: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub occurrence_key: String,
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
        let next_run_at =
            next_schedule_at(Utc::now(), &request.report_type, &timezone, delivery_hour)?;
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO report_schedules
                    (id, user_id, report_type, timezone, delivery_hour, enabled, next_run_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, report_type, timezone, delivery_hour, enabled,
                           last_sent_at, next_run_at, created_at, updated_at",
                &[
                    &id,
                    &user_id,
                    &request.report_type,
                    &timezone,
                    &delivery_hour,
                    &enabled,
                    &next_run_at,
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
                        last_sent_at, next_run_at, created_at, updated_at
                 FROM report_schedules WHERE user_id = $1
                 ORDER BY created_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list report schedules")?;
        rows.into_iter().map(schedule_from_row).collect()
    }

    /// Claim due schedule occurrences without relying on a process-local cron
    /// lock. The schedule row, occurrence ledger and `report.deliver` job/outbox
    /// are committed together, so a crash cannot advance a schedule while losing
    /// the durable job or create two jobs for one period.
    pub async fn claim_due(&self, limit: i64) -> Result<Vec<ClaimedReportDelivery>> {
        // Scheduling is a write path, not merely an inspection path. Keep it
        // closed while the report provider/worker contract is unavailable so a
        // future scheduler process cannot accumulate jobs that no deployed
        // processor can deliver. Existing schedules remain readable and can be
        // deleted while the capability is disabled.
        super::require_background_processor()?;
        if !(1..=1_000).contains(&limit) {
            anyhow::bail!("report scheduler limit must be between 1 and 1000");
        }
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let rows = tx
            .query(
                "SELECT id, user_id, report_type, timezone, delivery_hour, next_run_at
                FROM report_schedules
                WHERE enabled = TRUE AND user_id IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM users u
                       WHERE u.id = report_schedules.user_id
                         AND u.is_active AND u.deleted_at IS NULL
                  )
                   AND next_run_at <= now()
                 ORDER BY next_run_at ASC, id ASC
                 FOR UPDATE SKIP LOCKED
                 LIMIT $1",
                &[&limit],
            )
            .await
            .context("claim due report schedules")?;

        let mut claimed = Vec::with_capacity(rows.len());
        for row in rows {
            let schedule_id: Uuid = row.get("id");
            // Organization schedules remain outside this worker until the report
            // contract defines the recipient set and authorization snapshot. The
            // query filters them out explicitly so one unsupported row cannot
            // prevent account-owned schedules from being delivered.
            let user_id: Uuid = row.get("user_id");
            let report_type: String = row.get("report_type");
            let timezone: String = row.get("timezone");
            let delivery_hour: i16 = row.get("delivery_hour");
            let due_at: DateTime<Utc> = row.get("next_run_at");
            let (period_start, period_end) = report_period(&report_type, &timezone, due_at)?;
            let occurrence_key = report_occurrence_key(schedule_id, period_start, period_end);
            // The occurrence key is the durable identity of this delivery. Derive
            // the row id from it as well so the job parameters remain identical
            // across a scheduler replay or a repair run. A random delivery id
            // would make JobService's idempotency-parameter hash disagree even
            // though the logical occurrence was the same.
            let delivery_id = report_delivery_id(schedule_id, &occurrence_key);
            let params = serde_json::json!({
                "schema_version": 1,
                "report_delivery_id": delivery_id,
                "report_schedule_id": schedule_id,
                "period_start": period_start.to_string(),
                "period_end": period_end.to_string(),
                "occurrence_key": occurrence_key,
            });
            let created_job = JobService::create_in_transaction(
                &tx,
                Some(user_id),
                JobKind::ReportDeliver,
                params,
                Some(&occurrence_key),
            )
            .await
            .context("create report delivery job")?;
            let inserted = tx
                .query_opt(
                    "INSERT INTO report_deliveries
                        (id, schedule_id, period_start, period_end,
                         occurrence_key, async_job_id)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (schedule_id, occurrence_key) DO NOTHING
                     RETURNING id",
                    &[
                        &delivery_id,
                        &schedule_id,
                        &period_start,
                        &period_end,
                        &occurrence_key,
                        &created_job.id,
                    ],
                )
                .await
                .context("record report delivery occurrence")?;
            let delivery_id = if let Some(row) = inserted {
                row.get("id")
            } else {
                let existing = tx
                    .query_one(
                        "SELECT id, async_job_id
                         FROM report_deliveries
                         WHERE schedule_id = $1 AND occurrence_key = $2",
                        &[&schedule_id, &occurrence_key],
                    )
                    .await
                    .context("load existing report delivery occurrence")?;
                let existing_job_id: Uuid = existing.get("async_job_id");
                if existing_job_id != created_job.id {
                    anyhow::bail!("report occurrence is linked to a different job");
                }
                existing.get("id")
            };
            let next_run_at = next_schedule_after(due_at, &report_type, &timezone, delivery_hour)?;
            let updated = tx
                .execute(
                    "UPDATE report_schedules
                     SET next_run_at = $2, updated_at = now()
                     WHERE id = $1 AND enabled = TRUE",
                    &[&schedule_id, &next_run_at],
                )
                .await
                .context("advance report schedule")?;
            if updated != 1 {
                anyhow::bail!("report schedule was disabled while being claimed");
            }
            claimed.push(ClaimedReportDelivery {
                delivery_id,
                schedule_id,
                job_id: created_job.id,
                user_id,
                report_type,
                period_start,
                period_end,
                occurrence_key,
            });
        }
        tx.commit().await.context("commit report schedule claims")?;
        Ok(claimed)
    }

    /// Mark a delivery as attempted without changing its logical outcome. This
    /// is deliberately idempotent so a worker crash after the write can safely
    /// replay the same delivery job.
    pub async fn mark_delivery_attempted(&self, delivery_id: Uuid, job_id: Uuid) -> Result<bool> {
        let updated = self
            .required()?
            .client()
            .execute(
                "UPDATE report_deliveries
                 SET attempted_at = COALESCE(attempted_at, now()), updated_at = now()
                 WHERE id = $1 AND async_job_id = $2 AND status = 'queued'",
                &[&delivery_id, &job_id],
            )
            .await
            .context("mark report delivery attempted")?;
        Ok(updated == 1)
    }

    /// Mark a delivery sent and advance the schedule's last-sent watermark in
    /// one transaction. A repeated completion is a successful no-op; a delivery
    /// linked to another job or already failed is never resurrected.
    pub async fn mark_delivery_sent(&self, delivery_id: Uuid, job_id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "UPDATE report_deliveries
                 SET status = 'sent', delivered_at = COALESCE(delivered_at, now()),
                     updated_at = now()
                 WHERE id = $1 AND async_job_id = $2 AND status = 'queued'
                 RETURNING schedule_id",
                &[&delivery_id, &job_id],
            )
            .await
            .context("mark report delivery sent")?;
        let (schedule_id, newly_sent) = if let Some(row) = row {
            (Some(row.get::<_, Uuid>("schedule_id")), true)
        } else {
            let existing = tx
                .query_opt(
                    "SELECT schedule_id, status
                     FROM report_deliveries
                     WHERE id = $1 AND async_job_id = $2",
                    &[&delivery_id, &job_id],
                )
                .await
                .context("inspect report delivery completion")?;
            let Some(existing) = existing else {
                tx.rollback().await?;
                return Ok(false);
            };
            if existing.get::<_, String>("status") == "sent" {
                // A replay after the original completion is already durable. Do
                // not move `last_sent_at` forward: that watermark represents the
                // actual delivery transition, not the time a duplicate was read.
                (Some(existing.get::<_, Uuid>("schedule_id")), false)
            } else {
                tx.rollback().await?;
                return Ok(false);
            }
        };
        if newly_sent {
            let schedule_id = schedule_id.expect("newly sent report delivery has a schedule");
            tx.execute(
                "UPDATE report_schedules
                 SET last_sent_at = now(), updated_at = now()
                 WHERE id = $1",
                &[&schedule_id],
            )
            .await
            .context("advance report last-sent watermark")?;
        }
        tx.commit().await.context("commit report delivery sent")?;
        Ok(true)
    }

    /// Mark a delivery permanently failed using a bounded operator-facing error
    /// code. Generic job retries remain available until the job service reaches
    /// its terminal state, at which point the domain row is no longer left queued.
    pub async fn mark_delivery_failed(
        &self,
        delivery_id: Uuid,
        job_id: Uuid,
        error_code: &str,
    ) -> Result<bool> {
        validate_error_code(error_code)?;
        let updated = self
            .required()?
            .client()
            .execute(
                "UPDATE report_deliveries
                 SET status = 'failed', failed_at = COALESCE(failed_at, now()),
                     error_code = $3, updated_at = now()
                 WHERE id = $1 AND async_job_id = $2 AND status = 'queued'",
                &[&delivery_id, &job_id, &error_code],
            )
            .await
            .context("mark report delivery failed")?;
        Ok(updated == 1)
    }

    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.execute(
            "UPDATE async_jobs
                    SET status = 'cancelled', finished_at = now(),
                        lease_owner = NULL, lease_expires_at = NULL
                  WHERE id IN (
                      SELECT d.async_job_id
                      FROM report_deliveries d
                      JOIN report_schedules s ON s.id = d.schedule_id
                      WHERE d.schedule_id = $1 AND s.user_id = $2
                  )
                    AND status IN ('queued', 'running')",
            &[&id, &user_id],
        )
        .await
        .context("cancel pending report delivery jobs")?;
        tx.execute(
            "UPDATE report_deliveries
                SET status = 'cancelled', error_code = 'schedule_deleted',
                    updated_at = now()
              WHERE schedule_id = $1 AND status = 'queued'",
            &[&id],
        )
        .await
        .context("cancel pending report deliveries")?;
        let removed = tx
            .execute(
                "DELETE FROM report_schedules WHERE id = $1 AND user_id = $2",
                &[&id, &user_id],
            )
            .await
            .context("failed to delete report schedule")?;
        tx.commit()
            .await
            .context("commit report schedule deletion")?;
        Ok(removed == 1)
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

fn validate_error_code(error_code: &str) -> Result<()> {
    if error_code.is_empty()
        || error_code.len() > 64
        || !error_code
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
    {
        anyhow::bail!("report delivery error code is invalid");
    }
    Ok(())
}

fn report_period(
    report_type: &str,
    timezone: &str,
    due_at: DateTime<Utc>,
) -> Result<(NaiveDate, NaiveDate)> {
    let tz = parse_timezone(timezone)?;
    let local_date = due_at.with_timezone(&tz).date_naive();
    match report_type {
        "daily" => Ok((local_date - ChronoDuration::days(1), local_date)),
        "weekly" => {
            let period_end = local_date
                - ChronoDuration::days(i64::from(local_date.weekday().num_days_from_monday()));
            Ok((period_end - ChronoDuration::days(7), period_end))
        }
        "monthly" => {
            let period_end = first_of_month(local_date);
            Ok((previous_month(period_end), period_end))
        }
        _ => anyhow::bail!("report_type must be daily, weekly or monthly"),
    }
}

fn next_schedule_at(
    now: DateTime<Utc>,
    report_type: &str,
    timezone: &str,
    delivery_hour: i16,
) -> Result<DateTime<Utc>> {
    let tz = parse_timezone(timezone)?;
    validate_delivery_hour(delivery_hour)?;
    let local = now.with_timezone(&tz);
    let today = local.date_naive();
    let candidate_date = match report_type {
        "daily" => today,
        "weekly" => {
            today
                + ChronoDuration::days(i64::from((7 - today.weekday().num_days_from_monday()) % 7))
        }
        "monthly" => first_of_month(today),
        _ => anyhow::bail!("report_type must be daily, weekly or monthly"),
    };
    let candidate = localize_at_hour(&tz, candidate_date, delivery_hour)?;
    if candidate > now {
        return Ok(candidate);
    }
    next_schedule_after(now, report_type, timezone, delivery_hour)
}

fn next_schedule_after(
    due_at: DateTime<Utc>,
    report_type: &str,
    timezone: &str,
    delivery_hour: i16,
) -> Result<DateTime<Utc>> {
    let tz = parse_timezone(timezone)?;
    validate_delivery_hour(delivery_hour)?;
    let local_date = due_at.with_timezone(&tz).date_naive();
    let next_date = match report_type {
        "daily" => local_date + ChronoDuration::days(1),
        "weekly" => local_date + ChronoDuration::days(7),
        "monthly" => first_of_next_month(local_date),
        _ => anyhow::bail!("report_type must be daily, weekly or monthly"),
    };
    localize_at_hour(&tz, next_date, delivery_hour)
}

fn localize_at_hour(
    timezone: &chrono_tz::Tz,
    date: NaiveDate,
    delivery_hour: i16,
) -> Result<DateTime<Utc>> {
    let naive = date
        .and_hms_opt(u32::try_from(delivery_hour)?, 0, 0)
        .context("invalid report delivery time")?;
    match timezone.from_local_datetime(&naive) {
        LocalResult::Single(value) => Ok(value.with_timezone(&Utc)),
        // Pick the earlier instant on a fall-back transition. The next schedule
        // is computed from the local calendar date, so this remains deterministic.
        LocalResult::Ambiguous(earliest, _) => Ok(earliest.with_timezone(&Utc)),
        // A configured hour can fall inside a spring-forward gap. Move forward to
        // the first representable local minute rather than silently dropping it.
        LocalResult::None => {
            for minutes in 1..=180 {
                let shifted = naive + ChronoDuration::minutes(minutes);
                match timezone.from_local_datetime(&shifted) {
                    LocalResult::Single(value) => return Ok(value.with_timezone(&Utc)),
                    LocalResult::Ambiguous(earliest, _) => {
                        return Ok(earliest.with_timezone(&Utc));
                    }
                    LocalResult::None => {}
                }
            }
            anyhow::bail!("report delivery time is not representable in timezone")
        }
    }
}

fn parse_timezone(value: &str) -> Result<chrono_tz::Tz> {
    value
        .parse::<chrono_tz::Tz>()
        .map_err(|_| anyhow!("timezone must be a valid IANA timezone"))
}

fn validate_delivery_hour(hour: i16) -> Result<()> {
    if !(0..=23).contains(&hour) {
        anyhow::bail!("delivery_hour must be between 0 and 23");
    }
    Ok(())
}

fn first_of_month(date: NaiveDate) -> NaiveDate {
    NaiveDate::from_ymd_opt(date.year(), date.month(), 1).expect("valid month start")
}

fn previous_month(date: NaiveDate) -> NaiveDate {
    if date.month() == 1 {
        NaiveDate::from_ymd_opt(date.year() - 1, 12, 1).expect("valid previous month")
    } else {
        NaiveDate::from_ymd_opt(date.year(), date.month() - 1, 1).expect("valid previous month")
    }
}

fn first_of_next_month(date: NaiveDate) -> NaiveDate {
    if date.month() == 12 {
        NaiveDate::from_ymd_opt(date.year() + 1, 1, 1).expect("valid next month")
    } else {
        NaiveDate::from_ymd_opt(date.year(), date.month() + 1, 1).expect("valid next month")
    }
}

fn report_occurrence_key(
    schedule_id: Uuid,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> String {
    format!("report:v1:{schedule_id}:{period_start}:{period_end}")
}

fn report_delivery_id(schedule_id: Uuid, occurrence_key: &str) -> Uuid {
    Uuid::new_v5(
        &schedule_id,
        format!("report-delivery:v1:{occurrence_key}").as_bytes(),
    )
}

fn schedule_from_row(row: Row) -> Result<ReportSchedule> {
    Ok(ReportSchedule {
        id: row.try_get("id")?,
        report_type: row.try_get("report_type")?,
        timezone: row.try_get("timezone")?,
        delivery_hour: row.try_get("delivery_hour")?,
        enabled: row.try_get("enabled")?,
        last_sent_at: row.try_get::<_, Option<DateTime<Utc>>>("last_sent_at")?,
        next_run_at: row.try_get("next_run_at")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_periods_follow_the_schedule_timezone() {
        let due_at = Utc.with_ymd_and_hms(2026, 9, 15, 2, 0, 0).single().unwrap();
        assert_eq!(
            report_period("daily", "Asia/Bangkok", due_at).unwrap(),
            (
                NaiveDate::from_ymd_opt(2026, 9, 14).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 15).unwrap()
            )
        );

        let monday = Utc.with_ymd_and_hms(2026, 9, 14, 2, 0, 0).single().unwrap();
        assert_eq!(
            report_period("weekly", "UTC", monday).unwrap(),
            (
                NaiveDate::from_ymd_opt(2026, 9, 7).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 14).unwrap()
            )
        );
        assert_eq!(
            report_period("monthly", "UTC", monday).unwrap(),
            (
                NaiveDate::from_ymd_opt(2026, 8, 1).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 1).unwrap()
            )
        );
    }

    #[test]
    fn next_schedule_at_is_strictly_after_now_and_dst_safe() {
        let now = Utc.with_ymd_and_hms(2026, 9, 15, 3, 0, 0).single().unwrap();
        let next = next_schedule_at(now, "daily", "UTC", 3).unwrap();
        assert!(next > now);
        assert_eq!(next, Utc.with_ymd_and_hms(2026, 9, 16, 3, 0, 0).unwrap());

        // 02:30 does not exist on this DST transition; the scheduler advances
        // to the first representable local minute instead of dropping it.
        let dst = next_schedule_at(
            Utc.with_ymd_and_hms(2026, 3, 7, 12, 0, 0).unwrap(),
            "daily",
            "America/New_York",
            2,
        )
        .unwrap();
        assert!(dst > Utc.with_ymd_and_hms(2026, 3, 7, 12, 0, 0).unwrap());
    }

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

    #[test]
    fn report_delivery_identity_is_stable_for_one_occurrence() {
        let schedule_id = Uuid::from_u128(7);
        let occurrence = report_occurrence_key(
            schedule_id,
            NaiveDate::from_ymd_opt(2026, 9, 1).unwrap(),
            NaiveDate::from_ymd_opt(2026, 10, 1).unwrap(),
        );
        assert_eq!(
            report_delivery_id(schedule_id, &occurrence),
            report_delivery_id(schedule_id, &occurrence)
        );
        assert_ne!(
            report_delivery_id(schedule_id, &occurrence),
            report_delivery_id(schedule_id, "report:v1:other-occurrence")
        );
        assert_ne!(
            report_delivery_id(schedule_id, &occurrence),
            report_delivery_id(Uuid::from_u128(8), &occurrence)
        );
    }
}
