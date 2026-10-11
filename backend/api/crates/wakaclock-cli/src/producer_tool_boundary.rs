//! A durable ACK accepts frozen hook evidence, not canonical heartbeat delivery.
//! Pairing and retries use only the retained metadata. Never read the workspace,
//! invoke Git, rediscover a root, or substitute the replay clock for a boundary.
use crate::{
    producer_handoff::Observation,
    tool_snapshot::{AiToolInput, FrozenNumstat, ToolSnapshot},
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    path::{Component, Path},
    time::{Duration, Instant},
};
use wakaclock_core::{
    api_client::ApiClient,
    broker::{producer_boundary::BoundaryReceipt, BrokerEventV1, BrokerIngestOutcome, BrokerStore},
    config::Config,
    error::AppError,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ToolBoundary {
    boundary_version: u8,
    phase: String,
    input: AiToolInput,
    snapshot: Option<ToolSnapshot>,
    numstat: BTreeMap<String, FrozenNumstat>,
    measurement_error: Option<String>,
}

fn valid_relative(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 4096
        && !path.contains(['\\', '\0'])
        && Path::new(path)
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}
fn text_ok(value: &str) -> bool {
    value.len() <= 4096
        && !value.chars().any(char::is_control)
        && !value.trim_start().starts_with(['{', '['])
}
fn validate(o: &Observation) -> Result<ToolBoundary, &'static str> {
    let boundary: ToolBoundary = serde_json::from_value(o.metadata.clone())
        .map_err(|_| "producer_boundary_schema_invalid")?;
    let input = &boundary.input;
    if boundary.boundary_version != 1
        || !matches!(boundary.phase.as_str(), "before" | "after" | "abort")
        || input.agent != o.adapter_id
        || crate::tool_snapshot::validate_input(input).is_err()
        || !text_ok(&input.tool_event_id)
        || input.tool_event_id.trim() != input.tool_event_id
        || [
            &input.provider,
            &input.model,
            &input.session_id,
            &input.tool,
            &input.transport,
        ]
        .iter()
        .any(|value| value.as_deref().is_some_and(|text| !text_ok(text)))
        || [&input.workspace_root, &input.cwd].iter().any(|path| {
            path.as_ref()
                .is_some_and(|path| !path.is_absolute() || !text_ok(&path.to_string_lossy()))
        })
        || boundary.numstat.len() > 20_000
        || boundary.numstat.keys().any(|key| !valid_relative(key))
        || (boundary.phase != "after" && !boundary.numstat.is_empty())
    {
        return Err("producer_boundary_validation");
    }
    if let Some(code) = &boundary.measurement_error {
        if code.is_empty()
            || code.len() > 128
            || !code
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
            || boundary.snapshot.is_some()
            || !boundary.numstat.is_empty()
        {
            return Err("producer_boundary_measurement_invalid");
        }
    }
    if boundary.phase == "abort" {
        if boundary.snapshot.is_some() || boundary.measurement_error.is_some() {
            return Err("producer_boundary_abort_invalid");
        }
        return Ok(boundary);
    }
    let Some(snapshot) = &boundary.snapshot else {
        return if boundary.measurement_error.is_some() {
            Ok(boundary)
        } else {
            Err("producer_boundary_measurement_missing")
        };
    };
    if snapshot.tool_event_id != input.tool_event_id
        || snapshot.agent != input.agent
        || snapshot
            .session_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            != input
                .session_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
        || snapshot.started_at != o.observed_at
        || !snapshot.workspace_root.is_absolute()
        || !text_ok(&snapshot.workspace_root.to_string_lossy())
        || snapshot.files.len() > 20_000
        || [
            &snapshot.provider,
            &snapshot.model,
            &snapshot.session_id,
            &snapshot.tool,
            &snapshot.transport,
        ]
        .iter()
        .any(|v| v.as_deref().is_some_and(|s| !text_ok(s)))
        || snapshot.files.iter().any(|(path, fp)| {
            !valid_relative(path)
                || !matches!(fp.content_hash.len(), 40 | 64)
                || !fp.content_hash.bytes().all(|b| b.is_ascii_hexdigit())
        })
    {
        return Err("producer_boundary_snapshot_invalid");
    }
    Ok(boundary)
}

fn pair_id(o: &Observation, boundary: &ToolBoundary) -> String {
    // Structured identity avoids separator collisions in provider session/call IDs.
    let identity = serde_json::json!([
        o.scope_id,
        o.adapter_id,
        o.execution_surface,
        boundary
            .input
            .session_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
        boundary.input.tool_event_id
    ]);
    format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&identity).expect("identity JSON"))
    )
}

pub(crate) fn accept(o: &Observation) -> Result<&'static str, (&'static str, bool)> {
    let mut store = BrokerStore::open().map_err(|_| ("producer_inbox_unavailable", true))?;
    accept_in_store(&mut store, o)
}
fn accept_in_store(
    store: &mut BrokerStore,
    o: &Observation,
) -> Result<&'static str, (&'static str, bool)> {
    let boundary = validate(o).map_err(|code| (code, false))?;
    let pair = pair_id(o, &boundary);
    let json = serde_json::to_string(o).map_err(|_| ("producer_boundary_schema_invalid", false))?;
    let semantic_hash = format!("{:x}", Sha256::digest(json.as_bytes()));
    let outcome = store
        .accept_tool_boundary(BoundaryReceipt {
            scope_id: &o.scope_id,
            observation_id: &o.observation_id,
            pair_id: &pair,
            phase: &boundary.phase,
            payload_hash: &o.payload_hash,
            semantic_hash: &semantic_hash,
            observation_json: &json,
            unavailable: boundary.measurement_error.is_some(),
        })
        .map_err(|error| {
            if matches!(error, AppError::Conflict(_)) {
                ("producer_boundary_conflict", false)
            } else {
                ("producer_inbox_unavailable", true)
            }
        })?;
    // Acceptance never measures or materializes; bounded idle-worker ticks own
    // deferred work after the producer is free to remove its acknowledged spool.
    Ok(if outcome == BrokerIngestOutcome::Duplicate {
        "duplicate"
    } else {
        "accepted"
    })
}

/// Retries are independent of new hook traffic and of the producer spool. Owner
/// proof is checked again before any pending evidence is converted to broker events.
pub(crate) fn drain_pending(
    config: &Config,
    api: &ApiClient,
    limit: usize,
    began: Instant,
) -> Result<usize, AppError> {
    if config.api_key.is_none() {
        return Ok(0);
    }
    let scopes = crate::producer_handoff::verified_scopes(api)?;
    let mut store = BrokerStore::open()?;
    let mut completed = 0;
    let mut event_budget = 100;
    let deadline = began + Duration::from_secs(10);
    for (scope, pair) in store.pending_tool_pairs_scoped(&scopes, limit)? {
        if event_budget == 0 || Instant::now() >= deadline {
            return Ok(completed);
        }
        store.note_tool_pair_retry(&scope, &pair, "")?;
        match materialize(
            &mut store,
            &scope,
            &pair,
            &mut event_budget,
            deadline,
            wakaclock_core::runtime::capture_allowed_at,
            capture_interval_allowed,
        ) {
            Ok(true) => completed += 1,
            Ok(false) => {}
            Err(_) => store.note_tool_pair_retry(
                &scope,
                &pair,
                "producer_boundary_materialization_pending",
            )?,
        }
    }
    Ok(completed)
}

pub(crate) fn health(api: &ApiClient) -> Result<serde_json::Value, AppError> {
    let mut total = serde_json::json!({"pending":0,"ready":0,"unavailable":0,"retry_pending":0,"materialized":0,"aborted":0,"clock_unconfirmed":0});
    let store = BrokerStore::open()?;
    for scope in crate::producer_handoff::verified_scopes(api)? {
        let health = store.tool_boundary_health(&scope)?;
        for (key, value) in total.as_object_mut().expect("health object") {
            *value =
                serde_json::json!(value.as_u64().unwrap_or(0) + health[key].as_u64().unwrap_or(0));
        }
    }
    Ok(total)
}

fn pause_intersects(
    intervals: &[wakaclock_core::runtime::PauseInterval],
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> Result<bool, AppError> {
    if end <= start {
        return Ok(false);
    }
    for interval in intervals
        .iter()
        .filter(|interval| interval.component == "capture")
    {
        let paused_at = DateTime::<Utc>::from_timestamp(interval.started_at, 0)
            .ok_or_else(|| AppError::Validation("producer_pause_interval_invalid".into()))?;
        let resumed_at = interval
            .ended_at
            .map(|at| {
                DateTime::<Utc>::from_timestamp(at, 0)
                    .ok_or_else(|| AppError::Validation("producer_pause_interval_invalid".into()))
            })
            .transpose()?;
        if paused_at < end && resumed_at.is_none_or(|resumed| resumed > start) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn capture_interval_allowed(start: DateTime<Utc>, end: DateTime<Utc>) -> Result<bool, AppError> {
    Ok(!pause_intersects(
        &wakaclock_core::runtime::read()?.intervals,
        start,
        end,
    )?)
}

fn materialize(
    store: &mut BrokerStore,
    scope: &str,
    pair: &str,
    event_budget: &mut usize,
    deadline: Instant,
    capture_allowed: fn(i64) -> bool,
    interval_allowed: fn(DateTime<Utc>, DateTime<Utc>) -> Result<bool, AppError>,
) -> Result<bool, AppError> {
    let Some(stored) = store.load_tool_pair(scope, pair)? else {
        return Ok(false);
    };
    let mut before = None;
    let mut after = None;
    let mut abort = false;
    let mut unavailable = false;
    for json in &stored.observations {
        let o: Observation = serde_json::from_str(json)?;
        let boundary = validate(&o).map_err(|code| AppError::Validation(code.into()))?;
        if !capture_allowed(o.observed_at.timestamp()) {
            return Ok(false);
        }
        unavailable |= boundary.measurement_error.is_some();
        match boundary.phase.as_str() {
            "before" => before = Some(boundary),
            "after" => after = Some((o.observed_at, boundary)),
            "abort" => abort = true,
            _ => unreachable!(),
        }
    }
    if unavailable || abort {
        store.finish_tool_pair(
            scope,
            pair,
            if unavailable {
                "unavailable"
            } else {
                "aborted"
            },
        )?;
        return Ok(true);
    }
    let (Some(before), Some((ended_at, after))) = (before, after) else {
        return Ok(false);
    };
    let started_at = before
        .snapshot
        .as_ref()
        .ok_or_else(|| AppError::Validation("producer_boundary_measurement_missing".into()))?
        .started_at;
    if !interval_allowed(started_at, ended_at)? {
        store.note_tool_pair_retry(scope, pair, "producer_boundary_capture_paused_between")?;
        store.finish_tool_pair(scope, pair, "unavailable")?;
        return Ok(true);
    }
    let batch = if let Some(batch) = stored.batch {
        batch
    } else {
        let before_snapshot = before
            .snapshot
            .as_ref()
            .ok_or_else(|| AppError::Validation("producer_boundary_measurement_missing".into()))?;
        let after_snapshot = after
            .snapshot
            .as_ref()
            .ok_or_else(|| AppError::Validation("producer_boundary_measurement_missing".into()))?;
        if before_snapshot.workspace_root != after_snapshot.workspace_root
            || before_snapshot.git_backed != after_snapshot.git_backed
        {
            store.note_tool_pair_retry(scope, pair, "producer_boundary_workspace_conflict")?;
            store.finish_tool_pair(scope, pair, "unavailable")?;
            return Ok(true);
        }
        let changes =
            crate::tool_snapshot::diff_frozen(before_snapshot, after_snapshot, &after.numstat)
                .map_err(|_| AppError::Validation("producer_boundary_pair_mismatch".into()))?;
        let elapsed = (ended_at - before_snapshot.started_at)
            .num_milliseconds()
            .max(0) as f64
            / 1000.0;
        if ended_at < before_snapshot.started_at {
            store.note_tool_pair_retry(scope, pair, "producer_clock_unconfirmed")?;
        }
        let active = elapsed.min(wakaclock_core::heartbeat::MAX_AI_TOOL_DURATION_SECONDS);
        let mut inputs: Vec<_> = changes
            .iter()
            .map(|change| crate::tool_change_input(before_snapshot, &after.input, change, ended_at))
            .collect();
        // Do this once across the entire sorted batch, before splitting or dedup.
        crate::spread_single_tool_interval(&mut inputs, active);
        let batch: Vec<BrokerEventV1> = inputs
            .iter()
            .map(|input| {
                crate::broker_event_from_generic(input)
                    .map_err(|_| AppError::Validation("producer_boundary_event_invalid".into()))?
                    .normalize()
            })
            .collect::<Result<_, _>>()?;
        store.freeze_tool_batch(scope, pair, &batch)?
    };
    // Each chunk is atomic. A crash before the final mark replays the exact frozen
    // batch: accepted chunks dedup and no interval can move to another file.
    let mut start = stored.next_event_index;
    while start < batch.len() {
        if *event_budget == 0 || Instant::now() >= deadline {
            return Ok(false);
        }
        let mut end = start;
        let mut bytes = 2;
        while end < batch.len() && end - start < (*event_budget).min(100) {
            let size = serde_json::to_vec(&batch[end])?.len() + 1;
            if bytes + size > wakaclock_core::broker::MAX_BATCH_BYTES && end > start {
                break;
            }
            bytes += size;
            end += 1;
        }
        store.ingest_normalized_batch_scoped(&batch[start..end], Some(scope))?;
        store.advance_tool_pair(scope, pair, end)?;
        *event_budget -= end - start;
        start = end;
    }
    store.finish_tool_pair(scope, pair, "materialized")?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool_snapshot::FileFingerprint;
    use chrono::{DateTime, Utc};
    use serde_json::json;

    fn boundary(phase: &str, count: usize) -> Observation {
        let occurred =
            DateTime::<Utc>::from_timestamp(if phase == "before" { 1000 } else { 1060 }, 0)
                .unwrap();
        let input = AiToolInput {
            tool_event_id: "tool-fixture".into(),
            agent: "claude-code".into(),
            provider: None,
            model: None,
            session_id: Some("session-fixture".into()),
            tool: Some("shell".into()),
            transport: Some("shell_hook".into()),
            workspace_root: Some("/fixture/absent/replay-workspace".into()),
            cwd: None,
        };
        let files = (0..count)
            .map(|i| {
                (
                    format!("src/file-{i:04}.rs"),
                    FileFingerprint {
                        size: 2,
                        modified_ns: 0,
                        content_hash: "a".repeat(64),
                        line_count: Some(1),
                        tracked: false,
                        dirty_before: false,
                    },
                )
            })
            .collect();
        let snapshot = ToolSnapshot {
            tool_event_id: input.tool_event_id.clone(),
            agent: input.agent.clone(),
            provider: None,
            model: None,
            session_id: input.session_id.clone(),
            tool: input.tool.clone(),
            transport: input.transport.clone(),
            workspace_root: input.workspace_root.clone().unwrap(),
            started_at: occurred,
            files,
            git_backed: false,
        };
        let metadata = json!({"boundary_version":1,"phase":phase,"input":input,"snapshot":if phase=="abort" {serde_json::Value::Null} else {serde_json::to_value(snapshot).unwrap()},"numstat":{},"measurement_error":null});
        Observation {
            schema_version: 2,
            scope_id: "a".repeat(64),
            adapter_id: "claude-code".into(),
            execution_surface: "cli".into(),
            observation_id: uuid::Uuid::new_v4().to_string(),
            observed_at: occurred,
            kind: "tool_boundary".into(),
            payload_hash: format!(
                "{:x}",
                Sha256::digest(serde_json::to_vec(&metadata).unwrap())
            ),
            metadata,
        }
    }
    fn temp_db() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("tool-boundary-fixture-{}.db", uuid::Uuid::new_v4()))
    }
    fn process(store: &mut BrokerStore, scope: &str, pair: &str, budget: &mut usize) -> bool {
        materialize(
            store,
            scope,
            pair,
            budget,
            Instant::now() + Duration::from_secs(10),
            |_| true,
            |_, _| Ok(true),
        )
        .unwrap()
    }
    #[test]
    fn out_of_order_large_pair_restarts_with_frozen_time_and_one_interval() {
        let path = temp_db();
        let before = boundary("before", 0);
        let after = boundary("after", 101);
        let pair = pair_id(&before, &validate(&before).unwrap());
        {
            let mut store = BrokerStore::open_at(&path).unwrap();
            assert_eq!(accept_in_store(&mut store, &after).unwrap(), "accepted");
            assert!(store
                .pending_tool_pairs(&after.scope_id, 10)
                .unwrap()
                .is_empty());
            assert_eq!(accept_in_store(&mut store, &before).unwrap(), "accepted");
            // A durable boundary ACK does not synchronously ingest file events.
            assert_eq!(store.stats().unwrap().pending, 0);
            let mut budget = 100;
            assert!(!process(&mut store, &before.scope_id, &pair, &mut budget));
            assert_eq!(budget, 0);
            assert_eq!(
                store
                    .load_tool_pair(&before.scope_id, &pair)
                    .unwrap()
                    .unwrap()
                    .next_event_index,
                100
            );
            assert_eq!(store.stats().unwrap().pending, 100);
        }
        let mut store = BrokerStore::open_at(&path).unwrap();
        assert!(process(&mut store, &before.scope_id, &pair, &mut 100));
        assert_eq!(
            store.tool_boundary_health(&before.scope_id).unwrap()["materialized"],
            1
        );
        let rows = store
            .claim_ready_scoped(200, Some(std::slice::from_ref(&before.scope_id)))
            .unwrap();
        assert_eq!(rows.len(), 101);
        assert_eq!(
            rows.iter()
                .map(|r| r.event.active_seconds.unwrap_or(0.0))
                .sum::<f64>(),
            60.0
        );
        assert_eq!(
            rows.iter()
                .filter(|r| r.event.active_seconds == Some(60.0))
                .count(),
            1
        );
        assert!(rows
            .iter()
            .all(|r| r.event.occurred_at == after.observed_at));
        assert_eq!(accept_in_store(&mut store, &after).unwrap(), "duplicate");
        assert_eq!(
            store.tool_boundary_health(&before.scope_id).unwrap()["materialized"],
            1
        );
        drop(store);
        let _ = std::fs::remove_file(path);
    }
    #[test]
    fn committed_chunk_without_progress_receipt_replays_identically() {
        let path = temp_db();
        let before = boundary("before", 0);
        let after = boundary("after", 2);
        let pair = pair_id(&before, &validate(&before).unwrap());
        {
            let mut store = BrokerStore::open_at(&path).unwrap();
            accept_in_store(&mut store, &before).unwrap();
            accept_in_store(&mut store, &after).unwrap();
            assert!(!process(&mut store, &before.scope_id, &pair, &mut 0));
            let frozen = store
                .load_tool_pair(&before.scope_id, &pair)
                .unwrap()
                .unwrap()
                .batch
                .unwrap();
            store
                .ingest_normalized_batch_scoped(&frozen[..1], Some(&before.scope_id))
                .unwrap();
            // Process dies before advance_tool_pair: the interval already exists.
        }
        let mut store = BrokerStore::open_at(&path).unwrap();
        assert!(process(&mut store, &before.scope_id, &pair, &mut 100));
        let rows = store
            .claim_ready_scoped(10, Some(std::slice::from_ref(&before.scope_id)))
            .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(
            rows.iter()
                .map(|r| r.event.active_seconds.unwrap_or(0.0))
                .sum::<f64>(),
            60.0
        );
        drop(store);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn unavailable_abort_and_same_id_changed_time_never_create_intervals() {
        let path = temp_db();
        let mut store = BrokerStore::open_at(&path).unwrap();
        let mut failed = boundary("before", 0);
        failed.metadata["snapshot"] = serde_json::Value::Null;
        failed.metadata["measurement_error"] = json!("producer_scan_failed");
        failed.payload_hash = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&failed.metadata).unwrap())
        );
        assert_eq!(accept_in_store(&mut store, &failed).unwrap(), "accepted");
        assert_eq!(
            store.tool_boundary_health(&failed.scope_id).unwrap()["unavailable"],
            1
        );
        let mut abort = boundary("abort", 0);
        abort.scope_id = "b".repeat(64);
        assert_eq!(accept_in_store(&mut store, &abort).unwrap(), "accepted");
        assert_eq!(
            store.tool_boundary_health(&abort.scope_id).unwrap()["aborted"],
            1
        );
        abort.observed_at += chrono::Duration::seconds(1);
        assert_eq!(
            accept_in_store(&mut store, &abort).unwrap_err(),
            ("producer_boundary_conflict", false)
        );
        assert_eq!(store.stats().unwrap().pending, 0);
        drop(store);
        let _ = std::fs::remove_file(path);
    }
    #[test]
    fn unchanged_pairs_emit_no_interval_and_clock_reversal_keeps_zero_baseline() {
        let path = temp_db();
        let mut store = BrokerStore::open_at(&path).unwrap();
        let before = boundary("before", 1);
        let after = boundary("after", 1);
        let pair = pair_id(&before, &validate(&before).unwrap());
        accept_in_store(&mut store, &before).unwrap();
        accept_in_store(&mut store, &after).unwrap();
        assert!(process(&mut store, &before.scope_id, &pair, &mut 100));
        assert_eq!(store.stats().unwrap().pending, 0);
        let mut before = boundary("before", 0);
        let mut after = boundary("after", 1);
        before.scope_id = "b".repeat(64);
        after.scope_id = before.scope_id.clone();
        after.observed_at = DateTime::<Utc>::from_timestamp(900, 0).unwrap();
        after.metadata["snapshot"]["started_at"] = json!(after.observed_at);
        after.payload_hash = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&after.metadata).unwrap())
        );
        let pair = pair_id(&before, &validate(&before).unwrap());
        accept_in_store(&mut store, &before).unwrap();
        accept_in_store(&mut store, &after).unwrap();
        assert!(process(&mut store, &before.scope_id, &pair, &mut 100));
        assert_eq!(
            store.tool_boundary_health(&before.scope_id).unwrap()["clock_unconfirmed"],
            1
        );
        let rows = store
            .claim_ready_scoped(10, Some(std::slice::from_ref(&before.scope_id)))
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].event.active_seconds, Some(0.0));
        drop(store);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn pause_overlap_handles_half_open_edges_and_subsecond_boundaries() {
        let interval = wakaclock_core::runtime::PauseInterval {
            component: "capture".into(),
            started_at: 1020,
            ended_at: Some(1040),
        };
        let at = |s, n| DateTime::<Utc>::from_timestamp(s, n).unwrap();
        assert!(
            pause_intersects(std::slice::from_ref(&interval), at(1000, 0), at(1060, 0)).unwrap()
        );
        assert!(
            !pause_intersects(std::slice::from_ref(&interval), at(1000, 0), at(1020, 0)).unwrap()
        );
        assert!(
            !pause_intersects(std::slice::from_ref(&interval), at(1040, 0), at(1060, 0)).unwrap()
        );
        assert!(
            pause_intersects(std::slice::from_ref(&interval), at(1000, 0), at(1020, 1)).unwrap()
        );
        assert!(pause_intersects(
            std::slice::from_ref(&interval),
            at(1039, 999_999_999),
            at(1060, 0)
        )
        .unwrap());
    }

    #[test]
    fn unreadable_pause_history_retries_but_overlap_retains_unavailable_evidence() {
        let path = temp_db();
        let mut store = BrokerStore::open_at(&path).unwrap();
        let before = boundary("before", 0);
        let after = boundary("after", 1);
        let pair = pair_id(&before, &validate(&before).unwrap());
        accept_in_store(&mut store, &before).unwrap();
        accept_in_store(&mut store, &after).unwrap();
        assert!(materialize(
            &mut store,
            &before.scope_id,
            &pair,
            &mut 100,
            Instant::now() + Duration::from_secs(10),
            |_| true,
            |_, _| Err(AppError::Validation("runtime_unreadable".into()))
        )
        .is_err());
        assert_eq!(
            store.tool_boundary_health(&before.scope_id).unwrap()["pending"],
            1
        );
        assert!(materialize(
            &mut store,
            &before.scope_id,
            &pair,
            &mut 100,
            Instant::now() + Duration::from_secs(10),
            |_| true,
            |_, _| Ok(false)
        )
        .unwrap());
        assert_eq!(
            store.tool_boundary_health(&before.scope_id).unwrap()["unavailable"],
            1
        );
        assert_eq!(store.stats().unwrap().pending, 0);
        assert_eq!(accept_in_store(&mut store, &after).unwrap(), "duplicate");
        drop(store);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn unknown_nested_content_and_parent_traversal_are_rejected() {
        let mut value = boundary("before", 1);
        value.metadata["input"]["command"] = json!("never retain tool content");
        assert!(validate(&value).is_err());
        let mut value = boundary("after", 1);
        let fp = value.metadata["snapshot"]["files"]["src/file-0000.rs"].take();
        value.metadata["snapshot"]["files"] = json!({"../outside":fp});
        assert!(validate(&value).is_err());
    }
}
