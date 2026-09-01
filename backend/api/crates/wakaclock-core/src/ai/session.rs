//! planai2.md Phase 4 (p4.1): the **agent session / process evidence model**.
//!
//! Session and process activity is *corroborating* evidence that an agent was
//! working in a workspace around a time — it is never, on its own, a verdict that
//! the agent edited a particular file. Turning it into `ai_inferred` (only ever
//! combined with a filesystem change and a time-window match, and never on
//! process name alone) is the Phase 5 correlation engine's job.
//!
//! By construction this type has **no field for command-line arguments or
//! environment variables**: argv can carry prompt text for some tools, and env
//! can carry secrets. There is no constructor, builder or `From` impl that
//! accepts them.

use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ai::process_observer::DetectedAiProcess;

/// How trustworthy a piece of session/process evidence is, strongest first — the
/// exact ladder from planai2.md Phase 4. `rank()` is lower = stronger so it sorts
/// and compares like `TransportKind::priority`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceStrength {
    /// A native session/tool lifecycle event from the agent itself.
    NativeLifecycle,
    /// An appending transcript that carries session + workspace metadata.
    AppendingTranscript,
    /// A child process spawned from a known agent tool call.
    ChildOfToolCall,
    /// Process tree plus an exact cwd / workspace-root match.
    ProcessTreeCwdMatch,
    /// Process name only — weak telemetry (the tool may sit open for days, several
    /// agents may run at once, some run inside a shared editor host).
    ProcessNameOnly,
}

impl EvidenceStrength {
    /// Lower = stronger.
    pub fn rank(self) -> u8 {
        match self {
            Self::NativeLifecycle => 0,
            Self::AppendingTranscript => 1,
            Self::ChildOfToolCall => 2,
            Self::ProcessTreeCwdMatch => 3,
            Self::ProcessNameOnly => 4,
        }
    }

    /// planai2.md Phase 4: "process name alone is not enough for `ai_inferred`."
    /// Only evidence at least as strong as an exact cwd/workspace match may feed
    /// an inference; `ProcessNameOnly` is telemetry, not a correlation input.
    pub fn is_strong_enough_to_infer(self) -> bool {
        self.rank() <= Self::ProcessTreeCwdMatch.rank()
    }
}

/// One observation that an agent's session or process was live. Metadata only.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionProcessEvidence {
    pub agent: String,
    #[serde(default)]
    pub provider: Option<String>,
    pub pid: u32,
    /// Parent pid, when the process tree could be read.
    #[serde(default)]
    pub ppid: Option<u32>,
    /// The OS-reported process name / identity (`"codex"`, `"Cursor Helper
    /// (Renderer)"`). Never the command line.
    pub process_identity: String,
    /// The workspace root this evidence is scoped to, when known.
    #[serde(default)]
    pub workspace: Option<PathBuf>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub tool_event_id: Option<String>,
    pub started_at: DateTime<Utc>,
    /// Last time this session/process was seen doing something. On a bare process
    /// scan this equals `started_at` until a later scan updates it.
    pub last_activity_at: DateTime<Utc>,
    /// Set when the process exited or the session ended. `None` while live.
    #[serde(default)]
    pub ended_at: Option<DateTime<Utc>>,
    pub strength: EvidenceStrength,
}

impl SessionProcessEvidence {
    /// Build from a bare process-table detection (`process_observer::scan`). That
    /// source knows only agent + pid + cwd + start time and matched on *name*, so
    /// the result is `ProcessNameOnly` strength with no session/tool identity.
    pub fn from_detected_process(detected: &DetectedAiProcess) -> Self {
        let started_at = DateTime::<Utc>::from_timestamp(
            detected.started_at_epoch_seconds.min(i64::MAX as u64) as i64,
            0,
        )
        .unwrap_or_else(Utc::now);
        Self {
            agent: detected.agent.clone(),
            provider: None,
            pid: detected.pid,
            ppid: None,
            process_identity: detected.agent.clone(),
            workspace: detected.cwd.clone(),
            session_id: None,
            tool_event_id: None,
            started_at,
            last_activity_at: started_at,
            ended_at: None,
            strength: EvidenceStrength::ProcessNameOnly,
        }
    }

    pub fn is_live(&self) -> bool {
        self.ended_at.is_none()
    }

    /// Duration this session accounts for — bounded by `last_activity_at` (or
    /// `ended_at` when set), **never** by wall-clock now. planai2.md Phase 4:
    /// "process exit/crash closes the session without using `now` to extend
    /// duration unbounded."
    pub fn bounded_active_seconds(&self) -> i64 {
        let end = self.ended_at.unwrap_or(self.last_activity_at);
        (end - self.started_at).num_seconds().max(0)
    }
}

/// planai2.md Phase 4 (p4.2): turn a process-table scan into session/process
/// evidence, assigning strength from what could actually be confirmed:
///
/// - the process's cwd is inside a **registered** workspace root ⇒
///   `ProcessTreeCwdMatch` (an exact place match — the tool is demonstrably
///   working *here*);
/// - otherwise a bare name match with no confirmable workspace ⇒
///   `ProcessNameOnly` (telemetry: the tool is running *somewhere*).
///
/// The stronger tiers (`NativeLifecycle`, `AppendingTranscript`, `ChildOfToolCall`)
/// come from the native-hook and transcript producers, not from a process scan,
/// so this function never returns them.
pub fn evidence_from_scan(
    detected: &[DetectedAiProcess],
    registered_workspace_roots: &[std::path::PathBuf],
) -> Vec<SessionProcessEvidence> {
    detected
        .iter()
        .map(|process| {
            let mut evidence = SessionProcessEvidence::from_detected_process(process);
            if let Some(cwd) = &process.cwd {
                let inside_a_registered_root = registered_workspace_roots
                    .iter()
                    .any(|root| cwd == root || cwd.starts_with(root));
                if inside_a_registered_root {
                    evidence.workspace = Some(cwd.clone());
                    evidence.strength = EvidenceStrength::ProcessTreeCwdMatch;
                }
            }
            evidence
        })
        .collect()
}

/// The single strongest live piece of session/process evidence — by
/// `strength.rank()`, then most-recent `last_activity_at`. `None` for an empty
/// slice or when every entry has ended.
pub fn strongest_session_evidence(
    evidence: &[SessionProcessEvidence],
) -> Option<&SessionProcessEvidence> {
    evidence.iter().filter(|e| e.is_live()).min_by(|a, b| {
        a.strength
            .rank()
            .cmp(&b.strength.rank())
            .then(b.last_activity_at.cmp(&a.last_activity_at))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn evidence_strength_orders_strongest_first() {
        assert!(
            EvidenceStrength::NativeLifecycle.rank() < EvidenceStrength::ProcessNameOnly.rank()
        );
        assert!(
            EvidenceStrength::AppendingTranscript.rank()
                < EvidenceStrength::ProcessTreeCwdMatch.rank()
        );
        // Only an exact cwd/workspace match or stronger may feed an inference.
        assert!(EvidenceStrength::ProcessTreeCwdMatch.is_strong_enough_to_infer());
        assert!(!EvidenceStrength::ProcessNameOnly.is_strong_enough_to_infer());
    }

    #[test]
    fn round_trips_through_json() {
        let now = Utc::now();
        let evidence = SessionProcessEvidence {
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            pid: 4242,
            ppid: Some(1),
            process_identity: "codex".to_string(),
            workspace: Some(PathBuf::from("/home/dev/project")),
            session_id: Some("s-1".to_string()),
            tool_event_id: Some("t-7".to_string()),
            started_at: now,
            last_activity_at: now + Duration::seconds(30),
            ended_at: None,
            strength: EvidenceStrength::AppendingTranscript,
        };
        let json = serde_json::to_string(&evidence).unwrap();
        let back: SessionProcessEvidence = serde_json::from_str(&json).unwrap();
        assert_eq!(evidence, back);
        // No argv / env / command key anywhere in the serialized form.
        for forbidden in ["argv", "\"args\"", "\"command\"", "\"env\"", "cmdline"] {
            assert!(
                !json.contains(forbidden),
                "serialized evidence must not contain {forbidden}: {json}"
            );
        }
    }

    #[test]
    fn no_constructor_captures_argv_or_environment() {
        // Structural guard (planai2.md p4.1): the exhaustive destructure lists the
        // whole field set — there is no `args`, `argv`, `command_line` or `env`
        // field, so a future addition of one fails to compile here.
        let e = SessionProcessEvidence::from_detected_process(&DetectedAiProcess {
            agent: "cursor".to_string(),
            pid: 10,
            cwd: Some(PathBuf::from("/w")),
            started_at_epoch_seconds: 1_700_000_000,
        });
        let SessionProcessEvidence {
            agent: _,
            provider: _,
            pid: _,
            ppid: _,
            process_identity: _,
            workspace: _,
            session_id: _,
            tool_event_id: _,
            started_at: _,
            last_activity_at: _,
            ended_at: _,
            strength: _,
        } = e;
    }

    #[test]
    fn from_detected_process_is_name_only_strength_with_no_session_identity() {
        let e = SessionProcessEvidence::from_detected_process(&DetectedAiProcess {
            agent: "windsurf".to_string(),
            pid: 99,
            cwd: None,
            started_at_epoch_seconds: 1_700_000_000,
        });
        assert_eq!(e.strength, EvidenceStrength::ProcessNameOnly);
        assert_eq!(e.session_id, None);
        assert_eq!(e.tool_event_id, None);
        assert_eq!(e.last_activity_at, e.started_at);
        assert!(e.is_live());
        assert!(!e.strength.is_strong_enough_to_infer());
    }

    #[test]
    fn p4_2_cwd_in_a_registered_root_outranks_a_bare_name_match() {
        let here = PathBuf::from("/home/dev/project");
        let scan = vec![
            DetectedAiProcess {
                agent: "codex".to_string(),
                pid: 100,
                cwd: Some(here.join("crates/core")),
                started_at_epoch_seconds: 1_700_000_000,
            },
            DetectedAiProcess {
                agent: "cursor".to_string(),
                pid: 200,
                // Running, but not in any workspace we track.
                cwd: Some(PathBuf::from("/tmp/scratch")),
                started_at_epoch_seconds: 1_700_000_100,
            },
            DetectedAiProcess {
                agent: "windsurf".to_string(),
                pid: 300,
                cwd: None,
                started_at_epoch_seconds: 1_700_000_050,
            },
        ];

        let out = evidence_from_scan(&scan, std::slice::from_ref(&here));
        assert_eq!(out.len(), 3);

        // Process 1: cwd under a registered root -> exact place match.
        assert_eq!(out[0].strength, EvidenceStrength::ProcessTreeCwdMatch);
        assert_eq!(out[0].workspace, Some(here.join("crates/core")));
        assert!(out[0].strength.is_strong_enough_to_infer());

        // Processes 2 & 3: name-only telemetry, never inferrable.
        assert_eq!(out[1].strength, EvidenceStrength::ProcessNameOnly);
        assert_eq!(out[2].strength, EvidenceStrength::ProcessNameOnly);
        assert!(!out[1].strength.is_strong_enough_to_infer());
        assert!(!out[2].strength.is_strong_enough_to_infer());

        // The exact-place match outranks the name-only matches.
        assert!(out[0].strength.rank() < out[1].strength.rank());
        assert_eq!(strongest_session_evidence(&out).map(|e| e.pid), Some(100));
    }

    #[test]
    fn strongest_session_evidence_ignores_ended_sessions_and_breaks_ties_by_recency() {
        let base = Utc::now();
        let mk = |pid, strength, activity, ended| SessionProcessEvidence {
            agent: "codex".to_string(),
            provider: None,
            pid,
            ppid: None,
            process_identity: "codex".to_string(),
            workspace: None,
            session_id: None,
            tool_event_id: None,
            started_at: base,
            last_activity_at: activity,
            ended_at: ended,
            strength,
        };
        let ev = vec![
            mk(
                1,
                EvidenceStrength::ProcessTreeCwdMatch,
                base + Duration::seconds(10),
                None,
            ),
            mk(
                2,
                EvidenceStrength::ProcessTreeCwdMatch,
                base + Duration::seconds(40),
                None,
            ),
            // Stronger, but ended — must be ignored.
            mk(
                3,
                EvidenceStrength::NativeLifecycle,
                base + Duration::seconds(99),
                Some(base + Duration::seconds(50)),
            ),
        ];
        assert_eq!(strongest_session_evidence(&ev).map(|e| e.pid), Some(2));
        assert_eq!(strongest_session_evidence(&[]), None);
    }

    #[test]
    fn bounded_active_seconds_never_uses_wall_clock_now() {
        let start = Utc::now() - Duration::hours(5);
        let mut e = SessionProcessEvidence::from_detected_process(&DetectedAiProcess {
            agent: "codex".to_string(),
            pid: 1,
            cwd: None,
            started_at_epoch_seconds: start.timestamp().max(0) as u64,
        });
        // A live session with a stale last_activity: bounded by last_activity, not now.
        e.last_activity_at = start + Duration::seconds(90);
        assert_eq!(e.bounded_active_seconds(), 90);

        // Once ended, bounded by ended_at.
        e.ended_at = Some(start + Duration::seconds(120));
        assert_eq!(e.bounded_active_seconds(), 120);

        // Backwards timestamps never produce a negative duration.
        e.ended_at = Some(start - Duration::seconds(10));
        assert_eq!(e.bounded_active_seconds(), 0);
    }
}
