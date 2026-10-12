use anyhow::{Context, Result};
use std::{sync::Arc, time::Duration};
use wakaclock_server::{
    config::Config,
    infrastructure::{github::GithubConfig, postgres::PostgresClient},
    repository::team_github::GithubRepositoryStore,
    services::team_github_sync::GithubSyncWorker,
};
#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    anyhow::ensure!(config.team_enabled, "Team feature flag disabled");
    let github = GithubConfig::from_env()?.context("GitHub App configuration required")?;
    wakaclock_server::infrastructure::github::GithubClient::new()?
        .verify_application(&github)
        .await?;
    let pg = Arc::new(PostgresClient::connect(&config.postgres).await?);
    pg.migrate().await?;
    let repo = Arc::new(GithubRepositoryStore::new(pg.clone()));
    let redelivery =
        wakaclock_server::services::team_github_redelivery::GithubRedeliveryWorker::new(
            repo.clone(),
            github.clone(),
        )?;
    let daily = wakaclock_server::services::copilot_daily::CopilotDailyWorker::new(
        Arc::new(wakaclock_server::repository::copilot_daily::CopilotDailyRepository::new(pg)),
        github.clone(),
    )?;
    let mut worker = GithubSyncWorker::new(repo.clone(), github)?;
    let mut tick = tokio::time::interval(Duration::from_secs(15));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {_ = tokio::signal::ctrl_c()=>return Ok(()),_ = tick.tick()=>{
            if repo.schedule(None).await.is_err(){eprintln!("GitHub scheduler: store unavailable");continue;}
            if redelivery.tick().await.is_err(){eprintln!("GitHub delivery recovery: store unavailable");}
            if daily.tick().await.is_err(){eprintln!("Copilot daily: retryable store failure");}
            let start=std::time::Instant::now();for _ in 0..100 {match worker.tick().await{Ok(true)=>(),Ok(false)=>break,Err(_)=>{eprintln!("GitHub sync: retryable store failure");break;}}if start.elapsed()>Duration::from_secs(10){break;}}
        }}
    }
}
