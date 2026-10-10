//! Opt-in live metadata adapter. Shared by native hooks on macOS and Windows.
//! Replay must never read the current branch as evidence for a historical session.
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::{
    error::Error,
    path::{Path, PathBuf},
};
use uuid::Uuid;
use wakaclock_core::{
    config::Config,
    session_context::{observe_git, ContextQueue, SessionContext},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Configuration {
    origin: String,
    user_id: Uuid,
    organization_id: Uuid,
    collector_id: Uuid,
    project_id: Uuid,
    repository_id: Uuid,
    repository: String,
    queue_path: PathBuf,
}
/// No configuration means the personal pipeline keeps its previous behavior.
/// An enabled adapter must persist before the producer receives an acknowledgement.
pub fn observe(
    config: &Config,
    agent: &str,
    native_session: Option<&str>,
    workspace: Option<&Path>,
    at: DateTime<Utc>,
) -> Result<(), Box<dyn Error>> {
    let Some(path) = std::env::var_os("ATOAXIS_TEAM_CONTEXT_CONFIG") else {
        return Ok(());
    };
    let Some(native) = native_session
        .filter(|s| !s.is_empty() && s.len() <= 512 && !s.chars().any(char::is_control))
    else {
        return Ok(());
    };
    let Some(workspace) = workspace else {
        return Ok(());
    };
    // A delayed hook may be replayed, but its old Git state cannot be reconstructed.
    if Utc::now()
        .signed_duration_since(at)
        .num_milliseconds()
        .abs()
        > 30_000
    {
        return Ok(());
    }
    let agent = wakaclock_core::ai::normalize_client_id(agent)?;
    if !matches!(agent.as_str(), "codex" | "claude-code" | "cursor") {
        return Ok(());
    }
    let settings: Configuration = serde_json::from_slice(&std::fs::read(PathBuf::from(path))?)
        .map_err(|_| "invalid session context configuration")?;
    if Config::normalize_server_url(&settings.origin)?
        != Config::normalize_server_url(&config.server_url)?
        || settings.user_id != config.user_id
    {
        return Err("session context account/origin differs from producer".into());
    }
    let device = wakaclock_core::queue::Queue::open()?.device_id()?;
    if device != settings.collector_id.to_string() {
        return Err("session context collector differs from canonical usage".into());
    }
    let Some(git) = observe_git(workspace) else {
        return Ok(());
    };
    if git.repository != settings.repository.to_ascii_lowercase() {
        return Ok(());
    }
    let scoped = wakaclock_core::ai::usage::scoped_session_id(&device, &agent, native);
    let event = SessionContext::observed(
        settings.user_id,
        &agent,
        settings.collector_id,
        &scoped,
        settings.project_id,
        settings.repository_id,
        at,
        git,
    );
    let mut queue = ContextQueue::open(&settings.queue_path)
        .map_err(|_| "session context queue unavailable")?;
    queue
        .observe_changed(
            &settings.origin,
            settings.user_id,
            settings.organization_id,
            &event,
        )
        .map_err(|_| "session context durable acceptance failed")?;
    Ok(())
}
