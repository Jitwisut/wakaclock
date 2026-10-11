use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use wakaclock_core::ai::fingerprint_for_heartbeat;
use wakaclock_core::heartbeat::{
    normalize_activity_source, union_activity_seconds, ActivitySegment, Heartbeat,
    ACTIVE_LEASE_SECONDS, MAX_ACTIVITY_GAP_SECONDS, MAX_AI_TOOL_DURATION_SECONDS,
};

use crate::model::date_range::ResolvedRange;
use crate::model::heartbeat::{ActivityIntervalRow, HeartbeatRow};
use crate::repository::heartbeat::HeartbeatRepository;
use crate::services::project_identity::ProjectIdentityService;

pub struct HeartbeatService {
    repo: Arc<HeartbeatRepository>,
    project_identity_service: Arc<ProjectIdentityService>,
}

impl HeartbeatService {
    pub fn new(
        repo: Arc<HeartbeatRepository>,
        project_identity_service: Arc<ProjectIdentityService>,
    ) -> Self {
        Self {
            repo,
            project_identity_service,
        }
    }

    /// Account-bound identity readback; no payload or file metadata is exposed.
    /// Missing/expired history and an unavailable repository remain unconfirmed.
    pub async fn readback_identities(
        &self,
        user_id: Uuid,
        records: &[(String, u32)],
    ) -> Vec<serde_json::Value> {
        let ids = records.iter().map(|(id, _)| id.clone()).collect::<Vec<_>>();
        let observations = self.repo.readback_ids(user_id, &ids).await;
        records.iter().map(|(id,revision)|{
            let observed=observations.as_ref().ok().and_then(|rows|rows.iter().find(|r|&r.0==id));
            let status=readback_status(*revision,observed.map(|r|(r.1,r.2)),observations.is_ok());
            serde_json::json!({"heartbeat_id":id,"requested_revision":revision,"canonical_revision":observed.map(|r|r.1),"status":status,"comparison":"id_revision_only","confirmation":if ["found","superseded"].contains(&status){"canonical_observed"}else{"unconfirmed"}})
        }).collect()
    }

    /// Process incoming heartbeats และ insert ลง repository
    pub async fn process_heartbeats(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
    ) -> Result<usize> {
        self.process_heartbeats_with_policy_and_token(user_id, machine, heartbeats, false, None)
            .await
    }

    /// Kafka consumers use the strict projection policy: if raw data is durable
    /// but an interval insert fails, the source offset must remain uncommitted so
    /// replay can fill the missing projection.  Direct HTTP keeps its historical
    /// best-effort interval behaviour through [`Self::process_heartbeats`].
    pub async fn process_heartbeats_strict(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
    ) -> Result<usize> {
        self.process_heartbeats_with_policy_and_token(user_id, machine, heartbeats, true, None)
            .await
    }

    pub async fn process_heartbeats_strict_with_token(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
        token: &str,
    ) -> Result<usize> {
        self.process_heartbeats_with_policy_and_token(
            user_id,
            machine,
            heartbeats,
            true,
            Some(token),
        )
        .await
    }

    async fn process_heartbeats_with_policy_and_token(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
        strict_projection: bool,
        insert_token: Option<&str>,
    ) -> Result<usize> {
        #[cfg(feature = "kafka-spike")]
        if std::env::var("ATOAXIS_KAFKA_SPIKE_FAILURE_POINT")
            .ok()
            .as_deref()
            == Some("clickhouse_down")
        {
            anyhow::bail!("injected ClickHouse outage");
        }
        let mut heartbeats = heartbeats;
        // Sanitize before deriving event/fingerprint identities so retries use the
        // same canonical payload whether they came from a new or legacy client.
        for heartbeat in &mut heartbeats {
            heartbeat.enforce_attribution_policy();
        }
        // Older clients may not send a transport ID. Keep that absence explicit: a
        // path/time/category-derived ID would merge independent legacy observations
        // and turn a weak compatibility guess into canonical attribution. New clients
        // receive a random heartbeat ID in the API client before they are queued.
        let mut rows = Vec::with_capacity(heartbeats.len());
        let mut interval_rows = Vec::new();
        let mut project_ids = HashMap::new();
        // Surfaced rather than swallowed: a client whose claims are being clamped is
        // reporting less time than it observed, and that used to be invisible.
        let mut clamped_claims = 0u32;
        let mut clamped_seconds = 0.0f64;
        let mut batch_heartbeat_revisions = HashMap::<(String, Option<String>), u32>::new();
        let mut batch_event_revisions = HashMap::<(String, Option<String>), u32>::new();
        let mut batch_change_revisions = HashMap::<(String, Option<String>), u32>::new();
        let candidate_heartbeat_ids: Vec<String> = heartbeats
            .iter()
            .filter_map(|heartbeat| heartbeat.heartbeat_id.clone())
            .collect();
        let existing_heartbeat_revisions = self
            .repo
            .existing_heartbeat_revisions_scoped(user_id, &candidate_heartbeat_ids)
            .await?;
        let candidate_event_ids: Vec<String> = heartbeats
            .iter()
            .filter_map(|heartbeat| heartbeat.ai_event_id.clone())
            .collect();
        let existing_event_revisions = self
            .repo
            .existing_ai_event_revisions(user_id, &candidate_event_ids)
            .await?;
        // `ai_change_id` is the tool-level reference and may be shared by a
        // multi-file operation. Per-file `ai_event_id` already provides the
        // revision/dedup key for those rows; consulting the shared change id here
        // would drop every file after the first one in a bulk request. Keep the
        // legacy change-id fallback only for rows that have no event id.
        let candidate_change_ids: Vec<String> = heartbeats
            .iter()
            .filter(|heartbeat| heartbeat.ai_event_id.is_none())
            .filter_map(|heartbeat| heartbeat.ai_change_id.clone())
            .collect();
        let existing_change_revisions = self
            .repo
            .existing_change_revisions(user_id, &candidate_change_ids)
            .await?;
        for (batch_index, mut hb) in heartbeats.into_iter().enumerate() {
            let mut duplicate_raw = false;
            if let Some(heartbeat_id) = hb.heartbeat_id.as_ref() {
                let heartbeat_key = (heartbeat_id.clone(), hb.session_id.clone());
                let stored_revision = existing_heartbeat_revisions.get(&heartbeat_key).copied();
                let tombstoned = existing_heartbeat_revisions
                    .get(&(heartbeat_id.clone(), None))
                    .is_some_and(|revision| *revision == u32::MAX);
                let batch_revision = batch_heartbeat_revisions.get(&heartbeat_key).copied();
                if stored_revision == Some(u32::MAX) || tombstoned {
                    // A deletion tombstone dominates every delayed/replayed
                    // heartbeat.  Do not recreate its interval projection.
                    continue;
                }
                if stored_revision.is_some_and(|revision| hb.revision <= revision)
                    || batch_revision.is_some_and(|revision| hb.revision <= revision)
                {
                    duplicate_raw = true;
                }
                if !duplicate_raw {
                    if hb.revision > 0
                        && stored_revision.is_none()
                        && batch_revision.is_none()
                        && hb.ai_event_id.is_none()
                        && hb.ai_change_id.is_none()
                    {
                        anyhow::bail!(
                            "correction revision {} has no stored base for heartbeat_id {}",
                            hb.revision,
                            heartbeat_id
                        );
                    }
                    if let Some(revision) = stored_revision {
                        if hb.revision != revision.saturating_add(1) {
                            anyhow::bail!(
                                "correction revision {} must follow stored revision {} for heartbeat_id {}",
                                hb.revision,
                                revision,
                                heartbeat_id
                            );
                        }
                    } else if let Some(revision) = batch_revision {
                        if hb.revision != revision.saturating_add(1) {
                            anyhow::bail!(
                                "correction revision {} must follow batch revision {} for heartbeat_id {}",
                                hb.revision,
                                revision,
                                heartbeat_id
                            );
                        }
                    }
                    batch_heartbeat_revisions.insert(heartbeat_key, hb.revision);
                }
            }
            // Bulk retries can contain the same AI event twice. De-duplicate within
            // the request before it reaches ClickHouse; the opaque id is supplied by
            // the agent hook and is not derived from source content.
            if let Some(event_id) = hb.ai_event_id.as_ref() {
                let event_key = (event_id.clone(), hb.session_id.clone());
                let stored_revision = existing_event_revisions.get(&event_key).copied();
                let batch_revision = batch_event_revisions.get(&event_key).copied();
                if stored_revision.is_some_and(|revision| hb.revision <= revision)
                    || batch_revision.is_some_and(|revision| hb.revision <= revision)
                {
                    duplicate_raw = true;
                }
                if !duplicate_raw {
                    if hb.revision > 0 && stored_revision.is_none() && batch_revision.is_none() {
                        anyhow::bail!(
                            "correction revision {} has no stored base for ai_event_id {}",
                            hb.revision,
                            event_id
                        );
                    }
                    if let Some(revision) = stored_revision {
                        if hb.revision != revision.saturating_add(1) {
                            anyhow::bail!(
                                "correction revision {} must follow stored revision {} for ai_event_id {}",
                                hb.revision,
                                revision,
                                event_id
                            );
                        }
                    } else if let Some(revision) = batch_revision {
                        if hb.revision != revision.saturating_add(1) {
                            anyhow::bail!(
                                "correction revision {} must follow batch revision {} for ai_event_id {}",
                                hb.revision,
                                revision,
                                event_id
                            );
                        }
                    }
                    batch_event_revisions.insert(event_key, hb.revision);
                }
            }

            if hb.ai_event_id.is_none() {
                if let Some(change_id) = hb.ai_change_id.as_ref() {
                    let change_key = (change_id.clone(), hb.session_id.clone());
                    let stored_revision = existing_change_revisions.get(&change_key).copied();
                    let batch_revision = batch_change_revisions.get(&change_key).copied();
                    if stored_revision.is_some_and(|revision| hb.revision <= revision)
                        || batch_revision.is_some_and(|revision| hb.revision <= revision)
                    {
                        duplicate_raw = true;
                    }
                    if !duplicate_raw {
                        if hb.revision > 0 && stored_revision.is_none() && batch_revision.is_none()
                        {
                            anyhow::bail!(
                                "correction revision {} has no stored base for ai_change_id {}",
                                hb.revision,
                                change_id
                            );
                        }
                        if let Some(revision) = stored_revision {
                            if hb.revision != revision.saturating_add(1) {
                                anyhow::bail!(
                                    "correction revision {} must follow stored revision {} for ai_change_id {}",
                                    hb.revision,
                                    revision,
                                    change_id
                                );
                            }
                        } else if let Some(revision) = batch_revision {
                            if hb.revision != revision.saturating_add(1) {
                                anyhow::bail!(
                                    "correction revision {} must follow batch revision {} for ai_change_id {}",
                                    hb.revision,
                                    revision,
                                    change_id
                                );
                            }
                        }
                        batch_change_revisions.insert(change_key, hb.revision);
                    }
                }
            }

            // Do not use a time/path/line fingerprint as authoritative identity. Those
            // fields describe an edit but cannot prove that two observations are the
            // same operation; using them here silently drops legitimate adjacent edits
            // and was the source of false cross-agent deduplication. Retries are covered
            // only by the opaque heartbeat/event/change IDs above. The derived
            // fingerprint is retained on the row for audit and migration tooling.
            let fingerprint = ai_event_fingerprint(&hb);

            if !machine.is_empty() {
                hb.machine = machine.clone();
            }

            // Project identity belongs on the raw heartbeat at write time. Project-detail
            // projections can then group by a stable ID even when a display name is renamed
            // later; historical NULL rows remain explicitly backfillable in PR 9.9.
            hb.project_id = if let Some(id) = project_ids.get(&hb.project) {
                *id
            } else {
                let id = self
                    .project_identity_service
                    .resolve_project_id(user_id, hb.project.as_deref(), None)
                    .await?;
                project_ids.insert(hb.project.clone(), id);
                id
            };

            let date = (hb.time as i64 / 86400).max(0) as u16;
            let created_at = parse_created_at(&hb.created_at);
            let interval_heartbeat_id = hb
                .heartbeat_id
                .clone()
                .unwrap_or_else(|| format!("legacy-row:{batch_index}"));
            let evidence = clamp_to_evidence_window(
                &hb.activity_segments,
                hb.active_seconds,
                hb.time,
                &interval_heartbeat_id,
            );
            if evidence.clamped_excess_seconds > 0.0 {
                clamped_claims += 1;
                clamped_seconds += evidence.clamped_excess_seconds;
            }
            // What this heartbeat proves, overlap-free. This is the value stored on the
            // row and therefore what every `mv_*_summary` sums, so an MV-backed surface
            // now measures the same seconds the canonical timeline does. The client's
            // original claim is preserved in `active_seconds_claimed`, not overwritten.
            let claimed_active_seconds = hb.active_seconds;
            let proven_active_seconds = if evidence.segments.is_empty() {
                // No provable evidence. A zero-length anchor is still a real heartbeat —
                // it just carries no duration of its own.
                hb.active_seconds.map(|_| 0.0)
            } else {
                Some(evidence.proven_seconds())
            };
            let existing_segments = if duplicate_raw {
                let candidates = evidence
                    .segments
                    .iter()
                    .map(|segment| segment.segment_id.clone())
                    .collect::<Vec<_>>();
                self.repo
                    .existing_activity_segment_ids(user_id, &interval_heartbeat_id, &candidates)
                    .await?
            } else {
                std::collections::HashSet::new()
            };
            for segment in evidence.segments {
                if existing_segments.contains(&segment.segment_id) {
                    continue;
                }
                interval_rows.push(ActivityIntervalRow {
                    user_id,
                    segment_id: segment.segment_id,
                    heartbeat_id: interval_heartbeat_id.clone(),
                    start: segment.start,
                    end: segment.end,
                    source: normalize_activity_source(
                        segment.source.as_deref(),
                        hb.actor_type.as_str(),
                    )
                    .to_string(),
                    entity: hb.entity.clone(),
                    project: hb.project.clone(),
                    project_id: hb.project_id,
                    branch: hb.branch.clone(),
                    language: hb.language.clone(),
                    category: hb.category.to_string(),
                    editor: hb.editor.clone(),
                    operating_system: hb.operating_system.clone(),
                    actor_type: hb.actor_type.as_str().to_string(),
                    actor_confidence: hb.actor_confidence,
                    created_at,
                });
            }
            // An AI-marked heartbeat with no provable AI line delta is not a human edit.
            // Preserve any buffered line counters as explicitly unattributed so the
            // dashboard can show uncertainty instead of inflating Human.
            let (
                human_lines_added,
                human_lines_deleted,
                unattributed_lines_added,
                unattributed_lines_deleted,
            ) = if hb.actor_type.is_ai()
                && hb.ai_lines_added.unwrap_or(0) == 0
                && hb.ai_lines_deleted.unwrap_or(0) == 0
                && (hb.human_lines_added.unwrap_or(0) > 0
                    || hb.human_lines_deleted.unwrap_or(0) > 0
                    || hb.unattributed_lines_added.unwrap_or(0) > 0
                    || hb.unattributed_lines_deleted.unwrap_or(0) > 0)
            {
                (
                    None,
                    None,
                    Some(hb.human_lines_added.unwrap_or(0)),
                    Some(hb.human_lines_deleted.unwrap_or(0)),
                )
            } else {
                (
                    hb.human_lines_added,
                    hb.human_lines_deleted,
                    Some(hb.unattributed_lines_added.unwrap_or(0)),
                    Some(hb.unattributed_lines_deleted.unwrap_or(0)),
                )
            };

            let row = HeartbeatRow {
                user_id,
                entity: hb.entity,
                entity_type: format!("{:?}", hb.entity_type).to_lowercase(),
                time: hb.time,
                date,
                project: hb.project,
                project_id: hb.project_id,
                branch: hb.branch,
                head_revision: hb.head_revision,
                repository_id: hb.repository_id,
                language: hb.language,
                dependencies: hb.dependencies,
                lines: hb.lines,
                line_number: hb.line_number,
                cursor_position: hb.cursor_position,
                is_write: hb.is_write,
                category: hb.category.to_string(),
                editor: hb.editor,
                operating_system: hb.operating_system,
                machine: hb.machine,
                user_agent: hb.user_agent,
                machine_name_hash: hb.machine_name_hash,
                hostname_hash: hb.hostname_hash,
                timezone: hb.timezone,
                feature_id: hb.feature_id,
                feature_name: hb.feature_name,
                heartbeat_id: hb.heartbeat_id,
                ast_language: hb.ast_language,
                ast_confidence: hb.ast_confidence,
                keystrokes: hb.keystrokes,
                chars_added: hb.chars_added,
                chars_deleted: hb.chars_deleted,
                active_seconds: proven_active_seconds,
                active_seconds_claimed: claimed_active_seconds,
                activity_segments: serde_json::to_string(&hb.activity_segments)
                    .unwrap_or_else(|_| "[]".to_string()),
                is_ai_generated: hb.is_ai_generated,
                ai_agent: hb.ai_agent,
                ai_provider: hb.ai_provider,
                ai_model: hb.ai_model,
                identity_status: hb.identity_status,
                identity_reason: hb.identity_reason,
                identity_source: hb.identity_source,
                identity_schema_version: hb.identity_schema_version,
                identity_turn_id: hb.identity_turn_id,
                identity_message_id: hb.identity_message_id,
                ai_source: hb.ai_source,
                ai_confidence: hb.ai_confidence,
                ai_event_id: hb.ai_event_id,
                ai_change_id: hb.ai_change_id,
                prompt_character_count: hb.prompt_character_count,
                input_tokens: hb.input_tokens,
                output_tokens: hb.output_tokens,
                cache_read_tokens: hb.cache_read_tokens,
                cache_write_tokens: hb.cache_write_tokens,
                ai_subscription_plan: hb.ai_subscription_plan,
                token_source: hb.token_source,
                attribution_source: hb.attribution_source,
                attribution_confidence: hb.attribution_confidence,
                ai_event_fingerprint: fingerprint,
                ai_lines_added: hb.ai_lines_added,
                ai_lines_deleted: hb.ai_lines_deleted,
                human_lines_added,
                human_lines_deleted,
                unattributed_lines_added,
                unattributed_lines_deleted,
                created_at,
                actor_type: hb.actor_type.as_str().to_string(),
                actor_confidence: hb.actor_confidence,
                clipboard_tracking_version: hb.clipboard_tracking_version,
                copy_actions: hb.copy_actions,
                paste_actions: hb.paste_actions,
                copied_chars: hb.copied_chars,
                copied_lines: hb.copied_lines,
                pasted_chars: hb.pasted_chars,
                pasted_lines: hb.pasted_lines,
                paste_same_file_actions: hb.paste_same_file_actions,
                paste_same_workspace_actions: hb.paste_same_workspace_actions,
                paste_external_or_unknown_actions: hb.paste_external_or_unknown_actions,
                revision: hb.revision,
                session_id: hb.session_id,
                line_metric_version: hb.line_metric_version,
                line_measurement_status: hb.line_measurement_status,
                line_measurement_reason: hb.line_measurement_reason,
                measurement_window_id: hb.measurement_window_id,
            };

            if !duplicate_raw {
                rows.push(row);
            }
        }

        if clamped_claims > 0 {
            tracing::warn!(
                clamped_heartbeats = clamped_claims,
                clamped_seconds = clamped_seconds,
                max_segment_seconds = MAX_ACTIVITY_GAP_SECONDS,
                "heartbeat claimed more active time than one heartbeat can prove; clamped \
                 to the evidence window. Upgrade the client so it sends activity_segments."
            );
        }

        let inserted = rows.len();
        self.repo
            .insert_batch_with_token(rows, insert_token)
            .await?;
        #[cfg(feature = "kafka-spike")]
        if std::env::var("ATOAXIS_KAFKA_SPIKE_FAILURE_POINT")
            .ok()
            .as_deref()
            == Some("raw_before_interval")
        {
            anyhow::bail!("injected failure after raw heartbeat write");
        }
        // Raw heartbeat JSON remains the audit source. A projection failure must not
        // make the client retry an already accepted heartbeat; readers can rebuild it.
        let interval_token = insert_token.map(|token| format!("{token}:interval"));
        if let Err(error) = self
            .repo
            .insert_activity_intervals_with_token(interval_rows, interval_token.as_deref())
            .await
        {
            if strict_projection {
                return Err(error);
            }
            tracing::warn!("activity interval projection failed: {error}");
        }
        Ok(inserted)
    }

    /// Fetch heartbeats for one calendar day in the requested timezone.
    pub async fn get_by_date(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<HeartbeatRow>> {
        self.repo.get_by_date(user_id, range).await
    }
}

fn parse_created_at(created_at: &str) -> u32 {
    chrono::DateTime::parse_from_rfc3339(created_at)
        .map(|dt| dt.timestamp().max(0) as u32)
        .unwrap_or_else(|_| Utc::now().timestamp().max(0) as u32)
}

/// Stable privacy-safe bridge between hook and transcript transports. The canonical
/// fingerprint implementation is shared with the core dedup layer, so local
/// ingestion, reprocess and future producers cannot silently drift to a second
/// hashing scheme. It contains only derived metadata (not a patch or source body).
fn ai_event_fingerprint(heartbeat: &Heartbeat) -> Option<String> {
    if !heartbeat.actor_type.is_ai() {
        return None;
    }
    Some(
        fingerprint_for_heartbeat(
            heartbeat.project.as_deref(),
            heartbeat.branch.as_deref(),
            &heartbeat.entity,
            wakaclock_core::broker::BrokerChangeKind::Modify,
            heartbeat.time.floor() as i64,
            heartbeat.ai_lines_added,
            heartbeat.ai_lines_deleted,
            heartbeat.ai_change_id.as_deref(),
        )
        .to_string(),
    )
}

// `Heartbeat::ai_event_fingerprint` remains a privacy-safe audit field, but it is
// intentionally not used as an identity key. See the ingestion comment above.

/// Normalize the lexical tail for the fingerprint conformance tests. The fingerprint
/// is never used as authoritative ingestion identity.
/// A current revision proves identity existence, never a matching file payload.
fn readback_status(requested: u32, observed: Option<(u32, u64)>, available: bool) -> &'static str {
    match observed {
        Some((_, count)) if count > 1 => "conflict",
        Some((revision, _)) if revision > requested => "superseded",
        Some((revision, _)) if revision == requested => "found",
        Some(_) => "missing",
        None if !available => "unavailable",
        None => "missing",
    }
}

#[cfg(test)]
fn comparable_entity_key(entity: &str) -> String {
    let normalized = entity.replace('\\', "/");
    let mut tail = normalized
        .split('/')
        .filter(|part| !part.is_empty() && *part != ".")
        .rev()
        .take(2)
        .collect::<Vec<_>>();
    tail.reverse();
    if tail.is_empty() {
        "unknown".to_string()
    } else {
        tail.join("/")
    }
}

/// What a single heartbeat can actually prove, after the evidence window is applied.
pub struct HeartbeatEvidence {
    /// Clamped, non-empty segments — exactly the rows written to `activity_intervals`.
    pub segments: Vec<ActivitySegment>,
    /// Seconds a client claimed beyond what one heartbeat can prove. Reported, not stored.
    pub clamped_excess_seconds: f64,
}

impl HeartbeatEvidence {
    /// The overlap-free duration these segments prove. Two emitters covering the same
    /// second (the editor and an agent hook both reporting one file) contribute it once.
    pub fn proven_seconds(&self) -> f64 {
        union_activity_seconds(&self.segments)
    }
}

/// Reduce a heartbeat's activity claim to the evidence one heartbeat can carry.
///
/// A heartbeat proves at most `MAX_ACTIVITY_GAP_SECONDS`; that is the entire premise of
/// the canonical timeline. Two things used to escape it. A client that sent only
/// `active_seconds` had its whole claim turned into one segment of that length — a
/// 600-second claim became a 600-second segment — and the value stored on the heartbeat
/// row was the raw claim regardless, which is what every `mv_*_summary` sums. So the
/// aggregate surfaces and the duration surfaces measured different things and could not
/// be reconciled. Clamping in one place, and deriving the stored figure from the result,
/// is what makes them agree.
///
/// The excess is reported rather than discarded silently, and the remainder of a long
/// pause is still recoverable at read time by `bridge_idle_gaps` when a neighbouring
/// interval vouches for it.
pub fn clamp_to_evidence_window(
    activity_segments: &[ActivitySegment],
    active_seconds: Option<f64>,
    heartbeat_time: f64,
    heartbeat_id: &str,
) -> HeartbeatEvidence {
    let mut clamped_excess_seconds = 0.0;
    let mut segments: Vec<ActivitySegment> = activity_segments.to_vec();

    if segments.is_empty() {
        // A client that only knows `active_seconds` (any pre-segment build, and every
        // WakaTime import). Keep the trailing window it can prove, not the whole claim.
        if let Some(raw_seconds) = active_seconds.filter(|value| value.is_finite() && *value > 0.0)
        {
            let seconds = raw_seconds.min(MAX_ACTIVITY_GAP_SECONDS);
            if raw_seconds > MAX_ACTIVITY_GAP_SECONDS {
                clamped_excess_seconds += raw_seconds - seconds;
            }
            segments.push(ActivitySegment {
                segment_id: format!("{heartbeat_id}:legacy-segment"),
                start: (heartbeat_time - seconds).max(0.0),
                end: heartbeat_time,
                source: None,
            });
        }
    }

    let mut accepted = Vec::with_capacity(segments.len());
    for segment in segments {
        // `Heartbeat::validate` already rejects oversized explicit segments, so this
        // clamp only guards replayed and imported rows.
        let max_span = match segment.source.as_deref() {
            Some(source) if source.eq_ignore_ascii_case("editor_active_v1") => ACTIVE_LEASE_SECONDS,
            Some(source) if source.eq_ignore_ascii_case("ai_tool_v1") => {
                MAX_AI_TOOL_DURATION_SECONDS
            }
            Some(source) if source.eq_ignore_ascii_case("browser_foreground_v1") => {
                wakaclock_core::heartbeat::MAX_BROWSER_INTERVAL_SECONDS
            }
            _ => MAX_ACTIVITY_GAP_SECONDS,
        };
        let clamped_start = segment.start.max(segment.end - max_span);
        if clamped_start > segment.start && segment.start.is_finite() {
            clamped_excess_seconds += clamped_start - segment.start;
        }
        let segment = ActivitySegment {
            start: clamped_start,
            ..segment
        };
        if segment.end <= segment.start || !segment.start.is_finite() || !segment.end.is_finite() {
            continue;
        }
        accepted.push(segment);
    }

    HeartbeatEvidence {
        segments: accepted,
        clamped_excess_seconds,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ai_event_fingerprint, clamp_to_evidence_window, comparable_entity_key, readback_status,
    };
    use wakaclock_core::heartbeat::{
        ActivitySegment, ActorType, EntityType, Heartbeat, MAX_ACTIVITY_GAP_SECONDS,
    };

    #[test]
    fn readback_keeps_missing_revision_conflict_and_unavailable_separate() {
        assert_eq!(readback_status(0, None, false), "unavailable");
        assert_eq!(readback_status(0, None, true), "missing");
        assert_eq!(readback_status(3, Some((2, 1)), true), "missing");
        assert_eq!(readback_status(2, Some((2, 1)), true), "found");
        assert_eq!(readback_status(1, Some((2, 1)), true), "superseded");
        assert_eq!(readback_status(2, Some((2, 2)), true), "conflict");
    }

    #[test]
    fn fingerprint_is_stable_for_the_same_derived_event() {
        let mut heartbeat = Heartbeat::new(
            uuid::Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.time = 100.1;
        heartbeat.actor_type = ActorType::AiVerified;
        heartbeat.actor_confidence = 1.0;
        heartbeat.is_ai_generated = true;
        heartbeat.ai_lines_added = Some(3);
        assert_eq!(
            ai_event_fingerprint(&heartbeat),
            ai_event_fingerprint(&heartbeat)
        );
    }

    #[test]
    fn hook_and_transcript_payloads_share_one_cross_transport_fingerprint() {
        // Hook producers report an absolute path and their own event id; transcript
        // replay commonly reports a workspace-relative path and a different id. The
        // privacy-safe fingerprint deliberately ignores those transport details while
        // retaining the entity tail, project/branch, five-second bucket and line delta.
        let mut hook = Heartbeat::new(
            uuid::Uuid::nil(),
            "/workspace/src/main.rs".to_string(),
            EntityType::File,
            "agent-hook".to_string(),
        );
        hook.time = 102.1;
        hook.project = Some("wakaclock".to_string());
        hook.branch = Some("main".to_string());
        hook.actor_type = ActorType::AiVerified;
        hook.actor_confidence = 1.0;
        hook.is_ai_generated = true;
        hook.ai_agent = Some("claude-code".to_string());
        hook.ai_provider = Some("anthropic".to_string());
        hook.ai_model = Some("claude-sonnet".to_string());
        hook.ai_source = Some("agent_hook".to_string());
        hook.ai_event_id = Some("hook-event".to_string());
        hook.ai_lines_added = Some(3);
        hook.ai_lines_deleted = Some(1);

        let mut transcript = hook.clone();
        transcript.entity = "src/main.rs".to_string();
        transcript.user_agent = "transcript".to_string();
        transcript.time = 104.8;
        transcript.ai_source = Some("transcript".to_string());
        transcript.ai_event_id = Some("transcript-event".to_string());

        assert_eq!(
            ai_event_fingerprint(&hook),
            ai_event_fingerprint(&transcript),
            "the same edit observed by two transports must be one canonical activity"
        );
    }

    #[test]
    fn manual_heartbeats_have_no_ai_fingerprint() {
        let heartbeat = Heartbeat::new(
            uuid::Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        assert!(ai_event_fingerprint(&heartbeat).is_none());
    }

    /// The defect behind docs/duration-accuracy-audit.md Finding 4: a client claim longer
    /// than one heartbeat can prove was clamped for `activity_intervals` but stored raw on
    /// the heartbeat row, and `mv_*_summary` sums that row. 23 rows in the audited sample
    /// claimed up to 845s, so the MV-backed surfaces read minutes higher than the duration
    /// endpoints on the very same evidence.
    #[test]
    fn an_oversized_claim_is_clamped_to_what_one_heartbeat_can_prove() {
        let evidence = clamp_to_evidence_window(&[], Some(600.0), 1_000.0, "hb");

        assert_eq!(evidence.segments.len(), 1);
        assert_eq!(evidence.proven_seconds(), MAX_ACTIVITY_GAP_SECONDS);
        assert_eq!(
            evidence.clamped_excess_seconds,
            600.0 - MAX_ACTIVITY_GAP_SECONDS
        );
        // The window ends at the heartbeat and reaches back only as far as it can prove.
        assert_eq!(evidence.segments[0].end, 1_000.0);
        assert_eq!(
            evidence.segments[0].start,
            1_000.0 - MAX_ACTIVITY_GAP_SECONDS
        );
    }

    /// A claim inside the window is evidence, not something to be trimmed.
    #[test]
    fn a_claim_within_the_window_is_kept_whole() {
        let evidence = clamp_to_evidence_window(&[], Some(45.0), 1_000.0, "hb");

        assert_eq!(evidence.proven_seconds(), 45.0);
        assert_eq!(evidence.clamped_excess_seconds, 0.0);
    }

    /// Overlapping segments — the editor and an agent hook both reporting the same file
    /// over the same seconds — prove that time once. Summing them is how a single wall
    /// clock second became two or three seconds of reported work.
    #[test]
    fn overlapping_segments_prove_their_union_not_their_sum() {
        let segments = vec![
            ActivitySegment {
                segment_id: "a".to_string(),
                start: 100.0,
                end: 160.0,
                source: Some("editor".to_string()),
            },
            ActivitySegment {
                segment_id: "b".to_string(),
                start: 130.0,
                end: 190.0,
                source: Some("ai".to_string()),
            },
        ];

        let evidence = clamp_to_evidence_window(&segments, Some(120.0), 190.0, "hb");

        // 100..190, not 60 + 60.
        assert_eq!(evidence.proven_seconds(), 90.0);
    }

    /// An explicit segment is authoritative, so a stale `active_seconds` alongside it must
    /// not add a second phantom interval.
    #[test]
    fn explicit_segments_win_over_a_legacy_active_seconds_claim() {
        let segments = vec![ActivitySegment {
            segment_id: "a".to_string(),
            start: 100.0,
            end: 110.0,
            source: Some("editor".to_string()),
        }];

        let evidence = clamp_to_evidence_window(&segments, Some(600.0), 110.0, "hb");

        assert_eq!(evidence.segments.len(), 1);
        assert_eq!(evidence.proven_seconds(), 10.0);
    }

    /// A heartbeat with nothing to prove stays a heartbeat. It becomes a zero-length
    /// anchor in the timeline rather than being dropped, which is what lets a session
    /// resume after a break.
    #[test]
    fn a_heartbeat_with_no_measurable_activity_proves_nothing_and_is_not_an_error() {
        let evidence = clamp_to_evidence_window(&[], None, 1_000.0, "hb");

        assert!(evidence.segments.is_empty());
        assert_eq!(evidence.proven_seconds(), 0.0);
        assert_eq!(evidence.clamped_excess_seconds, 0.0);
    }

    /// A replayed row whose segment is longer than the window keeps its trailing edge.
    #[test]
    fn an_oversized_explicit_segment_keeps_its_trailing_window() {
        let segments = vec![ActivitySegment {
            segment_id: "a".to_string(),
            start: 0.0,
            end: 900.0,
            source: None,
        }];

        let evidence = clamp_to_evidence_window(&segments, None, 900.0, "hb");

        assert_eq!(evidence.proven_seconds(), MAX_ACTIVITY_GAP_SECONDS);
        assert_eq!(evidence.segments[0].end, 900.0);
        assert_eq!(
            evidence.clamped_excess_seconds,
            900.0 - MAX_ACTIVITY_GAP_SECONDS
        );
    }

    #[test]
    fn completed_ai_tool_interval_keeps_its_observed_start_and_end() {
        let segments = vec![ActivitySegment {
            segment_id: "tool".to_string(),
            start: 0.0,
            end: 600.0,
            source: Some("ai_tool_v1".to_string()),
        }];

        let evidence = clamp_to_evidence_window(&segments, None, 600.0, "hb");

        assert_eq!(evidence.proven_seconds(), 600.0);
        assert_eq!(evidence.clamped_excess_seconds, 0.0);
    }

    #[test]
    fn editor_active_interval_is_bounded_by_the_fifteen_second_lease() {
        let segments = vec![ActivitySegment {
            segment_id: "editor".to_string(),
            start: 0.0,
            end: 60.0,
            source: Some("editor_active_v1".to_string()),
        }];

        let evidence = clamp_to_evidence_window(&segments, None, 60.0, "hb");

        assert_eq!(evidence.proven_seconds(), 15.0);
        assert_eq!(evidence.segments[0].start, 45.0);
        assert_eq!(evidence.segments[0].end, 60.0);
    }

    #[test]
    fn fingerprint_path_key_bridges_absolute_and_relative_transport_paths() {
        assert_eq!(
            comparable_entity_key("/Users/alice/workspace/src/main.rs"),
            comparable_entity_key("src/main.rs")
        );
        assert_eq!(
            comparable_entity_key(r"C:\workspace\src\main.rs"),
            comparable_entity_key("src/main.rs")
        );
    }
}
