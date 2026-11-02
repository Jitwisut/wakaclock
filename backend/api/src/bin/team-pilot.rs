//! Privileged local operator tool; never interprets a supplied Owner ID as an
//! authenticated person. No migrations, automatic baseline or provider calls.
use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::{path::PathBuf, sync::Arc};
use uuid::Uuid;
use wakaclock_server::{
    config::PostgresConfig,
    infrastructure::{postgres::PostgresClient, team_pilot_plan},
    repository::team_pilot,
};

#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    /// Read-only review; writes only a new private local plan after validation.
    Prepare {
        #[arg(long)]
        organization: Uuid,
        #[arg(long)]
        expected_owner: Uuid,
        #[arg(long, action=clap::ArgAction::Set, required=true)]
        enabled: bool,
        #[arg(long)]
        timezone: String,
        #[arg(long)]
        output: PathBuf,
    },
    /// Explicit one-plan approval. Lost response: retry this exact plan.
    Apply {
        #[arg(long)]
        plan: PathBuf,
        #[arg(long)]
        approve_plan: String,
        #[arg(long)]
        acknowledge_pilot_only: bool,
        #[arg(long)]
        acknowledge_no_consent_change: bool,
    },
}

#[tokio::main]
async fn main() {
    if let Err(error) = execute(Args::parse()).await {
        eprintln!(
            "{}",
            serde_json::json!({"schema_version":1,"status":"unconfirmed",
            "reason_code":wakaclock_server::services::team_pilot::failure_code(&error),
            "preserve_original_plan":true,"production_ready":false})
        );
        std::process::exit(1);
    }
}
async fn execute(args: Args) -> Result<()> {
    // No dotenv: the operator explicitly selects the already configured store.
    let approved = match &args.command {
        Command::Apply {
            plan,
            approve_plan,
            acknowledge_pilot_only,
            acknowledge_no_consent_change,
        } => {
            let value = team_pilot_plan::read(plan)?;
            value.approve(
                approve_plan,
                *acknowledge_pilot_only,
                *acknowledge_no_consent_change,
            )?;
            Some(value)
        }
        _ => None,
    };
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(std::env::var("POSTGRES_URL")?),
            max_connections: 4,
        })
        .await?,
    );
    match args.command {
        Command::Prepare {
            organization,
            expected_owner,
            enabled,
            timezone,
            output,
        } => {
            let plan =
                team_pilot::prepare(pg, organization, expected_owner, enabled, timezone).await?;
            team_pilot_plan::write(&output, &plan)?;
            println!("{}", plan.summary());
        }
        Command::Apply {
            approve_plan,
            acknowledge_pilot_only,
            acknowledge_no_consent_change,
            ..
        } => {
            let plan = approved.as_ref().context("team_pilot_plan_required")?;
            let result = team_pilot::apply(
                pg,
                plan,
                &approve_plan,
                acknowledge_pilot_only,
                acknowledge_no_consent_change,
            )
            .await?;
            println!("{result}");
        }
    }
    Ok(())
}
