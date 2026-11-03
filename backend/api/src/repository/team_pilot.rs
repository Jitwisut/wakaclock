//! Explicit operator configuration, never automatic onboarding/consent. The
//! privacy worker must confirm the resulting generation before Team reads open.
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::CommercialDeployment},
    services::{
        team_financial_guard::fingerprint,
        team_pilot::{Body, Observation, Plan, Policy},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Duration, Utc};
use std::sync::Arc;
use tokio_postgres::Transaction;
use uuid::Uuid;

fn require_enabled() -> Result<()> {
    ensure!(
        matches!(
            std::env::var("ATOAXIS_TEAM_ENABLED").as_deref(),
            Ok("true" | "1")
        ),
        "team_pilot_global_feature_disabled"
    );
    Ok(())
}

async fn lock_scope(tx: &Transaction<'_>, org: Uuid, owner: Uuid) -> Result<()> {
    ensure!(!org.is_nil() && !owner.is_nil(), "team_pilot_scope_invalid");
    // Restore/export take this before organization/rollout rows. Do not acquire
    // it after billing/Owner locks: a concurrent restore could wait on our org.
    tx.query_one("SELECT pg_advisory_xact_lock(74103031)", &[])
        .await?;
    super::team_seats::lock(tx, org).await?;
    ensure!(tx.query_opt("SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id=o.id JOIN users u ON u.id=m.user_id WHERE o.id=$1 AND m.user_id=$2 AND o.deleted_at IS NULL AND o.personal_owner_id IS NULL AND m.role='owner' AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL FOR SHARE OF o,m,u", &[&org,&owner]).await?.is_some(), "team_pilot_reviewed_owner_no_longer_current");
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Current {
    enabled: bool,
    generation: i64,
    policy: Option<Policy>,
    published: bool,
}
async fn current(tx: &Transaction<'_>, org: Uuid) -> Result<Current> {
    let row = tx
        .query_opt(
            "SELECT enabled,generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
            &[&org],
        )
        .await?
        .context("team_pilot_rollout_evidence_missing")?;
    let policy = tx.query_opt("SELECT timezone,locked_at FROM team_report_policies WHERE organization_id=$1 FOR UPDATE", &[&org]).await?
        .map(|r| Policy {timezone:r.get(0),locked_at:r.get(1)});
    let published = tx
        .query_one(
            "SELECT EXISTS(SELECT 1 FROM team_weekly_publications WHERE organization_id=$1)",
            &[&org],
        )
        .await?
        .get(0);
    Ok(Current {
        enabled: row.get(0),
        generation: row.get(1),
        policy,
        published,
    })
}

async fn enrollment(
    tx: &Transaction<'_>,
    org: Uuid,
    deployment: &CommercialDeployment,
) -> Result<(super::team_financial_guard::TransactionProof, String)> {
    let state = super::team_analytics_entitlement::load(tx, org).await?;
    let proof =
        super::team_financial_guard::TransactionProof::capture(tx, org, state.as_ref()).await?;
    let independent = deployment.guard().read()?;
    independent.snapshot.verify(org, state.as_ref())?;
    let hash = fingerprint(&(
        deployment.guard().namespace()?,
        independent.organization_token(org)?,
    ))?;
    proof.validate()?;
    Ok((proof, hash))
}

async fn observation(
    pg: Arc<PostgresClient>,
    org: Uuid,
    value: &Current,
    enrollment: String,
) -> Result<Observation> {
    let trust = super::team_trust::TeamTrustRepository::new(pg);
    // Separate connection, before mutation. Never use this to inspect own writes.
    trust.guard(org).await?;
    let privacy = fingerprint(&trust.registry_entry(org).await?)?;
    Ok(Observation {
        enabled: value.enabled,
        generation: value.generation,
        policy: value.policy.clone(),
        published: value.published,
        enrollment,
        privacy,
    })
}

pub async fn prepare(
    pg: Arc<PostgresClient>,
    org: Uuid,
    reviewed_owner: Uuid,
    enabled: bool,
    timezone: String,
) -> Result<Plan> {
    require_enabled()?;
    ensure!(
        timezone.parse::<chrono_tz::Tz>().is_ok(),
        "team_pilot_timezone_invalid"
    );
    let deployment = CommercialDeployment::required_from_environment()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    lock_scope(&tx, org, reviewed_owner).await?;
    let value = current(&tx, org).await?;
    let (proof, token) = enrollment(&tx, org, &deployment).await?;
    let expected = observation(pg.clone(), org, &value, token).await?;
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let plan = Plan::new(Body {
        schema: 1,
        id: Uuid::now_v7(),
        organization: org,
        reviewed_owner,
        namespace: deployment.guard().namespace()?,
        prepared_at: now,
        expires_at: now + Duration::minutes(15),
        expected,
        enabled,
        timezone,
    })?;
    proof.validate()?;
    tx.rollback().await?;
    Ok(plan)
}

async fn report(
    pg: Arc<PostgresClient>,
    plan: &Plan,
    value: Current,
    duplicate: bool,
) -> serde_json::Value {
    // Do not pair a committed/earlier snapshot with a later generation's privacy
    // proof. Recapture both under the same locks; failure preserves the receipt
    // but leaves current values unknown rather than claiming the old state.
    let observed = recapture(pg, plan).await.ok();
    let current = observed.as_ref().map(|(value, _)| value);
    let privacy_confirmed = observed.as_ref().is_some_and(|(_, ready)| *ready);
    serde_json::json!({"schema_version":1,"operation_id":plan.body.id,"organization_id":plan.body.organization,
        "disposition":"configuration_committed","already_applied":duplicate,"actor_kind":"local_operator",
        "operation_observation":{"enabled":value.enabled,"generation":value.generation,
            "timezone":value.policy.as_ref().map(|p|&p.timezone),"scope":"at_commit_or_receipt_readback"},
        "current_observation":if current.is_some(){"observed"}else{"unconfirmed"},
        "current_enabled":current.map(|v|v.enabled),"current_generation":current.map(|v|v.generation),
        "current_timezone":current.and_then(|v|v.policy.as_ref().map(|p|&p.timezone)),
        "matches_original_request":current.map(|v|v.enabled==plan.body.enabled && v.policy.as_ref().is_some_and(|p|p.timezone==plan.body.timezone)),
        "privacy_confirmation":if privacy_confirmed {"observed"} else {"unconfirmed"},
        "starts_trial":false,"changes_consent":false,"provider_requests":false,"production_ready":false})
}

async fn recapture(pg: Arc<PostgresClient>, plan: &Plan) -> Result<(Current, bool)> {
    let deployment = CommercialDeployment::required_from_environment()?;
    ensure!(
        deployment.guard().namespace()? == plan.body.namespace,
        "team_pilot_namespace_changed"
    );
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    lock_scope(&tx, plan.body.organization, plan.body.reviewed_owner).await?;
    let value = current(&tx, plan.body.organization).await?;
    let (proof, _) = enrollment(&tx, plan.body.organization, &deployment).await?;
    let ready = super::team_trust::TeamTrustRepository::new(pg.clone())
        .guard(plan.body.organization)
        .await
        .is_ok();
    proof.validate()?;
    tx.rollback().await?;
    Ok((value, ready))
}

pub async fn apply(
    pg: Arc<PostgresClient>,
    plan: &Plan,
    approval: &str,
    pilot_only: bool,
    no_consent_change: bool,
) -> Result<serde_json::Value> {
    plan.approve(approval, pilot_only, no_consent_change)?;
    let b = &plan.body;
    let deployment = CommercialDeployment::required_from_environment()?;
    ensure!(
        deployment.guard().namespace()? == b.namespace,
        "team_pilot_namespace_changed"
    );
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    lock_scope(&tx, b.organization, b.reviewed_owner).await?;
    let value = current(&tx, b.organization).await?;
    let (proof, token) = enrollment(&tx, b.organization, &deployment).await?;
    // Generic administrative audits may be exported. Keep private namespace and
    // enrollment/privacy proof tokens only in the operator's private plan file.
    let metadata = serde_json::json!({"schema_version":1,"actor_kind":"local_operator",
        "plan_hash":plan.hash,"reviewed_owner_id":b.reviewed_owner,
        "enabled":b.enabled,"timezone":b.timezone});
    if let Some(row) = tx.query_opt("SELECT organization_id,actor_user_id,action,resource_type,resource_id,metadata FROM audit_logs WHERE id=$1 FOR SHARE", &[&b.id]).await? {
        ensure!(row.get::<_,Option<Uuid>>(0)==Some(b.organization)
            && row.get::<_,Option<Uuid>>(1).is_none()
            && row.get::<_,String>(2)=="team.pilot.configured"
            && row.get::<_,String>(3)=="organization"
            && row.get::<_,Option<Uuid>>(4)==Some(b.organization)
            && row.get::<_,serde_json::Value>(5)==metadata, "team_pilot_operation_conflict");
        proof.validate()?;
        // An expired original operation can be read back, never reapplied. A
        // later disable is current state, even if the original plan enabled it.
        tx.rollback().await?;
        return Ok(report(pg, plan, value, true).await);
    }
    require_enabled()?;
    plan.require_fresh(tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0))?;
    ensure!(
        observation(pg.clone(), b.organization, &value, token).await? == b.expected,
        "team_pilot_predecessor_changed_prepare_again"
    );
    if value
        .policy
        .as_ref()
        .is_none_or(|p| p.timezone != b.timezone)
    {
        ensure!(
            !value.published && value.policy.as_ref().is_none_or(|p| p.locked_at.is_none()),
            "team_pilot_timezone_locked"
        );
    }
    plan.require_fresh(tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0))?;
    if value.policy.is_none() {
        // An absent row cannot be locked. A concurrent readiness read may have
        // inserted the default policy; do not silently overwrite that new row.
        ensure!(tx.execute("INSERT INTO team_report_policies(organization_id,timezone) VALUES($1,$2) ON CONFLICT DO NOTHING", &[&b.organization,&b.timezone]).await? == 1,
            "team_pilot_predecessor_changed_prepare_again");
    } else if value
        .policy
        .as_ref()
        .is_some_and(|p| p.timezone != b.timezone)
    {
        tx.execute(
            "UPDATE team_report_policies SET timezone=$2 WHERE organization_id=$1",
            &[&b.organization, &b.timezone],
        )
        .await?;
    }
    if value.enabled != b.enabled
        || value
            .policy
            .as_ref()
            .is_none_or(|p| p.timezone != b.timezone)
    {
        tx.execute(
            "UPDATE team_rollouts SET enabled=$2 WHERE organization_id=$1",
            &[&b.organization, &b.enabled],
        )
        .await?;
        tx.execute("SELECT team_bump_generation($1)", &[&b.organization])
            .await?;
    }
    // The privileged local operator does not impersonate the referenced Owner.
    tx.execute("INSERT INTO audit_logs(id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,NULL,'team.pilot.configured','organization',$2,$3)", &[&b.id,&b.organization,&metadata]).await?;
    let result = current(&tx, b.organization).await?;
    plan.require_fresh(tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0))?;
    require_enabled()?;
    proof.validate()?;
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("team_pilot_commit_unconfirmed_retry_original_plan"))?;
    // No registry export here. Missing/older independent evidence keeps reads
    // closed until the existing worker has confirmed the resulting generation.
    Ok(report(pg, plan, result, false).await)
}

#[cfg(test)]
#[path = "team_pilot_tests.rs"]
mod tests;
