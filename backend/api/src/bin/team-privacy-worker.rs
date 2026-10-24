//! Team cleanup + independent privacy-registry mirror. No heartbeat or network producer.
use anyhow::{Context, Result};
use std::{path::PathBuf, sync::Arc};
use wakaclock_server::{
    config::Config,
    infrastructure::{database::ClickHouseClient, postgres::PostgresClient},
    repository::team_trust::{Registry, TeamTrustRepository},
};
#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    let admissions = wakaclock_server::services::team_usage_admission_worker::enabled(
        std::env::var("ATOAXIS_TEAM_USAGE_ADMISSION_WORKER_ENABLED")
            .ok()
            .as_deref(),
    )?;
    anyhow::ensure!(
        !admissions || config.team_enabled,
        "Team admission requires Team feature flag"
    );
    if admissions {
        wakaclock_server::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
    }
    // Cleanup-only mode must remain usable while commercial enrollment is closed.
    let pg = Arc::new(PostgresClient::connect(&config.postgres).await?);
    pg.migrate().await?;
    let path = PathBuf::from(
        std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")
            .context("independent privacy ledger path required")?,
    );
    let repo = TeamTrustRepository::new(pg.clone());
    let ch = Arc::new(ClickHouseClient::new(&config.clickhouse).await?);
    let admission_repo = wakaclock_server::repository::team_insights::TeamInsightsRepository::new(
        pg.clone(),
        ch.clone(),
    );
    if std::env::args().any(|a| a == "--initialize-ledger") {
        anyhow::ensure!(!path.exists(), "independent registry already exists");
        anyhow::ensure!(
            pg.query_one("SELECT count(*) FROM team_rollouts WHERE enabled", &[])
                .await?
                .get::<_, i64>(0)
                == 0,
            "disable Team rollout before explicit initialization"
        );
        let initial = Registry {
            schema_version: 2,
            checked_at: chrono::Utc::now(),
            organizations: Default::default(),
            dispositions: vec![],
        };
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&path)?;
        file.write_all(&serde_json::to_vec(&initial)?)?;
        file.sync_all()?;
        repo.export_registry(&path).await?;
        return Ok(());
    }

    let args = std::env::args().collect::<Vec<_>>();
    if args.iter().any(|a| a == "--reconcile-restore") {
        let ledger: Registry = serde_json::from_slice(&std::fs::read(&path)?)?;
        repo.reconcile_restore(&ledger).await?;
        repo.export_registry(&path).await?;
        println!("Team restore reconciled; rollout and all sharing remain disabled");
        return Ok(());
    }
    if args.iter().any(|a| a == "--once") {
        repo.export_registry(&path).await?;
        for _ in 0..100 {
            if !repo.cleanup_tick(chrono::Utc::now()).await? {
                break;
            }
        }
        for _ in 0..100 {
            if !wakaclock_server::repository::team_store_retention::tick(
                pg.clone(),
                ch.clone(),
                chrono::Utc::now(),
            )
            .await?
            {
                break;
            }
        }
        repo.export_registry(&path).await?;
        if admissions {
            wakaclock_server::services::team_usage_admission_worker::tick(&admission_repo, &repo)
                .await?;
        }
        return Ok(());
    }
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(15));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
         _=tokio::signal::ctrl_c()=>break,
         _=tick.tick()=>{
          // Verify old registry head before performing any maintenance on possibly restored data.
          if repo.export_registry(&path).await.is_err() {eprintln!("team_privacy_registry_unavailable_or_restore_required");continue;}
          for _ in 0..20 {
           match repo.cleanup_tick(chrono::Utc::now()).await {
            Ok(true)=>{},Ok(false)=>break,Err(_)=>{
             eprintln!("team_cleanup_dependency_failure");
             let _=pg.execute("UPDATE team_cleanup_jobs SET error_code='dependency_failure',retry_at=now()+interval '60 seconds' WHERE completed_at IS NULL AND retry_at<=now()",&[]).await;
             break;
            }
           }
          }
          if wakaclock_server::repository::team_store_retention::tick(pg.clone(),ch.clone(),chrono::Utc::now()).await.is_err() {eprintln!("team_store_cleanup_dependency_failure");}
          if repo.export_registry(&path).await.is_err() {eprintln!("team_privacy_registry_mirror_failed");continue;}
          if admissions && wakaclock_server::services::team_usage_admission_worker::tick(&admission_repo,&repo).await.is_err() {
            eprintln!("team_usage_admission_dependency_unconfirmed");
          }
         }
        }
    }
    Ok(())
}
