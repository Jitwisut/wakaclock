//! Authenticated ingestion for the sanitized AI token/session stream.
//!
//! The payload contains event ids, timestamps, model names and numeric usage only. It
//! intentionally has no prompt, response, patch, file path or source-code fields.

use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::{AiUsageEventV1, EventTopic};
use crate::middleware::auth;
use crate::model::ai_usage::AiUsageIngestReport;
use crate::services::ai_usage::{prepare_batch, AiUsageBatchError};
use tracing::{error, warn};
use wakaclock_core::ai::{AiUsageIngestReportV2, AiUsageProcessingState, AiUsageRecord};

const MAX_USAGE_EVENTS_PER_REQUEST: usize = 2_000;
const CONTRACT_V2: &str = "2";

/// POST /api/v1/ai/usage
///
/// Usage events are keyed by the provider's stable message id and the authenticated
/// caller is always assigned server-side. Replaying a transcript is therefore safe.
pub async fn ingest(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(records): Json<Vec<AiUsageRecord>>,
) -> Result<Response, Response> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(|| auth::unauthorized().into_response())?;
    if !auth::require_scope(&state, &headers, "write_logged_time").await {
        return Err(auth::forbidden_scope("write_logged_time").into_response());
    }
    let record_count = records.len();

    if records.len() > MAX_USAGE_EVENTS_PER_REQUEST {
        return Err(app_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            &format!("at most {MAX_USAGE_EVENTS_PER_REQUEST} usage events per request"),
        ));
    }
    for record in &records {
        record
            .validate()
            .map_err(|message| app_error(StatusCode::BAD_REQUEST, &message))?;
    }

    let contract_v2 = headers
        .get("X-AtoAxis-Ai-Usage-Contract")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.trim() == CONTRACT_V2);
    let usage_config = &state.config.brokers.ai_usage;
    // A direct rollback is deliberately self-healing: an operator may deploy the
    // old path before every stale contract flag has been cleared. The v2 gate only
    // applies while the stream is being verified or cut over to Kafka.
    if usage_config.require_contract_v2
        && usage_config.mode != crate::config::brokers::IngestMode::Direct
        && !contract_v2
    {
        return Err(app_error(
            StatusCode::UPGRADE_REQUIRED,
            "AI usage contract v2 is required",
        ));
    }

    let prepared = prepare_batch(&records).map_err(|error| match error {
        AiUsageBatchError::IdentityConflict(id) => app_error(
            StatusCode::CONFLICT,
            &format!("usage_event_id {id} has conflicting payloads"),
        ),
        AiUsageBatchError::Validation(message) => app_error(StatusCode::BAD_REQUEST, &message),
        AiUsageBatchError::Serialization(_) => {
            app_error(StatusCode::BAD_REQUEST, "invalid AI usage payload")
        }
    })?;
    let received = records.len();
    let accepted = prepared.records.len();
    let duplicates_in_batch = prepared.duplicates_in_batch;

    let in_kafka_cohort = usage_config
        .kafka_cohort
        .as_ref()
        .is_some_and(|cohort| cohort.includes(user_id));
    let kafka_path = usage_config.mode == crate::config::brokers::IngestMode::Kafka
        && in_kafka_cohort
        && contract_v2;

    if kafka_path {
        let events = build_kafka_events(user_id, &prepared.records)
            .map_err(|message| app_error(StatusCode::BAD_REQUEST, &message))?;
        let bus = state.event_bus.as_ref().ok_or_else(|| {
            app_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "AI usage event bus is not configured",
            )
        })?;
        if let Err(error) = bus.publish_batch(EventTopic::AiUsage, &events).await {
            warn!(%user_id, record_count = accepted, %error, "AI usage Kafka publish failed");
            return Err(with_retry_after(
                StatusCode::SERVICE_UNAVAILABLE,
                "AI usage event publish failed",
            ));
        }
        return Ok(v2_response(
            StatusCode::ACCEPTED,
            AiUsageIngestReportV2 {
                contract_version: 2,
                processing_state: AiUsageProcessingState::Pending,
                received,
                accepted,
                duplicates_in_batch,
                stored: None,
                unpriced: None,
                sessions_touched: None,
            },
        ));
    }

    let report = state
        .ai_usage_service
        .ingest(user_id, prepared.records.clone())
        .await
        .map_err(|error| {
            // The trace middleware can only report the resulting 500. Keep the
            // actual bounded service/ClickHouse error in the server log so an
            // operator can fix the failing phase instead of guessing from a
            // repeated status code.
            error!(
                %user_id,
                record_count,
                error = %error,
                "AI usage ingest failed"
            );
            if error.to_string().contains("usage_identity_conflict") {
                app_error(
                    StatusCode::CONFLICT,
                    "usage_event_id conflicts with an existing payload",
                )
            } else {
                app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
            }
        })?;

    if usage_config.mode == crate::config::brokers::IngestMode::Verify {
        let events = build_kafka_events(user_id, &prepared.records)
            .map_err(|message| app_error(StatusCode::BAD_REQUEST, &message))?;
        if let Some(bus) = state.event_bus.as_ref() {
            if let Err(error) = bus.publish_batch(EventTopic::AiUsage, &events).await {
                // Verify mode is intentionally observational: direct storage already
                // succeeded, so Kafka failure is logged/metriced but never changes the
                // successful HTTP result.
                warn!(%user_id, %error, "AI usage verify publish failed after direct storage");
            }
        }
    }

    if contract_v2 {
        Ok(v2_response(
            StatusCode::OK,
            AiUsageIngestReportV2 {
                contract_version: 2,
                processing_state: AiUsageProcessingState::Stored,
                received,
                accepted,
                duplicates_in_batch,
                stored: Some(report.stored),
                unpriced: Some(report.unpriced),
                sessions_touched: Some(report.sessions_touched),
            },
        ))
    } else {
        Ok(Json(AiUsageIngestReport {
            received,
            stored: report.stored,
            duplicates_in_batch,
            unpriced: report.unpriced,
            sessions_touched: report.sessions_touched,
        })
        .into_response())
    }
}

fn build_kafka_events(
    user_id: uuid::Uuid,
    records: &[AiUsageRecord],
) -> Result<Vec<crate::infrastructure::contracts::EventEnvelope>, String> {
    records
        .iter()
        .cloned()
        .map(|record| {
            AiUsageEventV1::from_record(record)
                .and_then(|event| event.event_for_tenant(user_id, Some("api")))
                .map_err(|error| {
                    error!(%user_id, %error, "could not build AI usage Kafka envelope");
                    "invalid AI usage event".to_string()
                })
        })
        .collect()
}

fn v2_response(status: StatusCode, report: AiUsageIngestReportV2) -> Response {
    (status, Json(report)).into_response()
}

fn with_retry_after(status: StatusCode, message: &str) -> Response {
    let mut response = app_error(status, message);
    response.headers_mut().insert(
        header::RETRY_AFTER,
        axum::http::HeaderValue::from_static("5"),
    );
    response
}

fn app_error(status: StatusCode, msg: &str) -> Response {
    (status, Json(serde_json::json!({ "error": msg }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    fn report(state: AiUsageProcessingState) -> AiUsageIngestReportV2 {
        AiUsageIngestReportV2 {
            contract_version: 2,
            processing_state: state,
            received: 10,
            accepted: 9,
            duplicates_in_batch: 1,
            stored: match state {
                AiUsageProcessingState::Stored => Some(9),
                AiUsageProcessingState::Pending => None,
            },
            unpriced: match state {
                AiUsageProcessingState::Stored => Some(0),
                AiUsageProcessingState::Pending => None,
            },
            sessions_touched: match state {
                AiUsageProcessingState::Stored => Some(1),
                AiUsageProcessingState::Pending => None,
            },
        }
    }

    #[tokio::test]
    async fn contract_v2_stored_response_has_numeric_derived_counts() {
        let response = v2_response(StatusCode::OK, report(AiUsageProcessingState::Stored));
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["contract_version"], 2);
        assert_eq!(value["processing_state"], "stored");
        assert_eq!(value["accepted"], 9);
        assert_eq!(value["stored"], 9);
        assert_eq!(value["unpriced"], 0);
        assert_eq!(value["sessions_touched"], 1);
    }

    #[tokio::test]
    async fn contract_v2_pending_response_keeps_derived_counts_null() {
        let response = v2_response(
            StatusCode::ACCEPTED,
            report(AiUsageProcessingState::Pending),
        );
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["processing_state"], "pending");
        assert_eq!(value["stored"], serde_json::Value::Null);
        assert_eq!(value["unpriced"], serde_json::Value::Null);
        assert_eq!(value["sessions_touched"], serde_json::Value::Null);
    }

    #[test]
    fn kafka_publish_failure_has_the_required_retry_after_header() {
        let response = with_retry_after(StatusCode::SERVICE_UNAVAILABLE, "publish failed");
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(response.headers()[header::RETRY_AFTER], "5");
    }

    #[tokio::test]
    async fn legacy_response_remains_numeric_and_has_no_v2_marker() {
        let response = Json(AiUsageIngestReport {
            received: 2,
            stored: 2,
            duplicates_in_batch: 0,
            unpriced: 1,
            sessions_touched: 1,
        })
        .into_response();
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(value.get("contract_version").is_none());
        assert_eq!(value["stored"], 2);
        assert_eq!(value["sessions_touched"], 1);
    }
}
