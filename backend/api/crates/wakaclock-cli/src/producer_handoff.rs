//! Bounded, scoped, metadata-only producer acceptance. ACK is local durability,
//! never HTTP success; rejected records remain in the producer's original spool.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use wakaclock_core::{
    ai::activity::{opaque, ActivityKind, BrokerActivityEventV2, BrokerActivityEventV3},
    api_client::ApiClient,
    broker::{BrokerEventV1, BrokerIngestOutcome, BrokerStore},
    config::Config,
    queue::Queue,
};

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Observation {
    pub schema_version: u8,
    pub scope_id: String,
    pub adapter_id: String,
    pub execution_surface: String,
    pub observation_id: String,
    pub observed_at: DateTime<Utc>,
    pub kind: String,
    pub payload_hash: String,
    pub metadata: Value,
}
impl Observation {
    fn validate(&self) -> Result<(), &'static str> {
        if self.schema_version != 2
            || uuid::Uuid::parse_str(&self.observation_id).is_err()
            || self.scope_id.len() != 64
            || !self.scope_id.bytes().all(|b| b.is_ascii_hexdigit())
            || wakaclock_core::ai::AdapterRegistry::builtin()
                .get(&self.adapter_id)
                .is_none()
            || !["cli", "ide", "desktop", "inline", "mcp", "unknown"]
                .contains(&self.execution_surface.as_str())
        {
            return Err("producer_contract_invalid");
        }
        let bytes = serde_json::to_vec(&self.metadata).map_err(|_| "producer_payload_invalid")?;
        let max_bytes = if self.kind == "tool_boundary" {
            8 * 1024 * 1024
        } else {
            64 * 1024
        };
        if bytes.len() > max_bytes || format!("{:x}", Sha256::digest(bytes)) != self.payload_hash {
            return Err("producer_hash_mismatch");
        }
        Ok(())
    }
}

pub(crate) async fn accept(config: &Config, api: &ApiClient, observation: Observation) -> Value {
    let id = observation.observation_id.clone();
    let hash = observation.payload_hash.clone();
    let result = accept_inner(config, api, &observation).await;
    match result {
        Ok(status) => json!({"id":id,"payload_hash":hash,"status":status,"durable":true}),
        Err((code, retryable)) => {
            json!({"id":id,"payload_hash":hash,"status":if retryable{"retryable_rejection"}else{"permanent_rejection"},"durable":false,"error_code":code})
        }
    }
}
async fn accept_inner(
    config: &Config,
    api: &ApiClient,
    o: &Observation,
) -> Result<&'static str, (&'static str, bool)> {
    o.validate().map_err(|code| (code, false))?;
    if config.api_key.is_none() {
        return Err(("producer_owner_unconfirmed", true));
    }
    let scopes = verified_scopes(api).map_err(|_| ("producer_scope_proof_unavailable", true))?;
    if !scopes.contains(&o.scope_id) {
        return Err(("producer_scope_mismatch", false));
    }
    if !wakaclock_core::runtime::capture_allowed_at(o.observed_at.timestamp()) {
        return Err(("paused_by_user", true));
    }
    if o.kind == "tool_boundary" {
        return crate::producer_tool_boundary::accept(o);
    }
    if o.kind == "file_mutation" {
        let event: BrokerEventV1 = serde_json::from_value(o.metadata.clone())
            .map_err(|_| ("producer_file_schema_invalid", false))?;
        if event.agent != o.adapter_id {
            return Err(("producer_adapter_mismatch", false));
        }
        let event = event
            .normalize()
            .map_err(|_| ("producer_file_validation", false))?;
        if !wakaclock_core::runtime::capture_allowed_at(event.occurred_at.timestamp()) {
            return Err(("paused_by_user", true));
        }
        let mut store = BrokerStore::open().map_err(|_| ("producer_inbox_unavailable", true))?;
        let result = store
            .ingest_normalized_batch_scoped(&[event], Some(&o.scope_id))
            .map_err(|error| {
                if matches!(error, wakaclock_core::error::AppError::Conflict(_)) {
                    ("producer_payload_conflict", false)
                } else {
                    ("producer_inbox_unavailable", true)
                }
            })?;
        return Ok(if result[0] == BrokerIngestOutcome::Duplicate {
            "duplicate"
        } else {
            "accepted"
        });
    }
    let event = lifecycle(o).map_err(|code| (code, code == "producer_context_unresolved"))?;
    if !wakaclock_core::runtime::capture_allowed_at(event.activity.occurred_at.timestamp()) {
        return Err(("paused_by_user", true));
    }
    let ack = crate::capture_service::submit_activity_v3(config, api, event)
        .await
        .map_err(|_| ("producer_activity_handoff_failed", true))?;
    if ack["durable"] != true {
        return Err(("producer_ack_unconfirmed", true));
    }
    Ok(if ack["status"] == "duplicate" {
        "duplicate"
    } else {
        "accepted"
    })
}
pub(crate) fn verified_scopes(
    api: &ApiClient,
) -> Result<Vec<String>, wakaclock_core::error::AppError> {
    let current = api.queue_scope();
    let mut scopes = vec![wakaclock_core::editor_health::scope_id(&current)];
    scopes.extend(
        Queue::open()?
            .verified_editor_journal_scopes(&current)?
            .iter()
            .map(wakaclock_core::editor_health::scope_id),
    );
    scopes.sort();
    scopes.dedup();
    Ok(scopes)
}
fn lifecycle(o: &Observation) -> Result<BrokerActivityEventV3, &'static str> {
    let (session, root, operation, kind, tool, status, occurred_at) = match o.kind.as_str() {
        "session_start" | "session_end" => {
            let input: crate::AiSessionInput = serde_json::from_value(o.metadata.clone())
                .map_err(|_| "producer_session_schema_invalid")?;
            if input.agent != o.adapter_id {
                return Err("producer_adapter_mismatch");
            }
            (
                input.session_id,
                input.cwd,
                o.observation_id.clone(),
                if o.kind == "session_start" {
                    ActivityKind::TaskStart
                } else {
                    ActivityKind::TaskEnd
                },
                None,
                None,
                input.occurred_at.unwrap_or(o.observed_at),
            )
        }
        "tool_before" | "tool_after" | "tool_abort" => {
            let input: crate::tool_snapshot::AiToolInput =
                serde_json::from_value(o.metadata.clone())
                    .map_err(|_| "producer_tool_schema_invalid")?;
            if input.agent != o.adapter_id {
                return Err("producer_adapter_mismatch");
            }
            let session = input.session_id.ok_or("producer_context_unresolved")?;
            let operation = opaque(&format!("{session}\0{}", input.tool_event_id));
            (
                session,
                input.workspace_root.or(input.cwd),
                operation,
                if o.kind == "tool_before" {
                    ActivityKind::ToolStart
                } else {
                    ActivityKind::ToolEnd
                },
                input.tool,
                Some(
                    if o.kind == "tool_abort" {
                        "failed"
                    } else {
                        "observed"
                    }
                    .to_string(),
                ),
                o.observed_at,
            )
        }
        _ => return Err("producer_kind_unknown"),
    };
    let root: PathBuf = root
        .filter(|r| r.is_absolute())
        .ok_or("producer_context_unresolved")?;
    let event = BrokerActivityEventV3 {
        schema_version: 3,
        adapter_id: o.adapter_id.clone(),
        execution_surface: o.execution_surface.clone(),
        provider_schema_version: "producer-metadata-v2".into(),
        activity: BrokerActivityEventV2 {
            schema_version: 2,
            event_id: opaque(&format!("producer\0{}\0{}", o.scope_id, o.observation_id)),
            revision: 1,
            session_id: session,
            project_root: root,
            kind,
            operation_id: operation,
            occurred_at,
            started_at: None,
            provenance: "wrapper".into(),
            tool,
            status,
            producer_surface: o.execution_surface.clone(),
            monitoring_only: false,
        },
    };
    event
        .validate()
        .map_err(|_| "producer_activity_validation")?;
    Ok(event)
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Batch {
    schema_version: u8,
    records: Vec<Value>,
}
pub(crate) async fn batch(
    config: &Config,
    api: &ApiClient,
    bytes: &[u8],
) -> Result<Value, &'static str> {
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("producer_batch_too_large");
    }
    let input: Batch = serde_json::from_slice(bytes).map_err(|_| "producer_batch_invalid")?;
    if input.schema_version != 2 || input.records.is_empty() || input.records.len() > 100 {
        return Err("producer_batch_bounds");
    }
    let mut results = Vec::new();
    for record in input.records {
        let id = record
            .get("observation_id")
            .and_then(Value::as_str)
            .filter(|id| uuid::Uuid::parse_str(id).is_ok())
            .map(str::to_owned);
        let hash = record
            .get("payload_hash")
            .and_then(Value::as_str)
            .filter(|hash| hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()))
            .map(str::to_owned);
        let result = match serde_json::from_value::<Observation>(record) {
            Ok(o) => accept(config, api, o).await,
            Err(_) => {
                json!({"id":id,"payload_hash":hash,"status":"permanent_rejection","durable":false,"error_code":"producer_record_invalid"})
            }
        };
        results.push(result);
    }
    Ok(json!({"schema_version":2,"results":results}))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn observation(metadata: Value, kind: &str) -> Observation {
        Observation {
            schema_version: 2,
            scope_id: "a".repeat(64),
            adapter_id: "kilo-code".into(),
            execution_surface: "unknown".into(),
            observation_id: uuid::Uuid::new_v4().to_string(),
            observed_at: DateTime::parse_from_rfc3339("2026-10-07T01:18:09Z")
                .unwrap()
                .with_timezone(&Utc),
            kind: kind.into(),
            payload_hash: format!(
                "{:x}",
                Sha256::digest(serde_json::to_vec(&metadata).unwrap())
            ),
            metadata,
        }
    }
    #[test]
    fn lifecycle_replay_preserves_explicit_event_time_before_producer_start() {
        let record = observation(
            json!({"session_id":"session","agent":"kilo-code","cwd":"/fixture","occurred_at":"2026-10-06T19:18:09Z"}),
            "session_end",
        );
        let event = lifecycle(&record).unwrap();
        assert_eq!(
            event.activity.occurred_at.to_rfc3339(),
            "2026-10-06T19:18:09+00:00"
        );
        assert!(event.activity.occurred_at < record.observed_at);
        assert!(event.activity.started_at.is_none());
    }
    #[test]
    fn original_time_and_operation_survive_replay_without_invented_interval() {
        let first = observation(
            json!({"tool_event_id":"operation","agent":"kilo-code","session_id":"session","workspace_root":"/fixture"}),
            "tool_before",
        );
        first.validate().unwrap();
        let start = lifecycle(&first).unwrap();
        let last = observation(first.metadata.clone(), "tool_after");
        let end = lifecycle(&last).unwrap();
        assert_eq!(start.activity.operation_id, end.activity.operation_id);
        assert_eq!(start.activity.occurred_at, first.observed_at);
        assert!(end.activity.started_at.is_none());
        assert_eq!(end.execution_surface, "unknown");
    }
    #[test]
    fn mismatched_hash_unknown_content_and_unresolved_project_cannot_be_acked() {
        let mut record = observation(
            json!({"session_id":"session","agent":"kilo-code","cwd":"/fixture"}),
            "session_start",
        );
        record.payload_hash = "b".repeat(64);
        assert!(record.validate().is_err());
        let record = observation(
            json!({"session_id":"session","agent":"kilo-code","cwd":"/fixture","prompt":"SENSITIVE"}),
            "session_start",
        );
        assert!(lifecycle(&record).is_err());
        let record = observation(
            json!({"session_id":"session","agent":"kilo-code"}),
            "session_start",
        );
        assert_eq!(
            lifecycle(&record).unwrap_err(),
            "producer_context_unresolved"
        );
    }
}
