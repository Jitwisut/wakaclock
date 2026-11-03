//! Current Owner trial projection and mutation preconditions. A missing SQL row
//! never proves that an organization is eligible for another trial.
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::CommercialDeployment},
    services::{
        authorization::AuthorizationService,
        team_financial_guard::{fingerprint, Head},
        team_insights::TeamError,
        team_trial::{self, Recovery, TrialStatus},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use tokio_postgres::Transaction;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Fence {
    token: String,
    generation: i64,
    sql_hash: String,
}
#[cfg(test)]
impl Fence {
    pub(crate) fn fixture() -> Self {
        Self {
            token: "a".repeat(64),
            generation: 1,
            sql_hash: "b".repeat(64),
        }
    }
}
pub(super) async fn require_rollout(
    tx: &Transaction<'_>,
    org: Uuid,
    deployment: &CommercialDeployment,
) -> Result<i64> {
    team_trial::require_enabled()?;
    let current = CommercialDeployment::required_from_environment()?;
    ensure!(
        current.guard().same_authority(deployment.guard()),
        "financial_guard_configuration_changed"
    );
    let row = tx
        .query_opt(
            "SELECT enabled,generation FROM team_rollouts WHERE organization_id=$1 FOR SHARE",
            &[&org],
        )
        .await?
        .context(TeamError::Disabled)?;
    ensure!(row.get::<_, bool>(0), TeamError::Disabled);
    Ok(row.get(1))
}
async fn developer_count(tx: &Transaction<'_>, org: Uuid) -> Result<i64> {
    Ok(tx.query_one("SELECT count(*) FROM organization_members WHERE organization_id=$1 AND deactivated_at IS NULL AND role<>'viewer' AND seat_type='developer'", &[&org]).await?.get(0))
}
async fn purchase_exists(tx: &Transaction<'_>, org: Uuid) -> Result<bool> {
    Ok(tx.query_one("SELECT EXISTS(SELECT 1 FROM team_stripe_checkout_intents WHERE organization_id=$1 AND disposition<>'expired') OR EXISTS(SELECT 1 FROM team_stripe_bindings WHERE organization_id=$1 AND enabled)", &[&org]).await?.get(0))
}
pub(super) async fn validate_new_capacity(
    tx: &Transaction<'_>,
    org: Uuid,
    seats: i32,
) -> Result<()> {
    ensure!(
        !purchase_exists(tx, org).await?,
        TeamError::Invalid("review the existing purchase before starting a trial")
    );
    ensure!(
        developer_count(tx, org).await? <= i64::from(seats),
        TeamError::Invalid("select a trial package that includes the current developer seats")
    );
    Ok(())
}
pub async fn status(
    pg: &PostgresClient,
    org: Uuid,
    actor: Uuid,
    deployment: &CommercialDeployment,
) -> Result<TrialStatus> {
    team_trial::require_enabled()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    super::team_seats::lock(&tx, org).await?;
    AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
    let generation = require_rollout(&tx, org, deployment).await?;
    let current = super::team_analytics_entitlement::load(&tx, org).await?;
    let guard = deployment.guard();
    let independent = guard.read()?;
    let token = independent.organization_token(org)?;
    super::team_organization_birth::verify_retained(&tx, org, &independent).await?;
    let entry = independent
        .snapshot
        .organizations
        .get(&org)
        .context("financial_guard_unknown_organization")?;
    let confirmed = independent.snapshot.verify(org, current.as_ref()).is_ok();
    let recovery = match (&entry.head, &entry.pending, &current) {
        (Head::Legacy | Head::FreshUnenrolled { .. }, Some(p), Some(sql))
            if p.state.as_ref() == sql
                && super::team_analytics_entitlement::initial_trial_committed(&tx, org, sql)
                    .await
                    .is_ok()
                && independent
                    .snapshot
                    .transactions
                    .require_organization_free(org)
                    .is_ok() =>
        {
            Some(Recovery {
                transition_id: p.transition_id,
                expected_revision: 1,
            })
        }
        _ => None,
    };
    let developers = developer_count(&tx, org).await?;
    let purchase = purchase_exists(&tx, org).await?;
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let fence = Fence {
        token: token.clone(),
        generation,
        sql_hash: fingerprint(&(&current, developers, purchase))?,
    };
    let result = team_trial::project(
        current.as_ref(),
        recovery,
        confirmed,
        developers,
        purchase,
        now,
        fence,
    );
    require_rollout(&tx, org, deployment).await?;
    ensure!(
        guard.read()?.organization_token(org)? == token,
        TeamError::ProjectionChanged
    );
    tx.commit().await?;
    Ok(result)
}
/// Repeat current Owner/rollout/SQL/file proof after asynchronous privacy health
/// work. Comparing a private fence never grants a read to another caller/scope.
pub async fn validate(
    pg: &PostgresClient,
    org: Uuid,
    actor: Uuid,
    deployment: &CommercialDeployment,
    status_before: &TrialStatus,
) -> Result<()> {
    let current = status(pg, org, actor, deployment).await?;
    ensure!(
        current.fence == status_before.fence,
        TeamError::ProjectionChanged
    );
    Ok(())
}

#[cfg(test)]
#[path = "team_trial_tests.rs"]
mod tests;
