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
    if std::env::var_os("ATOAXIS_TEAM_CONTEXT_CONFIG").is_none() {
        return Ok(());
    }
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
    let Some(settings) = settings(config)? else {
        return Ok(());
    };
    let device = settings.collector_id.to_string();
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

/// Durable acceptance does not require a project mapping, server or canonical usage.
pub(crate) fn accept(
    o: &crate::producer_handoff::Observation,
) -> Result<&'static str, (&'static str, bool)> {
    use wakaclock_core::broker::{
        producer_context::{ContextReceipt, FrozenContext},
        BrokerIngestOutcome, BrokerStore,
    };
    let evidence: FrozenContext = serde_json::from_value(o.metadata.clone())
        .map_err(|_| ("producer_context_schema_invalid", false))?;
    if !evidence.valid() {
        return Err(("producer_context_validation", false));
    }
    let mut store = BrokerStore::open().map_err(|_| ("producer_inbox_unavailable", true))?;
    let result = store
        .accept_context(ContextReceipt {
            scope: &o.scope_id,
            id: &o.observation_id,
            adapter: &o.adapter_id,
            surface: &o.execution_surface,
            at: o.observed_at,
            evidence: &evidence,
        })
        .map_err(|e| {
            if matches!(e, wakaclock_core::error::AppError::Conflict(_)) {
                ("producer_context_conflict", false)
            } else {
                ("producer_inbox_unavailable", true)
            }
        })?;
    Ok(if result == BrokerIngestOutcome::Duplicate {
        "duplicate"
    } else {
        "accepted"
    })
}

fn settings(config: &Config) -> Result<Option<Configuration>, Box<dyn Error>> {
    let Some(path) = std::env::var_os("ATOAXIS_TEAM_CONTEXT_CONFIG") else {
        return Ok(None);
    };
    let path = PathBuf::from(path);
    for part in path.ancestors() {
        if part.is_symlink()
            && !(cfg!(target_os = "macos")
                && matches!(part.to_str(), Some("/var" | "/tmp" | "/etc"))
                && part.canonicalize().ok().as_deref()
                    == Some(Path::new(&format!("/private{}", part.display()))))
        {
            return Err("context_configuration_symlink_refused".into());
        }
    }
    if std::fs::metadata(&path)?.len() > 16 * 1024 {
        return Err("context_configuration_invalid".into());
    }
    let settings: Configuration = serde_json::from_slice(&std::fs::read(path)?)
        .map_err(|_| "context_configuration_invalid")?;
    if Config::normalize_server_url(&settings.origin)?
        != Config::normalize_server_url(&config.server_url)?
        || settings.user_id != config.user_id
        || wakaclock_core::queue::Queue::open()?.device_id()? != settings.collector_id.to_string()
    {
        return Err("context_identity_mismatch".into());
    }
    Ok(Some(settings))
}

/// Runs inside the existing collector budget. Projection uses frozen coordinates
/// exclusively, including when mapping/configuration became available later.
pub(crate) async fn tick(
    config: &Config,
    api: &wakaclock_core::api_client::ApiClient,
    began: std::time::Instant,
) -> serde_json::Value {
    use serde_json::json;
    use wakaclock_core::{broker::BrokerStore, session_context::GitMetadata};
    let Ok(scopes) = crate::producer_handoff::verified_scopes(api) else {
        return json!({"status":"unavailable","error_code":"context_scope_unconfirmed"});
    };
    let Ok(store) = BrokerStore::open() else {
        return json!({"status":"unavailable","error_code":"context_inbox_unavailable"});
    };
    let mut health = store
        .context_health(&scopes)
        .unwrap_or_else(|_| json!({"status":"unavailable"}));
    health["stages"] = serde_json::to_value(
        store
            .context_stages(
                &scopes,
                Utc::now(),
                &format!(
                    "{}-{}",
                    env!("CARGO_PKG_VERSION"),
                    env!("WAKACLOCK_GIT_SHA")
                ),
            )
            .unwrap_or_default(),
    )
    .unwrap_or_default();
    let settings = match settings(config) {
        Ok(Some(settings)) => settings,
        Ok(None) => {
            health["delivery_status"] = json!("unconfirmed");
            health["error_code"] = json!("context_configuration_missing");
            return health;
        }
        Err(_) => {
            health["delivery_status"] = json!("unavailable");
            health["error_code"] = json!("context_identity_unconfirmed");
            return health;
        }
    };
    let Ok(mut queue) = ContextQueue::open(&settings.queue_path) else {
        return json!({"status":"unavailable","error_code":"context_queue_unavailable"});
    };
    let mut remaining = 100usize;
    // Reserve delivery capacity while existing context is pending; a continuous
    // producer must not starve the already committed network queue.
    let queued = queue.status(
        &settings.origin,
        settings.user_id,
        settings.organization_id,
        Utc::now().timestamp(),
    );
    let mut projection_remaining = if queued
        .as_ref()
        .ok()
        .is_some_and(|s| s["pending"].as_u64().is_some_and(|n| n > 0))
    {
        50usize
    } else {
        100usize
    };
    let ordered = match store.next_context_scope(&scopes) {
        Ok(scopes) => scopes,
        Err(_) => return json!({"status":"unavailable","error_code":"context_inbox_unavailable"}),
    };
    for scope in &ordered {
        if projection_remaining == 0 || began.elapsed().as_secs() >= 10 {
            break;
        }
        let rows = match store.pending_context(scope, Utc::now().timestamp(), projection_remaining)
        {
            Ok(rows) => rows,
            Err(_) => {
                health["status"] = json!("unavailable");
                return health;
            }
        };
        for row in rows {
            if began.elapsed().as_secs() >= 10 {
                break;
            }
            remaining -= 1;
            projection_remaining -= 1;
            let repository = row.evidence.repository.as_deref().unwrap_or_default();
            let reason = match row.evidence.binding.as_ref() {
                None => Some("context_binding_unresolved"),
                Some(binding)
                    if binding.user_id != settings.user_id
                        || binding.organization_id != settings.organization_id
                        || binding.collector_id != settings.collector_id
                        || binding.project_id != settings.project_id
                        || binding.repository_id != settings.repository_id
                        || Config::normalize_server_url(&binding.origin).ok()
                            != Config::normalize_server_url(&settings.origin).ok() =>
                {
                    Some("context_binding_changed")
                }
                Some(_) if repository != settings.repository.to_ascii_lowercase() => {
                    Some("repository_mapping_unresolved")
                }
                Some(_) => None,
            };
            if reason.is_none() {
                let native = row.evidence.native_session.as_deref().unwrap_or_default();
                let scoped = wakaclock_core::ai::usage::scoped_session_id(
                    &settings.collector_id.to_string(),
                    &row.adapter,
                    native,
                );
                let mut event = SessionContext::observed(
                    settings.user_id,
                    &row.adapter,
                    settings.collector_id,
                    &scoped,
                    settings.project_id,
                    settings.repository_id,
                    row.at,
                    GitMetadata {
                        repository: repository.into(),
                        branch: row.evidence.branch,
                        commit_sha: row.evidence.commit_sha,
                    },
                );
                if row.evidence.project_provenance.as_deref() == Some("user_confirmed") {
                    event.provenance = "user_confirmed_task_git".into();
                }
                if queue
                    .observe_changed(
                        &settings.origin,
                        settings.user_id,
                        settings.organization_id,
                        &event,
                    )
                    .is_err()
                {
                    health["status"] = json!("unavailable");
                    health["error_code"] = json!("context_queue_write_failure");
                    return health;
                }
            }
            if store
                .finish_context(scope, &row.id, reason, Utc::now().timestamp())
                .is_err()
            {
                health["status"] = json!("unavailable");
                return health;
            }
        }
    }
    health = store
        .context_health(&scopes)
        .unwrap_or_else(|_| json!({"status":"unavailable"}));
    let delivery = api
        .drain_session_context(
            &mut queue,
            &settings.origin,
            settings.user_id,
            settings.organization_id,
            began,
            remaining,
        )
        .await;
    health["stages"] = serde_json::to_value(
        store
            .context_stages(
                &scopes,
                Utc::now(),
                &format!(
                    "{}-{}",
                    env!("CARGO_PKG_VERSION"),
                    env!("WAKACLOCK_GIT_SHA")
                ),
            )
            .unwrap_or_default(),
    )
    .unwrap_or_default();
    if health["pending"] == 0
        && health["unresolved"] == 0
        && health["stages"].as_array().is_some_and(|s| !s.is_empty())
    {
        // This is evidence of processing observed records, not a certification
        // that the provider emits every activity.
        health["status"] = json!("observed");
    }
    health["delivery"] = delivery;
    health["last_observed_at"] = json!(Utc::now());
    health
}
