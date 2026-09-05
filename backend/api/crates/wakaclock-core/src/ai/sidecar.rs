//! Reads the metadata-only sidecar the broker writes to `~/.wakaclock/ai-events.jsonl`
//! (see `append_broker_sidecar` in `wakaclock-cli/src/broker.rs`) so an editor producer
//! that cannot do VS Code's full line-delta correlation
//! (`extensions/vscode/src/aiAttribution.ts`) still has a way to avoid crediting an
//! agent's edit to whoever is at the keyboard.
//!
//! `wakaclock-ls` is the first caller: it tracks buffer text but not per-change line
//! deltas, so it cannot reproduce `aiAttribution.ts`'s exact-match rule. What it *can*
//! do is check whether the broker recorded AI activity for this same file at roughly
//! the same time, and withhold a confident Human claim if so — Phase 1's rule is
//! `RAW_CHANGE_WITHOUT_PROVENANCE != HUMAN`, not "guess Human when evidence is thin".
//! [`has_nearby_event`] is intentionally time-and-entity-only: it cannot prove *this*
//! editor change is the AI's (no line counts to compare), only that AI activity is
//! nearby, so a caller should treat a hit as "not provably Human", not as "AI".

use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::path::to_comparable_string;

#[derive(Debug, Clone, Deserialize)]
struct SidecarLine {
    entity: String,
    time: f64,
}

fn sidecar_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".wakaclock").join("ai-events.jsonl")
}

/// [`has_nearby_event`] with the home directory resolved via `dirs::home_dir()`, for
/// callers that would otherwise need `dirs` only for this one lookup. An unresolvable
/// home directory is treated as "no evidence" rather than a panic or error — the same
/// posture as a missing/unreadable sidecar file.
pub fn has_nearby_event_in_home_dir(entity: &Path, at_seconds: f64, window_seconds: f64) -> bool {
    match dirs::home_dir() {
        Some(home_dir) => has_nearby_event(&home_dir, entity, at_seconds, window_seconds),
        None => false,
    }
}

/// True when the sidecar records an AI event for `entity` within `window_seconds` of
/// `at_seconds` (both epoch seconds, matching the sidecar's own `time` field and
/// `Heartbeat::time`). Missing/unreadable/unparsable sidecar content is treated as "no
/// evidence" rather than an error — the sidecar is a best-effort local file, and a
/// missing broker should not block ordinary editor heartbeats.
///
/// Unlike `aiAttribution.ts`'s `classify`, this has no per-event consumed-set: one
/// sidecar event can make every heartbeat for its entity within the window read as
/// "nearby", not just one. That is deliberate here, not an oversight — this check has
/// no line delta to single out which specific editor change the event belongs to, so
/// it only ever downgrades a confident Human claim to Unknown (see callers), and never
/// claims AI ownership outright. A caller with a stronger per-change correlation
/// signal (VS Code's line-delta match) should keep using its own consumed-set, not
/// this function.
pub fn has_nearby_event(
    home_dir: &Path,
    entity: &Path,
    at_seconds: f64,
    window_seconds: f64,
) -> bool {
    let Ok(content) = fs::read_to_string(sidecar_path(home_dir)) else {
        return false;
    };
    let normalized_entity = to_comparable_string(entity);
    // The sidecar is append-only and can grow across a long session; only the most
    // recent lines are relevant to a correlation window measured in seconds, and
    // capping the scan keeps this cheap to call from a per-change hot path.
    content.lines().rev().take(500).any(|line| {
        let Ok(event) = serde_json::from_str::<SidecarLine>(line) else {
            return false;
        };
        to_comparable_string(Path::new(&event.entity)) == normalized_entity
            && (event.time - at_seconds).abs() <= window_seconds
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Matches the temp-dir convention used by `ai::state`'s tests: a unique directory
    /// under the OS temp dir rather than a crate the workspace doesn't depend on.
    fn temp_home_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "wakaclock-core-ai-sidecar-test-{}-{name}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ))
    }

    fn write_sidecar(home_dir: &Path, lines: &[&str]) {
        let dir = home_dir.join(".wakaclock");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("ai-events.jsonl"), lines.join("\n")).unwrap();
    }

    #[test]
    fn no_sidecar_file_is_no_evidence() {
        let home = temp_home_dir("no-file");
        assert!(!has_nearby_event(
            &home,
            Path::new("/project/a.rs"),
            100.0,
            15.0
        ));
    }

    #[test]
    fn matches_same_entity_within_window() {
        let home = temp_home_dir("matches");
        write_sidecar(
            &home,
            &[
                r#"{"event_id":"e1","entity":"/project/a.rs","time":100.0,"lines_added":1,"lines_deleted":0}"#,
            ],
        );
        assert!(has_nearby_event(
            &home,
            Path::new("/project/a.rs"),
            108.0,
            15.0
        ));
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn rejects_a_different_entity() {
        let home = temp_home_dir("different-entity");
        write_sidecar(
            &home,
            &[
                r#"{"event_id":"e1","entity":"/project/b.rs","time":100.0,"lines_added":1,"lines_deleted":0}"#,
            ],
        );
        assert!(!has_nearby_event(
            &home,
            Path::new("/project/a.rs"),
            100.0,
            15.0
        ));
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn rejects_an_event_outside_the_window() {
        let home = temp_home_dir("outside-window");
        write_sidecar(
            &home,
            &[
                r#"{"event_id":"e1","entity":"/project/a.rs","time":100.0,"lines_added":1,"lines_deleted":0}"#,
            ],
        );
        assert!(!has_nearby_event(
            &home,
            Path::new("/project/a.rs"),
            200.0,
            15.0
        ));
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn tolerates_malformed_lines() {
        let home = temp_home_dir("malformed");
        write_sidecar(
            &home,
            &[
                "not json",
                r#"{"event_id":"e2","entity":"/project/a.rs","time":100.0,"lines_added":1,"lines_deleted":0}"#,
            ],
        );
        assert!(has_nearby_event(
            &home,
            Path::new("/project/a.rs"),
            100.0,
            15.0
        ));
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn normalizes_separators_and_dot_segments_before_comparing() {
        let home = temp_home_dir("normalize");
        write_sidecar(
            &home,
            &[
                r#"{"event_id":"e1","entity":"/project/./a.rs","time":100.0,"lines_added":1,"lines_deleted":0}"#,
            ],
        );
        assert!(has_nearby_event(
            &home,
            Path::new("/project/a.rs"),
            100.0,
            15.0
        ));
        let _ = fs::remove_dir_all(&home);
    }
}
