//! Opt-in staging sidecar. Hooks feed verified live session identity, never transcript text.
use chrono::Utc;
use clap::Parser;
use serde::Deserialize;
use std::{
    io::Read,
    path::PathBuf,
    time::{Duration, Instant},
};
use uuid::Uuid;
use wakaclock_core::session_context::{observe_git, ContextQueue, SessionContext};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
#[derive(Parser)]
struct Args {
    #[arg(long)]
    config: PathBuf,
    #[arg(long)]
    observe: Option<PathBuf>,
    #[arg(long)]
    once: bool,
}
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
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LiveSession {
    agent: String,
    usage_session_id: String,
    observed_at: chrono::DateTime<Utc>,
}
#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let config: Configuration = serde_json::from_slice(&std::fs::read(&args.config)?)?;
    let origin = reqwest::Url::parse(&config.origin)?;
    if !(origin.scheme() == "https"
        || (origin.scheme() == "http"
            && matches!(origin.host_str(), Some("127.0.0.1" | "localhost"))))
        || !origin.username().is_empty()
        || origin.password().is_some()
        || origin.path() != "/"
        || origin.query().is_some()
        || origin.fragment().is_some()
    {
        return Err("invalid context server origin".into());
    }
    let mut queue = ContextQueue::open(&config.queue_path)?;
    if let Some(workspace) = args.observe {
        let mut bytes = Vec::new();
        std::io::stdin().take(16_385).read_to_end(&mut bytes)?;
        if bytes.len() > 16_384 {
            return Err("session metadata too large".into());
        }
        let live: LiveSession = serde_json::from_slice(&bytes)?;
        if live.agent.is_empty()
            || live.agent.len() > 64
            || live.usage_session_id.is_empty()
            || live.usage_session_id.len() > 512
            || Utc::now()
                .signed_duration_since(live.observed_at)
                .num_seconds()
                .abs()
                > 30
        {
            return Err(
                "live verified session required; historical Git context cannot be inferred".into(),
            );
        }
        let git = observe_git(&workspace).ok_or("Git metadata unavailable")?;
        if git.repository != config.repository.to_ascii_lowercase() {
            return Err("repository differs from explicit member mapping".into());
        }
        let event = SessionContext::observed(
            config.user_id,
            &live.agent,
            config.collector_id,
            &live.usage_session_id,
            config.project_id,
            config.repository_id,
            live.observed_at,
            git,
        );
        queue.enqueue(
            &config.origin,
            config.user_id,
            config.organization_id,
            &event,
        )?;
        println!("Session context stored durably");
        return Ok(());
    }
    let token = std::env::var("ATOAXIS_TEAM_CONTEXT_TOKEN")
        .map_err(|_| "context delivery credential missing")?;
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        let capability = http
            .get(format!(
                "{}/api/v2/me/session-context/capability",
                config.origin.trim_end_matches('/')
            ))
            .bearer_auth(&token)
            .send()
            .await;
        let ready = match capability {
            Ok(r) if r.status().is_success() => {
                r.json::<serde_json::Value>().await.ok().is_some_and(|v| {
                    v["data"]["version"].as_u64() == Some(1)
                        && v["data"]["enabled"].as_bool() == Some(true)
                })
            }
            _ => false,
        };
        if ready {
            let start = Instant::now();
            for _ in 0..100 {
                let now = Utc::now().timestamp();
                let Some(pending) =
                    queue.claim(&config.origin, config.user_id, config.organization_id, now)?
                else {
                    break;
                };
                let result = http
                    .post(format!(
                        "{}/api/v2/organizations/{}/me/github/session-context",
                        config.origin.trim_end_matches('/'),
                        config.organization_id
                    ))
                    .bearer_auth(&token)
                    .json(&pending.event)
                    .send()
                    .await;
                match result {
                    Ok(response) if response.status().is_success() => {
                        queue.acknowledge(&pending)?;
                    }
                    other => {
                        let backoff =
                            (15_i64.saturating_mul(1_i64 << pending.attempts.min(10))).min(3600);
                        let (wait, dead) = match other {
                            Ok(r) => {
                                let wait = r
                                    .headers()
                                    .get("retry-after")
                                    .and_then(|v| v.to_str().ok())
                                    .and_then(|v| {
                                        v.parse::<i64>().ok().or_else(|| {
                                            chrono::DateTime::parse_from_rfc2822(v)
                                                .ok()
                                                .map(|at| (at.timestamp() - now).max(0))
                                        })
                                    })
                                    .unwrap_or(backoff);
                                (
                                    wait.max(backoff),
                                    matches!(r.status().as_u16(), 400 | 422)
                                        .then_some("validation"),
                                )
                            }
                            Err(_) => (backoff, None),
                        };
                        queue.retry(&pending, now + wait, dead)?;
                        break;
                    }
                }
                if start.elapsed() >= Duration::from_secs(10) {
                    break;
                }
            }
        }
        if args.once {
            return Ok(());
        }
        tokio::select! {_ = tokio::signal::ctrl_c()=>return Ok(()),_ = tokio::time::sleep(Duration::ZERO)=>()};
    }
}
