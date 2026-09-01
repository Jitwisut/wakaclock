//! planai2.md Phase 6 — Dedup and Canonical Heartbeat Generator.
//!
//! p6.1: a **versioned canonical fingerprint** — the identity of a *logical
//! edit*, independent of which transport observed it. A native hook firing and
//! its transcript line being appended a moment later are the same edit and must
//! fingerprint identically; a formatter pass and an agent's edit to the same
//! file a minute apart must not collide.

use std::path::Path;

use uuid::Uuid;

use crate::ai::path::normalize_lexical;
use crate::broker::BrokerChangeKind;

/// Bucket width for the "bounded timestamp" component of the fingerprint. Wide
/// enough that a hook event and the transcript line it produces moments later —
/// same edit, different transports, different instants — land in the same
/// bucket; narrow enough that it never merges two genuinely separate edits of
/// the same file a `filesystem_to_agent_activity`-scale interval apart.
pub const FINGERPRINT_TIME_BUCKET_SECONDS: i64 = 10;

/// The v1 canonical-fingerprint version tag. Present verbatim as the prefix of
/// every [`CanonicalFingerprint::v1`] value, so a future scheme change is a
/// visible prefix bump (`caf2:…`), never a silent reinterpretation of `caf1:…`
/// bytes.
pub const FINGERPRINT_SCHEME_V1: &str = "caf1";

/// The fields planai2.md §6 "Canonical identity" names — deliberately
/// everything a transport / producer / `EvidenceKind` is **excluded** from, so
/// two observations of the same logical edit from different producers hash to
/// the same [`CanonicalFingerprint`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CanonicalIdentity<'a> {
    pub workspace: &'a Path,
    /// Normalised on the way in by [`CanonicalFingerprint::v1`]; callers may
    /// pass either form.
    pub entity: &'a Path,
    pub change_kind: BrokerChangeKind,
    /// Seconds since the Unix epoch. Bucketed to
    /// [`FINGERPRINT_TIME_BUCKET_SECONDS`] before hashing.
    pub occurred_at_unix: i64,
    /// An opaque content/blob fingerprint, when known — preferred over a line
    /// delta because it distinguishes a no-op rewrite from a real edit.
    pub content_fingerprint: Option<&'a str>,
    /// `(lines_added, lines_deleted)`, used when no content fingerprint is
    /// available.
    pub line_delta: Option<(u32, u32)>,
    /// Session or tool-call identity, when the observation carries one.
    pub session_or_tool_id: Option<&'a str>,
}

/// A versioned canonical fingerprint for one logical edit. Renders as
/// `"<scheme>:<uuid>"` (e.g. `"caf1:…"`); the scheme prefix is always explicit
/// in the value, never implicit in "which function you happened to call".
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct CanonicalFingerprint(String);

impl CanonicalFingerprint {
    /// Scheme v1. Hashes `workspace | normalized entity | change kind | time
    /// bucket | (content fingerprint, else line delta) | session/tool id` with
    /// UUIDv5 (matches the hashing convention already used for `event_id` /
    /// `payload_hash` elsewhere in this crate — see `broker.rs`). Transport is
    /// not an input: two [`CanonicalIdentity`]s that agree on every field above
    /// produce the same fingerprint regardless of which producer built them.
    pub fn v1(identity: &CanonicalIdentity<'_>) -> Self {
        let bucket = identity
            .occurred_at_unix
            .div_euclid(FINGERPRINT_TIME_BUCKET_SECONDS);
        let normalized_entity = normalize_lexical(identity.entity);
        let mut key = format!(
            "{scheme}|{workspace}|{entity}|{kind}|{bucket}|",
            scheme = FINGERPRINT_SCHEME_V1,
            workspace = identity.workspace.display(),
            entity = normalized_entity.display(),
            kind = identity.change_kind.as_str(),
        );
        match identity.content_fingerprint {
            Some(fp) => key.push_str(&format!("cf:{fp}|")),
            None => {
                if let Some((added, deleted)) = identity.line_delta {
                    key.push_str(&format!("ld:{added}:{deleted}|"));
                }
            }
        }
        if let Some(id) = identity.session_or_tool_id {
            key.push_str(&format!("id:{id}|"));
        }
        let uuid = Uuid::new_v5(&Uuid::NAMESPACE_OID, key.as_bytes());
        Self(format!("{FINGERPRINT_SCHEME_V1}:{uuid}"))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// The scheme-version prefix this value was built with (e.g. `"caf1"`), so
    /// a caller can assert a scheme bump rather than compare opaque bytes.
    pub fn scheme(&self) -> &str {
        self.0.split_once(':').map(|(s, _)| s).unwrap_or(&self.0)
    }
}

impl std::fmt::Display for CanonicalFingerprint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base(entity: &Path) -> CanonicalIdentity<'_> {
        CanonicalIdentity {
            workspace: Path::new("/w"),
            entity,
            change_kind: BrokerChangeKind::Modify,
            occurred_at_unix: 1_000_000,
            content_fingerprint: Some("blob:abc123"),
            line_delta: None,
            session_or_tool_id: Some("session-1"),
        }
    }

    #[test]
    fn same_logical_edit_from_two_transports_yields_one_fingerprint() {
        let entity = Path::new("/w/src/main.rs");
        // A native-hook observation of the edit...
        let hook = CanonicalIdentity {
            occurred_at_unix: 1_000_000,
            ..base(entity)
        };
        // ...and the transcript line appended for the *same* edit a few
        // seconds later, from a different transport. `CanonicalIdentity` has
        // no transport/producer field at all — only the logical-edit fields.
        let transcript = CanonicalIdentity {
            occurred_at_unix: 1_000_004,
            ..base(entity)
        };
        assert_eq!(
            CanonicalFingerprint::v1(&hook),
            CanonicalFingerprint::v1(&transcript)
        );
    }

    #[test]
    fn a_fingerprint_scheme_version_is_explicit_in_the_value() {
        let fp = CanonicalFingerprint::v1(&base(Path::new("/w/a.rs")));
        assert_eq!(fp.scheme(), "caf1");
        assert!(fp.as_str().starts_with("caf1:"));
        assert_eq!(fp.to_string(), fp.as_str());
    }

    #[test]
    fn timestamps_crossing_a_bucket_boundary_produce_a_different_fingerprint() {
        let entity = Path::new("/w/src/main.rs");
        let a = CanonicalIdentity {
            occurred_at_unix: 1_000_000,
            ..base(entity)
        };
        // 30s later — well past FINGERPRINT_TIME_BUCKET_SECONDS (10s); a
        // second, independent edit of the same file must not collide.
        let b = CanonicalIdentity {
            occurred_at_unix: 1_000_030,
            ..base(entity)
        };
        assert_ne!(CanonicalFingerprint::v1(&a), CanonicalFingerprint::v1(&b));
    }

    #[test]
    fn entity_change_kind_workspace_and_identity_each_change_the_fingerprint() {
        let entity = Path::new("/w/src/main.rs");
        let reference = CanonicalFingerprint::v1(&base(entity));

        let other_entity = CanonicalFingerprint::v1(&base(Path::new("/w/src/other.rs")));
        assert_ne!(reference, other_entity);

        let other_kind = CanonicalFingerprint::v1(&CanonicalIdentity {
            change_kind: BrokerChangeKind::Create,
            ..base(entity)
        });
        assert_ne!(reference, other_kind);

        let other_workspace = CanonicalFingerprint::v1(&CanonicalIdentity {
            workspace: Path::new("/other-workspace"),
            ..base(entity)
        });
        assert_ne!(reference, other_workspace);

        let other_content = CanonicalFingerprint::v1(&CanonicalIdentity {
            content_fingerprint: Some("blob:different"),
            ..base(entity)
        });
        assert_ne!(reference, other_content);

        let other_session = CanonicalFingerprint::v1(&CanonicalIdentity {
            session_or_tool_id: Some("session-2"),
            ..base(entity)
        });
        assert_ne!(reference, other_session);
    }

    #[test]
    fn a_line_delta_is_used_only_when_no_content_fingerprint_is_present() {
        let entity = Path::new("/w/src/main.rs");
        let with_fp = CanonicalIdentity {
            content_fingerprint: Some("blob:abc123"),
            line_delta: Some((5, 2)),
            ..base(entity)
        };
        let without_fp_same_delta = CanonicalIdentity {
            content_fingerprint: None,
            line_delta: Some((5, 2)),
            ..base(entity)
        };
        let without_fp_different_delta = CanonicalIdentity {
            content_fingerprint: None,
            line_delta: Some((9, 9)),
            ..base(entity)
        };
        // The content fingerprint wins when present, so these two differ...
        assert_ne!(
            CanonicalFingerprint::v1(&with_fp),
            CanonicalFingerprint::v1(&without_fp_same_delta)
        );
        // ...and the line delta is load-bearing once there's no fingerprint.
        assert_ne!(
            CanonicalFingerprint::v1(&without_fp_same_delta),
            CanonicalFingerprint::v1(&without_fp_different_delta)
        );
    }

    #[test]
    fn entity_path_is_normalised_before_hashing() {
        let plain = CanonicalIdentity {
            occurred_at_unix: 1_000_000,
            ..base(Path::new("/w/src/main.rs"))
        };
        let dotted = CanonicalIdentity {
            occurred_at_unix: 1_000_000,
            ..base(Path::new("/w/src/../src/./main.rs"))
        };
        assert_eq!(
            CanonicalFingerprint::v1(&plain),
            CanonicalFingerprint::v1(&dotted)
        );
    }
}
