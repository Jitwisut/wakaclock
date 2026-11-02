//! Durable attribution correction primitives.
//!
//! A correlation result is allowed to be corrected when stronger evidence arrives
//! later, but the correction must re-use the activity values measured at the original
//! observation.  This module owns the pure rules used by the local ledger in
//! [`super::state::AiAttributionState`]: revision `0` is the first decision, every
//! later revision is a full-value replacement, and an identical payload is idempotent.
//!
//! Alias proof is intentionally stricter than the old time/line fingerprint.  A
//! producer event may be aliased only when the two producers share a native tool
//! event ID or an independently captured content-version signal for the same entity.
//! Session ID by itself is not enough: one session can contain many edits.

use crate::ai::event::is_safe_event_id;
use crate::heartbeat::ActorType;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// The initial late-reconciliation grace window proposed by the F0 design.
pub const LATE_RECONCILIATION_GRACE_SECONDS: i64 = 15;
/// Keep superseded correction rows for a month so a delayed producer can still be
/// reconciled after a restart. The current (max-revision) row is retained forever by
/// the pruning query, even when it is older than this value.
pub const ATTRIBUTION_REVISION_RETENTION_SECONDS: i64 = 30 * 24 * 60 * 60;
/// Alias mappings have the same bounded history as superseded revisions.
pub const EVENT_ALIAS_RETENTION_SECONDS: i64 = 30 * 24 * 60 * 60;
/// Pending observations must outlive the grace window; F1's server-side pending store
/// will use this same policy until benchmark data justifies a different value.
pub const PENDING_OBSERVATION_RETENTION_SECONDS: i64 = 24 * 60 * 60;

/// Retention values shared by the local ledger and the planned server tables.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct AttributionRetentionPolicy {
    pub late_reconciliation_grace_seconds: i64,
    pub revision_retention_seconds: i64,
    pub alias_retention_seconds: i64,
    pub pending_observation_retention_seconds: i64,
}

impl Default for AttributionRetentionPolicy {
    fn default() -> Self {
        Self {
            late_reconciliation_grace_seconds: LATE_RECONCILIATION_GRACE_SECONDS,
            revision_retention_seconds: ATTRIBUTION_REVISION_RETENTION_SECONDS,
            alias_retention_seconds: EVENT_ALIAS_RETENTION_SECONDS,
            pending_observation_retention_seconds: PENDING_OBSERVATION_RETENTION_SECONDS,
        }
    }
}

impl AttributionRetentionPolicy {
    /// Validate the ordering that makes late reconciliation possible. Keeping this
    /// check beside the constants prevents a future migration from silently choosing
    /// a retention window shorter than the grace period it is meant to support.
    pub fn validate(self) -> Result<(), String> {
        if self.late_reconciliation_grace_seconds < 0
            || self.revision_retention_seconds < 0
            || self.alias_retention_seconds < 0
            || self.pending_observation_retention_seconds < 0
        {
            return Err("attribution retention values must be non-negative".to_string());
        }
        if self.revision_retention_seconds < self.late_reconciliation_grace_seconds {
            return Err(
                "revision retention must cover the late-reconciliation grace window".to_string(),
            );
        }
        if self.alias_retention_seconds < self.late_reconciliation_grace_seconds {
            return Err(
                "alias retention must cover the late-reconciliation grace window".to_string(),
            );
        }
        if self.pending_observation_retention_seconds < self.late_reconciliation_grace_seconds {
            return Err(
                "pending-observation retention must cover the late-reconciliation grace window"
                    .to_string(),
            );
        }
        Ok(())
    }
}

/// The proof which permits two producer event IDs to share one canonical operation.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AliasProofKind {
    ToolEventAndEntity,
    ContentVersionAndEntity,
    /// The Claude Code hook (plugin <= 1.0.2) reports a digest of
    /// `session|tool_use_id|file` instead of the raw tool ID. Recomputing that digest
    /// from the transcript's own session, tool ID and entity is the same tool-call
    /// proof as [`Self::ToolEventAndEntity`], only encoded; it is never a time match.
    LegacyHookDigestAndEntity,
}

impl AliasProofKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ToolEventAndEntity => "tool_event_and_entity",
            Self::ContentVersionAndEntity => "content_version_and_entity",
            Self::LegacyHookDigestAndEntity => "legacy_hook_digest_and_entity",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "tool_event_and_entity" => Some(Self::ToolEventAndEntity),
            "content_version_and_entity" => Some(Self::ContentVersionAndEntity),
            "legacy_hook_digest_and_entity" => Some(Self::LegacyHookDigestAndEntity),
            _ => None,
        }
    }
}

/// The event ID the Claude Code hook script assigns to one file edit:
/// `claude-code-` plus the first 40 hex characters of SHA-256 over
/// `session_id|tool_use_id|file_path`. Mirrors `EVENT_MATERIAL`/`EVENT_HASH` in
/// `extensions/ai-agents/plugins/atoaxis-heartbeat/scripts/heartbeat.sh`; the two must
/// change together.
pub fn legacy_claude_hook_event_id(session_id: &str, tool_use_id: &str, entity: &str) -> String {
    let digest = format!(
        "{:x}",
        Sha256::digest(format!("{session_id}|{tool_use_id}|{entity}").as_bytes())
    );
    format!("claude-code-{}", &digest[..40])
}

fn legacy_hook_digest_matches(hook: &AliasEvidence, transcript: &AliasEvidence) -> bool {
    match (
        transcript.session_id.as_deref(),
        transcript.tool_event_id.as_deref(),
    ) {
        (Some(session_id), Some(tool_use_id))
            if !session_id.is_empty() && !tool_use_id.is_empty() =>
        {
            hook.event_id
                == legacy_claude_hook_event_id(session_id, tool_use_id, &transcript.entity)
        }
        _ => false,
    }
}

/// Metadata that two producers can independently report for one edit. It deliberately
/// excludes source text, prompts, commands and file paths; `entity` is an opaque,
/// normalized identity used only while checking the proof.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AliasEvidence {
    pub event_id: String,
    pub entity: String,
    pub tool_event_id: Option<String>,
    pub session_id: Option<String>,
    pub content_version: Option<String>,
}

impl AliasEvidence {
    pub fn new(event_id: impl Into<String>, entity: impl Into<String>) -> Self {
        Self {
            event_id: event_id.into(),
            entity: entity.into(),
            tool_event_id: None,
            session_id: None,
            content_version: None,
        }
    }

    pub fn with_tool_event_id(mut self, value: impl Into<String>) -> Self {
        self.tool_event_id = Some(value.into());
        self
    }

    pub fn with_session_id(mut self, value: impl Into<String>) -> Self {
        self.session_id = Some(value.into());
        self
    }

    pub fn with_content_version(mut self, value: impl Into<String>) -> Self {
        self.content_version = Some(value.into());
        self
    }
}

fn matching_non_empty(left: Option<&String>, right: Option<&String>) -> bool {
    matches!((left, right), (Some(left), Some(right)) if !left.is_empty() && left == right)
}

fn conflicting_values(left: Option<&String>, right: Option<&String>) -> bool {
    matches!((left, right), (Some(left), Some(right)) if left != right)
}

/// Return the only proof kind accepted for an alias, if one exists.
///
/// A mismatch in a signal that both producers supplied is treated as a conflict,
/// even if another signal happens to match. This avoids silently merging two events
/// when their independently captured versions disagree. `session_id` is retained in
/// the evidence for diagnostics, but is never accepted as proof on its own.
pub fn prove_alias(left: &AliasEvidence, right: &AliasEvidence) -> Option<AliasProofKind> {
    if left.event_id == right.event_id
        || left.event_id.is_empty()
        || right.event_id.is_empty()
        || left.entity.is_empty()
        || left.entity != right.entity
    {
        return None;
    }

    // Checked before the conflict rule: a legacy hook's tool ID is its own digest, so it
    // never equals the transcript's raw tool ID even though both name one tool call.
    if legacy_hook_digest_matches(left, right) || legacy_hook_digest_matches(right, left) {
        return Some(AliasProofKind::LegacyHookDigestAndEntity);
    }

    if conflicting_values(left.tool_event_id.as_ref(), right.tool_event_id.as_ref())
        || conflicting_values(
            left.content_version.as_ref(),
            right.content_version.as_ref(),
        )
    {
        return None;
    }

    if matching_non_empty(left.tool_event_id.as_ref(), right.tool_event_id.as_ref()) {
        return Some(AliasProofKind::ToolEventAndEntity);
    }
    if matching_non_empty(
        left.content_version.as_ref(),
        right.content_version.as_ref(),
    ) {
        return Some(AliasProofKind::ContentVersionAndEntity);
    }
    None
}

/// A candidate correction before the local ledger assigns its monotonically
/// increasing revision number.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RevisionCandidate {
    pub operation_id: String,
    pub payload_hash: String,
    pub actor_type: ActorType,
    pub actor_confidence: f32,
    pub active_seconds: f64,
    pub human_lines_added: u32,
    pub human_lines_deleted: u32,
    pub ai_lines_added: u32,
    pub ai_lines_deleted: u32,
    pub unattributed_lines_added: u32,
    pub unattributed_lines_deleted: u32,
    pub created_at: i64,
}

impl RevisionCandidate {
    pub fn validate(&self) -> Result<(), String> {
        if !is_safe_event_id(&self.operation_id) {
            return Err("operation_id is not a safe event ID".to_string());
        }
        if self.payload_hash.is_empty() || self.payload_hash.len() > 128 {
            return Err("payload_hash must be between 1 and 128 bytes".to_string());
        }
        if !self.actor_confidence.is_finite() || !(0.0..=1.0).contains(&self.actor_confidence) {
            return Err("actor_confidence must be finite and between 0 and 1".to_string());
        }
        if !self.active_seconds.is_finite() || self.active_seconds < 0.0 {
            return Err("active_seconds must be finite and non-negative".to_string());
        }
        Ok(())
    }
}

/// A stored full-value attribution decision. A correction repeats the measured
/// activity so readers can select one max-revision row without summing deltas.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttributionRevision {
    pub operation_id: String,
    pub revision: u32,
    pub payload_hash: String,
    pub actor_type: ActorType,
    pub actor_confidence: f32,
    pub active_seconds: f64,
    pub human_lines_added: u32,
    pub human_lines_deleted: u32,
    pub ai_lines_added: u32,
    pub ai_lines_deleted: u32,
    pub unattributed_lines_added: u32,
    pub unattributed_lines_deleted: u32,
    pub created_at: i64,
}

impl AttributionRevision {
    pub fn from_candidate(candidate: RevisionCandidate, revision: u32) -> Result<Self, String> {
        candidate.validate()?;
        Ok(Self {
            operation_id: candidate.operation_id,
            revision,
            payload_hash: candidate.payload_hash,
            actor_type: candidate.actor_type,
            actor_confidence: candidate.actor_confidence,
            active_seconds: candidate.active_seconds,
            human_lines_added: candidate.human_lines_added,
            human_lines_deleted: candidate.human_lines_deleted,
            ai_lines_added: candidate.ai_lines_added,
            ai_lines_deleted: candidate.ai_lines_deleted,
            unattributed_lines_added: candidate.unattributed_lines_added,
            unattributed_lines_deleted: candidate.unattributed_lines_deleted,
            created_at: candidate.created_at,
        })
    }

    /// Corrections may move measured lines between attribution buckets, but they may
    /// not change the observed activity or manufacture additional lines. The measured
    /// totals are therefore invariant across revisions.
    pub fn preserves_measurement(&self, candidate: &RevisionCandidate) -> bool {
        self.active_seconds == candidate.active_seconds
            && u64::from(self.human_lines_added)
                + u64::from(self.ai_lines_added)
                + u64::from(self.unattributed_lines_added)
                == u64::from(candidate.human_lines_added)
                    + u64::from(candidate.ai_lines_added)
                    + u64::from(candidate.unattributed_lines_added)
            && u64::from(self.human_lines_deleted)
                + u64::from(self.ai_lines_deleted)
                + u64::from(self.unattributed_lines_deleted)
                == u64::from(candidate.human_lines_deleted)
                    + u64::from(candidate.ai_lines_deleted)
                    + u64::from(candidate.unattributed_lines_deleted)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RevisionWriteOutcome {
    Unchanged { revision: u32 },
    Inserted { revision: u32 },
}

/// Pure revision transition used by both the SQLite ledger and future server-side
/// storage. A repeated payload is a no-op; a new payload advances exactly one step.
pub fn next_revision(
    previous: Option<&AttributionRevision>,
    candidate: RevisionCandidate,
) -> Result<(RevisionWriteOutcome, Option<AttributionRevision>), String> {
    candidate.validate()?;
    if let Some(previous) = previous {
        if previous.operation_id != candidate.operation_id {
            return Err("attribution revision operation ID cannot change".to_string());
        }
        if previous.payload_hash == candidate.payload_hash {
            return Ok((
                RevisionWriteOutcome::Unchanged {
                    revision: previous.revision,
                },
                None,
            ));
        }
        if !previous.preserves_measurement(&candidate) {
            return Err(
                "attribution revision cannot change measured time or line totals".to_string(),
            );
        }
        let revision = previous
            .revision
            .checked_add(1)
            .ok_or_else(|| "attribution revision overflow".to_string())?;
        let stored = AttributionRevision::from_candidate(candidate, revision)?;
        return Ok((RevisionWriteOutcome::Inserted { revision }, Some(stored)));
    }

    let stored = AttributionRevision::from_candidate(candidate, 0)?;
    Ok((RevisionWriteOutcome::Inserted { revision: 0 }, Some(stored)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(
        operation_id: &str,
        payload_hash: &str,
        actor_type: ActorType,
    ) -> RevisionCandidate {
        RevisionCandidate {
            operation_id: operation_id.to_string(),
            payload_hash: payload_hash.to_string(),
            actor_type,
            actor_confidence: 0.8,
            active_seconds: 12.0,
            human_lines_added: 4,
            human_lines_deleted: 1,
            ai_lines_added: 0,
            ai_lines_deleted: 0,
            unattributed_lines_added: 0,
            unattributed_lines_deleted: 0,
            created_at: 100,
        }
    }

    #[test]
    fn default_retention_covers_the_grace_window() {
        AttributionRetentionPolicy::default().validate().unwrap();
        assert_eq!(LATE_RECONCILIATION_GRACE_SECONDS, 15);
        assert_eq!(PENDING_OBSERVATION_RETENTION_SECONDS, 24 * 60 * 60);
    }

    #[test]
    fn tool_event_and_entity_is_direct_alias_proof() {
        let left = AliasEvidence::new("hook-1", "entity-1").with_tool_event_id("call-9");
        let right = AliasEvidence::new("transcript-1", "entity-1")
            .with_tool_event_id("call-9")
            .with_session_id("session-1");
        assert_eq!(
            prove_alias(&left, &right),
            Some(AliasProofKind::ToolEventAndEntity)
        );
    }

    #[test]
    fn time_or_session_proximity_without_direct_proof_is_not_an_alias() {
        let left = AliasEvidence::new("hook-1", "entity-1").with_session_id("session-1");
        let right = AliasEvidence::new("transcript-1", "entity-1").with_session_id("session-1");
        assert_eq!(prove_alias(&left, &right), None);
    }

    #[test]
    fn legacy_hook_digest_matches_the_hook_script() {
        // Expected value computed with the hook's own pipeline:
        // printf '%s' 'session-1|toolu_01|/repo/src/a.rs' | shasum -a 256 | cut -c1-40
        assert_eq!(
            legacy_claude_hook_event_id("session-1", "toolu_01", "/repo/src/a.rs"),
            "claude-code-c4e65e5557b717c9a8d955f89b8d58d34f79bd04"
        );
    }

    #[test]
    fn legacy_hook_digest_is_tool_call_alias_proof() {
        let hook_id = legacy_claude_hook_event_id("session-1", "toolu_01", "/repo/src/a.rs");
        let hook = AliasEvidence::new(hook_id.clone(), "/repo/src/a.rs")
            .with_tool_event_id(hook_id)
            .with_session_id("session-1");
        let transcript = AliasEvidence::new("claude-code-v1:toolu_01", "/repo/src/a.rs")
            .with_tool_event_id("toolu_01")
            .with_session_id("session-1");
        assert_eq!(
            prove_alias(&transcript, &hook),
            Some(AliasProofKind::LegacyHookDigestAndEntity)
        );
        assert_eq!(
            prove_alias(&hook, &transcript),
            Some(AliasProofKind::LegacyHookDigestAndEntity)
        );
    }

    #[test]
    fn legacy_hook_digest_requires_the_same_call_session_and_file() {
        let hook_id = legacy_claude_hook_event_id("session-1", "toolu_01", "/repo/src/a.rs");
        let hook =
            AliasEvidence::new(hook_id.clone(), "/repo/src/a.rs").with_tool_event_id(hook_id);
        for (session, tool, entity) in [
            ("session-2", "toolu_01", "/repo/src/a.rs"),
            ("session-1", "toolu_02", "/repo/src/a.rs"),
        ] {
            let transcript = AliasEvidence::new("claude-code-v1:other", entity)
                .with_tool_event_id(tool)
                .with_session_id(session);
            assert_eq!(prove_alias(&transcript, &hook), None);
        }
        // A different file is a different entity, so it never reaches the digest check.
        let other_file = AliasEvidence::new("claude-code-v1:toolu_01", "/repo/src/b.rs")
            .with_tool_event_id("toolu_01")
            .with_session_id("session-1");
        assert_eq!(prove_alias(&other_file, &hook), None);
        // Without a session the digest cannot be recomputed, so there is no proof.
        let no_session = AliasEvidence::new("claude-code-v1:toolu_01", "/repo/src/a.rs")
            .with_tool_event_id("toolu_01");
        assert_eq!(prove_alias(&no_session, &hook), None);
    }

    #[test]
    fn legacy_hook_digest_proof_kind_round_trips() {
        let kind = AliasProofKind::LegacyHookDigestAndEntity;
        assert_eq!(AliasProofKind::parse(kind.as_str()), Some(kind));
    }

    #[test]
    fn conflicting_content_versions_are_rejected() {
        let left = AliasEvidence::new("hook-1", "entity-1")
            .with_tool_event_id("call-9")
            .with_content_version("v1");
        let right = AliasEvidence::new("transcript-1", "entity-1")
            .with_tool_event_id("call-9")
            .with_content_version("v2");
        assert_eq!(prove_alias(&left, &right), None);
    }

    #[test]
    fn first_revision_is_zero_and_retry_is_idempotent() {
        let first = candidate("event-1", "hash-1", ActorType::Unknown);
        let (outcome, stored) = next_revision(None, first.clone()).unwrap();
        assert_eq!(outcome, RevisionWriteOutcome::Inserted { revision: 0 });
        let stored = stored.unwrap();
        assert_eq!(stored.revision, 0);

        let (retry, replacement) = next_revision(Some(&stored), first).unwrap();
        assert_eq!(retry, RevisionWriteOutcome::Unchanged { revision: 0 });
        assert!(replacement.is_none());
    }

    #[test]
    fn new_evidence_creates_a_full_value_correction() {
        let first = AttributionRevision::from_candidate(
            candidate("event-1", "hash-1", ActorType::Unknown),
            0,
        )
        .unwrap();
        let (outcome, replacement) = next_revision(
            Some(&first),
            candidate("event-1", "hash-2", ActorType::AiVerified),
        )
        .unwrap();
        assert_eq!(outcome, RevisionWriteOutcome::Inserted { revision: 1 });
        let replacement = replacement.unwrap();
        assert_eq!(replacement.revision, 1);
        assert_eq!(replacement.actor_type, ActorType::AiVerified);
        assert_eq!(replacement.active_seconds, first.active_seconds);
        assert_eq!(replacement.human_lines_added, first.human_lines_added);
    }

    #[test]
    fn correction_can_move_lines_between_buckets_without_adding_activity() {
        let first = AttributionRevision::from_candidate(
            RevisionCandidate {
                unattributed_lines_added: 4,
                unattributed_lines_deleted: 1,
                ..candidate("event-1", "hash-1", ActorType::Unknown)
            },
            0,
        )
        .unwrap();
        let (outcome, replacement) = next_revision(
            Some(&first),
            RevisionCandidate {
                ai_lines_added: 4,
                ai_lines_deleted: 1,
                ..candidate("event-1", "hash-2", ActorType::AiVerified)
            },
        )
        .unwrap();
        assert_eq!(outcome, RevisionWriteOutcome::Inserted { revision: 1 });
        let replacement = replacement.unwrap();
        assert_eq!(replacement.unattributed_lines_added, 0);
        assert_eq!(replacement.ai_lines_added, 4);
        assert_eq!(replacement.active_seconds, first.active_seconds);
    }

    #[test]
    fn correction_rejects_new_measured_lines() {
        let first = AttributionRevision::from_candidate(
            candidate("event-1", "hash-1", ActorType::Unknown),
            0,
        )
        .unwrap();
        let result = next_revision(
            Some(&first),
            RevisionCandidate {
                ai_lines_added: 1,
                ..candidate("event-1", "hash-2", ActorType::AiVerified)
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn correction_cannot_switch_to_another_operation() {
        let first = AttributionRevision::from_candidate(
            candidate("event-1", "hash-1", ActorType::Unknown),
            0,
        )
        .unwrap();
        let result = next_revision(
            Some(&first),
            candidate("event-2", "hash-2", ActorType::AiVerified),
        );
        assert!(result.is_err());
    }

    #[test]
    fn invalid_retention_order_is_rejected() {
        let policy = AttributionRetentionPolicy {
            late_reconciliation_grace_seconds: 20,
            revision_retention_seconds: 10,
            ..Default::default()
        };
        assert!(policy.validate().is_err());
    }
}
