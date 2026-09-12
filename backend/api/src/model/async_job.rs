//! Types for owner-triggered background jobs (plans/plan-kafka-rabbitmq-adoption.md, R2).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
    DeadLettered,
    Cancelled,
}

impl JobStatus {
    pub fn parse(raw: &str) -> Option<Self> {
        Some(match raw {
            "queued" => JobStatus::Queued,
            "running" => JobStatus::Running,
            "succeeded" => JobStatus::Succeeded,
            "failed" => JobStatus::Failed,
            "dead_lettered" => JobStatus::DeadLettered,
            "cancelled" => JobStatus::Cancelled,
            _ => return None,
        })
    }
}

/// A job as its owner sees it through `GET /api/v2/jobs/:job_id`. It exposes state
/// and a sanitized error code only — never broker routing, worker hostnames or a
/// serialized message body.
#[derive(Debug, Clone, Serialize)]
pub struct AsyncJobView {
    pub id: Uuid,
    /// The routing key, e.g. `analytics.reprocess`.
    pub kind: String,
    pub status: JobStatus,
    pub attempt: i16,
    pub requested_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
}

/// The outcome of `JobService::create`: a fresh job, or the one an earlier call with
/// the same `Idempotency-Key` already produced.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreatedJob {
    pub id: Uuid,
    pub status: JobStatus,
    /// `true` when this call matched an existing job and wrote nothing.
    pub deduplicated: bool,
}
