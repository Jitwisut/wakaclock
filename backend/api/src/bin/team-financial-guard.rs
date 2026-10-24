//! Explicit operator tool. No daemon, automatic initialization, analytics grant or
//! Stripe request. This command never displays saved entitlement/payment details.
use anyhow::{ensure, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use uuid::Uuid;
use wakaclock_server::{
    config::PostgresConfig,
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{CommercialDeployment, FinancialGuard},
    },
    services::team_financial_guard::Head,
};
#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    /// Save an immutable private review plan. No baseline/provider mutation.
    PrepareIngressRecovery {
        path: PathBuf,
        #[arg(long)]
        namespace: Uuid,
        #[arg(long)]
        account: String,
        #[arg(long)]
        live: bool,
        #[arg(long)]
        evidence_hash: String,
        #[arg(long)]
        output: PathBuf,
    },
    /// Explicit approval of one unchanged plan. Never grants payment/analytics.
    ApplyIngressRecovery {
        path: PathBuf,
        #[arg(long)]
        namespace: Uuid,
        #[arg(long)]
        account: String,
        #[arg(long)]
        live: bool,
        #[arg(long)]
        plan: PathBuf,
        #[arg(long)]
        approve_plan: String,
        #[arg(long)]
        acknowledge_prospective_only: bool,
    },
    /// Read-only account ingress status, never a payment grant or baseline seed.
    InspectIngress {
        path: PathBuf,
        #[arg(long)]
        namespace: Uuid,
        #[arg(long)]
        account: String,
        #[arg(long)]
        live: bool,
    },
    /// Validate deployment configuration only. No DB/provider calls or activation.
    VerifyDeployment,
    Initialize {
        path: PathBuf,
        #[arg(long)]
        namespace: Uuid,
        #[arg(long)]
        legacy_organization: Vec<Uuid>,
        #[arg(long)]
        acknowledge_reviewed_roster: bool,
    },
    Inspect {
        path: PathBuf,
    },
    VerifyDatabase {
        path: PathBuf,
        #[arg(long)]
        namespace: Uuid,
        #[arg(long)]
        organization: Uuid,
    },
    /// Read-only SQL inventory preview, not financial-source authorization.
    InspectInventory {
        path: PathBuf,
        #[arg(long)]
        namespace: Uuid,
        #[arg(long)]
        organization: Uuid,
        #[arg(long)]
        account: String,
        #[arg(long)]
        live: bool,
    },
}
#[tokio::main]
async fn main() {
    if execute(Args::parse()).await.is_err() {
        eprintln!("financial_guard_unconfirmed: inspect configuration and independent evidence; no state was granted");
        std::process::exit(1);
    }
}
async fn execute(args: Args) -> Result<()> {
    match args.command {
        Command::PrepareIngressRecovery {
            path,
            namespace,
            account,
            live,
            evidence_hash,
            output,
        } => {
            let guard = FinancialGuard::new(path)?.pin_namespace(namespace)?;
            guard.namespace()?;
            let scope = wakaclock_server::services::team_financial_ingress::Scope { account, live };
            scope.key()?;
            let pg = PostgresClient::connect(&PostgresConfig {
                url: Some(std::env::var("POSTGRES_URL")?),
                max_connections: 2,
            })
            .await?;
            let p = wakaclock_server::repository::team_financial_recovery::prepare(
                &pg,
                &guard,
                &scope,
                &evidence_hash,
            )
            .await?;
            wakaclock_server::infrastructure::team_financial_plan::write(&output, &p)?;
            println!("{}", p.summary());
        }
        Command::ApplyIngressRecovery {
            path,
            namespace,
            account,
            live,
            plan,
            approve_plan,
            acknowledge_prospective_only,
        } => {
            let guard = FinancialGuard::new(path)?.pin_namespace(namespace)?;
            guard.namespace()?;
            let scope = wakaclock_server::services::team_financial_ingress::Scope { account, live };
            scope.key()?;
            let p = wakaclock_server::infrastructure::team_financial_plan::read(&plan)?;
            let approval = wakaclock_server::services::team_financial_recovery::Approval::reviewed(
                &p,
                namespace,
                &scope,
                &approve_plan,
                acknowledge_prospective_only,
            )?;
            let pg = PostgresClient::connect(&PostgresConfig {
                url: Some(std::env::var("POSTGRES_URL")?),
                max_connections: 2,
            })
            .await?;
            println!(
                "{}",
                wakaclock_server::repository::team_financial_recovery::apply(
                    &pg, &guard, &p, &approval
                )
                .await?
            );
        }
        Command::InspectIngress {
            path,
            namespace,
            account,
            live,
        } => {
            let guard = FinancialGuard::new(path)?.pin_namespace(namespace)?;
            guard.namespace()?;
            let scope = wakaclock_server::services::team_financial_ingress::Scope { account, live };
            scope.key()?;
            let pg = PostgresClient::connect(&PostgresConfig {
                url: Some(std::env::var("POSTGRES_URL")?),
                max_connections: 2,
            })
            .await?;
            println!(
                "{}",
                wakaclock_server::repository::team_financial_ingress::diagnostic(
                    &pg, &guard, &scope
                )
                .await?
            );
        }
        Command::VerifyDeployment => {
            CommercialDeployment::required_from_environment()?;
            println!(
                "{}",
                serde_json::json!({"status":"commercial_guard_configured", "scope":"enrollment_entitlement_only", "financial_sources":"unconfirmed", "product_authorization_enabled":false, "production_ready":false})
            );
        }
        Command::Initialize {
            path,
            namespace,
            legacy_organization,
            acknowledge_reviewed_roster,
        } => {
            ensure!(
                acknowledge_reviewed_roster,
                "reviewed roster acknowledgment required"
            );
            FinancialGuard::new(path)?.initialize(namespace, legacy_organization)?;
            println!(
                "{}",
                serde_json::json!({"status":"initialized","product_authorization_enabled":false})
            );
        }
        Command::Inspect { path } => {
            let state = FinancialGuard::new(path)?.read()?;
            let mut legacy = 0;
            let mut enrolled = 0;
            let mut closed = 0;
            let mut pending = 0;
            for e in state.snapshot.organizations.values() {
                match e.head {
                    Head::Legacy => legacy += 1,
                    Head::Enrolled { .. } => enrolled += 1,
                    _ => closed += 1,
                };
                if e.pending.is_some() {
                    pending += 1;
                }
            }
            println!(
                "{}",
                serde_json::json!({"namespace":state.snapshot.namespace,"sequence":state.sequence,"legacy":legacy,"enrolled":enrolled,"closed":closed,"pending":pending,"scope":"enrollment_entitlement_only","financial_sources":"unconfirmed","product_authorization_enabled":false})
            );
        }
        Command::VerifyDatabase {
            path,
            organization,
            namespace,
        } => {
            let pg = PostgresClient::connect(&PostgresConfig {
                url: Some(std::env::var("POSTGRES_URL")?),
                max_connections: 2,
            })
            .await?;
            let report = wakaclock_server::repository::team_financial_guard::inspect(
                &pg,
                &FinancialGuard::new(path)?.pin_namespace(namespace)?,
                organization,
                namespace,
            )
            .await?;
            println!("{}", serde_json::to_string(&report)?);
        }
        Command::InspectInventory {
            path,
            namespace,
            organization,
            account,
            live,
        } => {
            let guard = FinancialGuard::new(path)?.pin_namespace(namespace)?;
            guard.namespace()?;
            let scope = wakaclock_server::services::team_financial_source::Scope {
                organization,
                account,
                live,
            };
            scope.key()?;
            let pg = PostgresClient::connect(&PostgresConfig {
                url: Some(std::env::var("POSTGRES_URL")?),
                max_connections: 2,
            })
            .await?;
            let report = wakaclock_server::repository::team_financial_inventory::preview(
                &pg, &guard, &scope,
            )
            .await?;
            println!("{}", report.diagnostic());
        }
    }
    Ok(())
}
