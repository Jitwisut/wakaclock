use anyhow::{Context, Result};
use std::{sync::Arc, time::Duration};
use wakaclock_server::{
    config::Config,
    infrastructure::{
        postgres::PostgresClient,
        stripe::{StripeApiConfig, StripeClient},
    },
    repository::team_stripe::TeamStripeRepository,
    services::team_stripe_worker::StripeWorker,
};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    anyhow::ensure!(config.team_enabled, "Team feature flag disabled");
    let stripe = StripeApiConfig::from_env()?.context("Stripe worker disabled")?;
    let checkout_enabled = match std::env::var("ATOAXIS_TEAM_STRIPE_CHECKOUT_WORKER_ENABLED")
        .ok()
        .as_deref()
    {
        None | Some("false") | Some("0") => false,
        Some("true") | Some("1") => true,
        _ => anyhow::bail!("Checkout worker flag must be explicit"),
    };
    let account = stripe.account_id.clone();
    let live = stripe.livemode;
    let client = StripeClient::new(stripe)?;
    let pg = Arc::new(PostgresClient::connect(&config.postgres).await?);
    pg.migrate().await?;
    let worker = StripeWorker::new(TeamStripeRepository::new(pg), client);
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            _=tokio::signal::ctrl_c()=>return Ok(()),
            _=interval.tick()=>{
                if checkout_enabled {
                    match wakaclock_server::services::team_stripe_catalog::Catalog::from_env(&account,live) {
                        Ok(Some(catalog))=>{if worker.checkout_tick(&catalog).await.is_err(){tracing::warn!("Checkout worker unavailable; accepted operations retained");}},
                        _=>tracing::warn!("Approved checkout catalog unavailable; operations retained"),
                    }
                }
                if worker.tick().await.is_err() {tracing::warn!("Stripe reconciliation store unavailable; retained jobs will retry");}
            }
        }
    }
}
