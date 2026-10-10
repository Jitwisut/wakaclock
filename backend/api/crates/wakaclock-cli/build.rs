//! Capture the git commit and build timestamp at compile time so a running
//! `wakaclock` binary can report exactly which build it is (planai2.md Phase 0.1 —
//! "Single CLI identity"). Both values degrade to `"unknown"` when the crate is
//! built outside a git checkout (a release tarball, a vendored build) — never a
//! build failure.

use std::process::Command;

fn main() {
    let git_sha = Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string());

    let dirty = Command::new("git")
        .args(["status", "--porcelain"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| !out.stdout.is_empty())
        .unwrap_or(false);

    let git_sha = if std::env::var("INTERNAL_CANDIDATE").as_deref() == Ok("1") {
        let commit = std::env::var("SOURCE_COMMIT").expect("candidate_source_commit_required");
        let full = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .output()
            .expect("candidate_git_unavailable");
        assert!(
            commit.len() == 40
                && commit.bytes().all(|c| c.is_ascii_hexdigit())
                && full.status.success()
                && String::from_utf8_lossy(&full.stdout).trim() == commit
                && !dirty,
            "candidate_clean_source_mismatch"
        );
        commit
    } else if dirty && git_sha != "unknown" {
        format!("{git_sha}-dirty")
    } else {
        git_sha
    };

    // Native on Windows too: do not depend on a Unix `date` executable in PATH.
    let build_time = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

    println!("cargo:rustc-env=WAKACLOCK_GIT_SHA={git_sha}");
    println!("cargo:rustc-env=WAKACLOCK_BUILD_TIME={build_time}");

    // Rebuild when the checked-out commit moves.
    for path in [
        "../../../../.git/HEAD",
        "../../../.git/HEAD",
        "../../.git/HEAD",
    ] {
        println!("cargo:rerun-if-changed={path}");
    }
    println!("cargo:rerun-if-env-changed=WAKACLOCK_GIT_SHA");
    println!("cargo:rerun-if-env-changed=INTERNAL_CANDIDATE");
    println!("cargo:rerun-if-env-changed=SOURCE_COMMIT");
}
