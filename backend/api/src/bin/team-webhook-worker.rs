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
    let repo = TeamWebhookRepository::new(pg);
    let mut tick = tokio::time::interval(Duration::from_secs(15));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            result = tokio::signal::ctrl_c() => { result?; return Ok(()); }
            _ = tick.tick() => {
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
