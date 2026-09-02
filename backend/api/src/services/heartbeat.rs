use anyhow::Result;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;
use wakaclock_core::heartbeat::{
    normalize_activity_source, union_activity_seconds, ActivitySegment, Heartbeat,
    MAX_ACTIVITY_GAP_SECONDS,
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

    /// Process incoming heartbeats และ insert ลง repository
    pub async fn process_heartbeats(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
    ) -> Result<usize> {
        let mut heartbeats = heartbeats;
        // Older clients did not send a transport ID. Derive a stable compatibility ID
        // from immutable marker fields so a retry of the same legacy payload cannot
        // create a second canonical interval. New clients always carry a random UUID.
        for heartbeat in &mut heartbeats {
            if heartbeat.heartbeat_id.is_none() {
                heartbeat.heartbeat_id = Some(format!(
                    "legacy:{:.6}:{}:{}:{}",
                    heartbeat.time, heartbeat.entity, heartbeat.is_write, heartbeat.category
                ));
            }
        }
        let mut rows = Vec::with_capacity(heartbeats.len());
        let mut interval_rows = Vec::new();
        // Surfaced rather than swallowed: a client whose claims are being clamped is
        // reporting less time than it observed, and that used to be invisible.
        let mut clamped_claims = 0u32;
        let mut clamped_seconds = 0.0f64;
        let mut batch_heartbeat_ids = HashSet::new();
        let mut batch_event_ids = HashSet::new();
        let candidate_heartbeat_ids: Vec<String> = heartbeats
            .iter()
            .filter_map(|heartbeat| heartbeat.heartbeat_id.clone())
            .collect();
        let existing_heartbeat_ids: HashSet<String> = self
            .repo
            .existing_heartbeat_ids(user_id, &candidate_heartbeat_ids)
            .await?
            .into_iter()
            .collect();
        let candidate_event_ids: Vec<String> = heartbeats
            .iter()
            .filter_map(|heartbeat| heartbeat.ai_event_id.clone())
            .collect();
        let existing_event_ids: HashSet<String> = self
            .repo
            .existing_ai_event_ids(user_id, &candidate_event_ids)
            .await?
            .into_iter()
            .collect();
        let candidate_fingerprints: Vec<String> =
            heartbeats.iter().filter_map(ai_event_fingerprint).collect();
        let existing_fingerprints: HashSet<String> = self
            .repo
            .existing_ai_fingerprints(user_id, &candidate_fingerprints)
            .await?
            .into_iter()
            .collect();
        let mut batch_fingerprints = HashSet::new();

        for mut hb in heartbeats {
            if let Some(heartbeat_id) = hb.heartbeat_id.as_ref() {
                if existing_heartbeat_ids.contains(heartbeat_id)
                    || !batch_heartbeat_ids.insert(heartbeat_id.clone())
                {
                    continue;
                }
            }
            // Bulk retries can contain the same AI event twice. De-duplicate within
            // the request before it reaches ClickHouse; the opaque id is supplied by
            // the agent hook and is not derived from source content.
            if let Some(event_id) = hb.ai_event_id.as_ref() {
                if existing_event_ids.contains(event_id)
                    || !batch_event_ids.insert(event_id.clone())
                {
                    continue;
                }
            }

            let fingerprint = ai_event_fingerprint(&hb);
            if let Some(fingerprint) = fingerprint.as_ref() {
                if existing_fingerprints.contains(fingerprint)
                    || !batch_fingerprints.insert(fingerprint.clone())
                {
                    continue;
                }
            }

            if !machine.is_empty() {
                hb.machine = machine.clone();
            }

            // Project identity belongs on the raw heartbeat at write time. Project-detail
            // projections can then group by a stable ID even when a display name is renamed
            // later; historical NULL rows remain explicitly backfillable in PR 9.9.
            hb.project_id = self
                .project_identity_service
                .resolve_project_id(user_id, hb.project.as_deref(), None)
                .await?;

            let date = (hb.time as i64 / 86400).max(0) as u16;
            let created_at = parse_created_at(&hb.created_at);
            let interval_heartbeat_id = hb
                .heartbeat_id
                .clone()
                .unwrap_or_else(|| format!("legacy:{}:{:.6}", hb.entity, hb.time));
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
            for segment in evidence.segments {
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
                    category: format!("{:?}", hb.category).to_lowercase(),
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
                category: format!("{:?}", hb.category).to_lowercase(),
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
            };

            rows.push(row);
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
        self.repo.insert_batch(rows).await?;
        // Raw heartbeat JSON remains the audit source. A projection failure must not
        // make the client retry an already accepted heartbeat; readers can rebuild it.
        if let Err(error) = self.repo.insert_activity_intervals(interval_rows).await {
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

/// Stable privacy-safe bridge between hook and transcript transports. It contains only
/// derived metadata (not a patch or source body) and uses a five-second bucket matching
/// the editor correlation window. The file path is included only as a one-way hash input.
fn ai_event_fingerprint(heartbeat: &Heartbeat) -> Option<String> {
    if !heartbeat.actor_type.is_ai() {
        return None;
    }
    let bucket = (heartbeat.time / 5.0).floor() as i64;
    let mut hasher = Sha256::new();
    let comparable_entity = comparable_entity_key(&heartbeat.entity);
    let values = [
        comparable_entity.as_str(),
        heartbeat.project.as_deref().unwrap_or_default(),
        heartbeat.branch.as_deref().unwrap_or_default(),
        &bucket.to_string(),
        &heartbeat.ai_lines_added.unwrap_or_default().to_string(),
        &heartbeat.ai_lines_deleted.unwrap_or_default().to_string(),
        heartbeat.ai_agent.as_deref().unwrap_or_default(),
        heartbeat.ai_provider.as_deref().unwrap_or_default(),
        heartbeat.ai_model.as_deref().unwrap_or_default(),
    ];
    for value in values {
        hasher.update(value.as_bytes());
        hasher.update([0]);
    }
    Some(format!("v1:{:x}", hasher.finalize()))
}

/// Hook payloads commonly carry an absolute path while transcript replay carries a
/// workspace-relative path. Keep only the final two lexical components as a hash input so
/// those transports can converge without storing or logging the path itself. The project and
/// branch are included separately to keep same-named files in different workspaces apart.
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
        let clamped_start = segment.start.max(segment.end - MAX_ACTIVITY_GAP_SECONDS);
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
    use super::{ai_event_fingerprint, clamp_to_evidence_window, comparable_entity_key};
    use wakaclock_core::heartbeat::{
        ActivitySegment, ActorType, EntityType, Heartbeat, MAX_ACTIVITY_GAP_SECONDS,
    };

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
