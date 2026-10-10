//! Receiver must be deployed first. This worker drains accepted metadata even
//! while Team UI/producer flags are disabled for rollback.
use anyhow::{Context, Result};
use std::{sync::Arc, time::Duration};
use wakaclock_server::{
    config::Config, infrastructure::postgres::PostgresClient,
    repository::team_webhooks::TeamWebhookRepository,
};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    let pg = Arc::new(PostgresClient::connect(&config.postgres).await?);
    pg.migrate()
        .await
        .context("Team receiver migration required")?;
    let repo = TeamWebhookRepository::new(pg.clone());
    let ch = Arc::new(
        wakaclock_server::infrastructure::database::ClickHouseClient::new(&config.clickhouse)
            .await?,
    );
    let context = wakaclock_server::services::team_context::ContextVerifier {
        store: Arc::new(
            wakaclock_server::repository::team_github::GithubRepositoryStore::new(pg.clone()),
        ),
        usage: Arc::new(
            wakaclock_server::repository::team_insights::TeamInsightsRepository::new(pg, ch),
        ),
    };
    let mut tick = tokio::time::interval(Duration::from_secs(15));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            result = tokio::signal::ctrl_c() => { result?; return Ok(()); }
            _ = tick.tick() => {
                let started=std::time::Instant::now();
                for _ in 0..100 {
                    if started.elapsed()>Duration::from_secs(10){break;}
                    match context.tick().await {Ok(true)=>(),Ok(false)=>break,Err(_)=>{eprintln!("Team context verifier: store unavailable");break;}}
                }
                for _ in 0..100 {
                    match repo.process_github().await {
                        Ok(true) => (), Ok(false) => break,
                        // Never print raw provider payload or database bind values.
                        Err(_) => { eprintln!("Team webhook worker: transactional store unavailable; retry next tick"); break; }
                    }
                }
            }
        }
    }
}
