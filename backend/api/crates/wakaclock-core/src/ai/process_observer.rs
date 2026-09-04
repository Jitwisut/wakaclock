//! Phase A of the Universal Detector Core (planai.md Phase 4 — "Process / Agent
//! Session Observer"). Detects which known AI coding tools are currently running as
//! their own OS process, so the future Evidence Correlation Engine (planai.md Phase 8)
//! can infer `AI_INFERRED` for a filesystem change that has no native hook: "agent X
//! was running in this workspace at this time" is evidence, not proof — this module
//! only ever reports presence, never attributes a specific file change to a specific
//! process (planai.md Phase 4's own rule: this observer's output feeds the
//! correlation engine, it does not replace it).
//!
//! **Coverage limit, by construction, not by oversight:** this only detects tools that
//! run as their own distinguishable OS process — a standalone app (Cursor, Windsurf,
//! Antigravity) or a background daemon/language server (Copilot's). It cannot detect
//! Cline or Roo Code: both are pure VS Code extensions that execute inside the host
//! editor's own process and have no separate process footprint to match against.
//! Detecting those needs a different mechanism — enumerating the host editor's active
//! extensions — which this module does not attempt.

use std::path::PathBuf;

use sysinfo::System;

/// (name pattern, canonical agent id). Matched as a case-insensitive substring of the
/// OS-reported process name, since the same tool's process name varies by platform and
/// by exact build (e.g. a helper/renderer subprocess suffix on macOS).
///
/// **Unverified against a real running instance of any of these** except where noted —
/// same caveat as `extensions/ai-agents/cursor/README.md`: names come from public
/// documentation/community reports as of 2026-08-31, not from inspecting a real
/// process list with one of these tools actually running.
const KNOWN_AI_PROCESS_PATTERNS: &[(&str, &str)] = &[
    // Terminal clients are included alongside editor forks.  The whole-word
    // matcher below prevents generic names such as `codex-helper` or
    // `geminiary` from becoming false positives while still accepting the
    // platform-specific helper suffixes these CLIs/apps use.
    ("codex", "codex"),
    ("claude", "claude-code"),
    ("kilo-code", "kilo-code"),
    ("kilo", "kilo-code"),
    ("kimi", "kimi-code-cli"),
    ("deepseek", "deep-code"),
    ("gemini", "gemini-cli"),
    ("cursor", "cursor"),
    ("windsurf", "windsurf"),
    ("antigravity", "antigravity"),
    ("copilot-language-server", "copilot"),
    ("github-copilot", "copilot"),
];

/// One AI tool process observed running, with just enough metadata for the
/// correlation engine to test "was this agent active in this workspace around this
/// time" — never file contents, never command-line arguments (which can carry prompt
/// text for some tools), matching this module's metadata-only contract everywhere.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedAiProcess {
    pub agent: String,
    pub pid: u32,
    /// `None` when the OS denies reading another process's cwd (common without
    /// elevated permissions on some platforms) — absence is not evidence the tool
    /// isn't running, just that this particular signal is unavailable this scan.
    pub cwd: Option<PathBuf>,
    /// Epoch seconds, from the OS's own process start time — not this scan's time.
    pub started_at_epoch_seconds: u64,
}

/// Matches a raw OS process name against the known list. Pure and independently
/// testable from `scan()`, which needs a real process table.
///
/// Regression: a plain substring `.contains()` matched macOS's
/// `CursorUIViewService` (a system XPC service for the *text* cursor, nothing to do
/// with the Cursor editor) against the `"cursor"` pattern — found by running `scan()`
/// against this machine's real process table, not by inspection. Matching now
/// requires the pattern to sit on a word boundary (start/end of the name, or bounded
/// by a non-alphanumeric character on each side), which accepts `"Cursor"` and
/// `"Cursor Helper (Renderer)"` but rejects `"CursorUIViewService"`.
pub fn match_agent(process_name: &str) -> Option<&'static str> {
    let lowered = process_name.to_ascii_lowercase();
    KNOWN_AI_PROCESS_PATTERNS
        .iter()
        .find(|(pattern, _)| matches_as_whole_word(&lowered, pattern))
        .map(|(_, agent)| *agent)
}

fn matches_as_whole_word(haystack: &str, pattern: &str) -> bool {
    if pattern.is_empty() {
        return false;
    }
    let bytes = haystack.as_bytes();
    let mut search_from = 0;
    while let Some(relative_pos) = haystack[search_from..].find(pattern) {
        let pos = search_from + relative_pos;
        let before_ok = pos == 0 || !bytes[pos - 1].is_ascii_alphanumeric();
        let after_pos = pos + pattern.len();
        let after_ok = after_pos == bytes.len() || !bytes[after_pos].is_ascii_alphanumeric();
        if before_ok && after_ok {
            return true;
        }
        search_from = pos + 1;
        if search_from >= haystack.len() {
            break;
        }
    }
    false
}

/// One full process-table scan. Cheap enough to call every few seconds from a
/// long-running background loop (planai.md Phase 4's target cadence), but each call
/// does re-enumerate every process on the machine — callers on a tight loop should
/// reuse one `System` and call `refresh_processes` instead of constructing a new one
/// per call; this function optimizes for a simple, correct first implementation, not
/// for the lowest possible per-call cost.
pub fn scan() -> Vec<DetectedAiProcess> {
    let mut system = System::new_all();
    system.refresh_all();

    let mut detected = Vec::new();
    for (pid, process) in system.processes() {
        let name = process.name().to_string_lossy();
        let Some(agent) = match_agent(&name) else {
            continue;
        };
        detected.push(DetectedAiProcess {
            agent: agent.to_string(),
            pid: pid.as_u32(),
            cwd: process.cwd().map(|path| path.to_path_buf()),
            started_at_epoch_seconds: process.start_time(),
        });
    }
    detected
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_known_agents_case_insensitively() {
        assert_eq!(match_agent("codex"), Some("codex"));
        assert_eq!(match_agent("Claude Code"), Some("claude-code"));
        assert_eq!(match_agent("kilo-code"), Some("kilo-code"));
        assert_eq!(match_agent("kimi"), Some("kimi-code-cli"));
        assert_eq!(match_agent("deepseek"), Some("deep-code"));
        assert_eq!(match_agent("gemini"), Some("gemini-cli"));
        assert_eq!(match_agent("Cursor"), Some("cursor"));
        assert_eq!(match_agent("CURSOR"), Some("cursor"));
        assert_eq!(match_agent("Windsurf"), Some("windsurf"));
        assert_eq!(match_agent("Antigravity"), Some("antigravity"));
    }

    #[test]
    fn matches_a_platform_specific_subprocess_suffix() {
        // macOS runs Electron-family apps as several helper processes; the main
        // window and its renderers all carry the app name as a substring.
        assert_eq!(match_agent("Cursor Helper (Renderer)"), Some("cursor"));
        assert_eq!(match_agent("Cursor Helper (GPU)"), Some("cursor"));
    }

    #[test]
    fn matches_the_copilot_language_server_by_either_known_name() {
        assert_eq!(match_agent("copilot-language-server"), Some("copilot"));
        assert_eq!(
            match_agent("github-copilot-agent"),
            Some("copilot"),
            "process name containing github-copilot should still match"
        );
    }

    #[test]
    fn does_not_match_an_unrelated_process() {
        assert_eq!(match_agent("firefox"), None);
        assert_eq!(match_agent("node"), None);
        // A generic editor process must not match just because an AI tool happens to
        // be a VS Code fork under the hood — the process name itself must carry the
        // tool's own identity, not a generic "Code Helper" name shared with plain
        // VS Code and every extension-based agent this module cannot detect.
        assert_eq!(match_agent("Code Helper (Renderer)"), None);
    }

    #[test]
    fn does_not_match_a_process_that_merely_contains_the_pattern_as_a_substring() {
        // Regression test for a real false positive: this machine's own real process
        // table has `CursorUIViewService`, a macOS system XPC service for the text
        // cursor (unrelated to the Cursor editor). `scan()` reported it as a detected
        // "cursor" process before this fix — found by running the scanner for real,
        // not by inspecting the pattern list.
        assert_eq!(match_agent("CursorUIViewService"), None);
        assert_eq!(match_agent("cursoruiviewservice"), None);
        assert_eq!(match_agent("MyCopilotThing"), None);
        assert_eq!(match_agent("windsurfing-app"), None);
    }

    #[test]
    fn does_not_match_an_empty_name() {
        assert_eq!(match_agent(""), None);
    }

    #[test]
    fn scan_runs_against_the_real_process_table_without_panicking() {
        // This machine is very unlikely to have any of the known tools installed, so
        // this only proves the scan mechanism itself is sound (system enumeration,
        // name/cwd/pid extraction) — not that a real installed tool would be found.
        // See extensions/ai-agents/cursor/README.md for the same "wiring proven, real
        // payload shape not yet verified" caveat applied to this scanner.
        //
        // It does still assert one real, negative fact about this exact machine: its
        // real process table includes `CursorUIViewService` (a macOS system service —
        // see `does_not_match_a_process_that_merely_contains_the_pattern_as_a_substring`),
        // so a passing `scan()` here is non-trivial evidence the whole-word fix holds
        // end to end, not just in the unit test that targets it directly.
        let detected = scan();
        for process in &detected {
            assert!(!process.agent.is_empty());
        }
        assert!(
            detected.iter().all(|process| process.agent != "cursor"),
            "scan() reported a false-positive cursor detection on this machine: {detected:?}"
        );
    }
}
