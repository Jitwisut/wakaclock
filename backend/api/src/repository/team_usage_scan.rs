//! Restartable metadata scan checkpoints. No network request holds a transaction.
use crate::{
    infrastructure::postgres::PostgresClient, services::team_analytics_entitlement::State,
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use tokio_postgres::Transaction;
use uuid::Uuid;

pub async fn observation(
    pg: &PostgresClient,
    org: Uuid,
    now: DateTime<Utc>,
) -> Result<crate::services::team_usage_admission_worker::Observation> {
    let row=pg.query_one("SELECT e.organization_id IS NOT NULL AS enrolled,e.revision,e.state,s.scan_before,s.last_success_at,s.last_completed_at,s.error_code FROM organizations o LEFT JOIN team_analytics_entitlements e ON e.organization_id=o.id LEFT JOIN team_usage_admission_scans s ON s.organization_id=o.id WHERE o.id=$1",&[&org]).await?;
    let state = row
        .get::<_, Option<serde_json::Value>>("state")
        .and_then(|value| serde_json::from_value::<State>(value).ok())
        .filter(|state| {
            state.validate().is_ok()
                && Some(state.revision) == row.get::<_, Option<i64>>("revision")
        });
    let active = state.as_ref().and_then(|s| {
        super::team_financial_guard::HintProof::capture(org, Some(s))
            .ok()
            .map(|_| s.covered_at(now))
    });
    Ok(crate::services::team_usage_admission_worker::Observation {
        enrolled: row.get("enrolled"),
        access_active: active,
        scan_before: row.get("scan_before"),
        last_success: row.get("last_success_at"),
        last_completed: row.get("last_completed_at"),
        error: row.get("error_code"),
    })
}

#[derive(Debug, Clone)]
pub struct Claim {
    pub org: Uuid,
    pub token: Uuid,
    pub from: DateTime<Utc>,
    pub before: DateTime<Utc>,
    pub after_user: String,
    pub after_event: String,
}

enum Poll {
    Empty,
    Deferred,
    Ready(Claim),
}

pub async fn claim(pg: &PostgresClient) -> Result<Option<Claim>> {
    // Skip expired/unconfirmed organizations without ending every worker tick.
    // The caller also applies an overall time budget, including these DB calls.
    for _ in 0..100 {
        match claim_one(pg).await? {
            Poll::Ready(claim) => return Ok(Some(claim)),
            Poll::Empty => return Ok(None),
            Poll::Deferred => {}
        }
    }
    Ok(None)
}

async fn claim_one(pg: &PostgresClient) -> Result<Poll> {
    pg.execute("INSERT INTO team_usage_admission_scans(organization_id) SELECT e.organization_id FROM team_analytics_entitlements e JOIN team_rollouts r USING(organization_id) JOIN organizations o ON o.id=e.organization_id WHERE r.enabled AND o.deleted_at IS NULL ON CONFLICT DO NOTHING",&[]).await?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    let Some(row)=tx.query_opt("SELECT j.*,e.state,e.revision AS entitlement_revision FROM team_usage_admission_scans j JOIN team_analytics_entitlements e USING(organization_id) JOIN team_rollouts r USING(organization_id) JOIN organizations o ON o.id=j.organization_id WHERE r.enabled AND o.deleted_at IS NULL AND j.next_run_at<=clock_timestamp() AND (j.lease_until IS NULL OR j.lease_until<clock_timestamp()) ORDER BY j.next_run_at,j.organization_id FOR UPDATE OF j SKIP LOCKED LIMIT 1",&[]).await? else {return Ok(Poll::Empty)};
    let org: Uuid = row.get("organization_id");
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let state = serde_json::from_value::<State>(row.get("state"))
        .ok()
        .filter(|state| {
            state.validate().is_ok() && state.revision == row.get::<_, i64>("entitlement_revision")
        });
    let financial = state
        .as_ref()
        .map(|s| super::team_financial_guard::HintProof::capture(org, Some(s)))
        .transpose();
    if financial.is_err() {
        defer(&tx, org, "financial_guard_unconfirmed").await?;
        tx.commit().await?;
        return Ok(Poll::Deferred);
    }
    let financial = financial?;
    if state.as_ref().is_none_or(|state| !state.covered_at(now)) {
        let code = if state.is_none() {
            "entitlement_unconfirmed"
        } else {
            "entitlement_inactive"
        };
        tx.execute("UPDATE team_usage_admission_scans SET next_run_at=clock_timestamp()+interval '60 seconds',lease_token=NULL,lease_until=NULL,error_code=$2 WHERE organization_id=$1",&[&org,&code]).await?;
        tx.commit().await?;
        return Ok(Poll::Deferred);
    }
    let state = state.context("entitlement unavailable")?;
    let cutoff = crate::services::team_trust::cutoff(now);
    let from = row
        .get::<_, Option<DateTime<Utc>>>("scan_from")
        .unwrap_or(state.activated_at.max(cutoff));
    // A fixed end and lexical keyset permit concurrent inserts without offset skips.
    // Each completed sweep restarts to discover delayed events/corrections behind the key.
    let before = row
        .get::<_, Option<DateTime<Utc>>>("scan_before")
        .unwrap_or(now);
    let token = Uuid::now_v7();
    let claim = Claim {
        org,
        token,
        from,
        before,
        after_user: row.get("after_user"),
        after_event: row.get("after_event"),
    };
    tx.execute("UPDATE team_usage_admission_scans SET scan_from=$2,scan_before=$3,lease_token=$4,lease_until=clock_timestamp()+interval '60 seconds' WHERE organization_id=$1",&[&org,&from,&before,&token]).await?;
    if financial.as_ref().is_none_or(|p| p.validate().is_err()) {
        defer(&tx, org, "financial_guard_unconfirmed").await?;
        tx.commit().await?;
        return Ok(Poll::Deferred);
    }
    tx.commit().await?;
    Ok(Poll::Ready(claim))
}

pub async fn lock_claim(tx: &Transaction<'_>, claim: &Claim) -> Result<DateTime<Utc>> {
    let row=tx.query_opt("SELECT lease_token,lease_until,scan_from,scan_before,after_user,after_event FROM team_usage_admission_scans WHERE organization_id=$1 FOR UPDATE",&[&claim.org]).await?.context("admission scan missing")?;
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    ensure!(
        row.get::<_, Option<Uuid>>(0) == Some(claim.token)
            && row
                .get::<_, Option<DateTime<Utc>>>(1)
                .is_some_and(|at| at > now)
            && row.get::<_, Option<DateTime<Utc>>>(2) == Some(claim.from)
            && row.get::<_, Option<DateTime<Utc>>>(3) == Some(claim.before)
            && row.get::<_, String>(4) == claim.after_user
            && row.get::<_, String>(5) == claim.after_event,
        "admission scan claim expired or changed"
    );
    Ok(row.get::<_, Option<DateTime<Utc>>>(1).unwrap())
}

async fn defer(tx: &Transaction<'_>, org: Uuid, code: &str) -> Result<()> {
    tx.execute("UPDATE team_usage_admission_scans SET next_run_at=clock_timestamp()+interval '60 seconds',lease_token=NULL,lease_until=NULL,error_code=$2 WHERE organization_id=$1", &[&org,&code]).await?;
    Ok(())
}

pub async fn validate_deadline(tx: &Transaction<'_>, deadline: DateTime<Utc>) -> Result<()> {
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    ensure!(now < deadline, "admission scan lease expired before commit");
    Ok(())
}

/// Same transaction as admissions. A lost response repeats the page without new receipts.
pub async fn advance(
    tx: &Transaction<'_>,
    claim: &Claim,
    last: Option<(String, String)>,
    full: bool,
) -> Result<()> {
    let _ = lock_claim(tx, claim).await?;
    let (user, event) = last.unwrap_or_default();
    tx.execute("UPDATE team_usage_admission_scans SET after_user=CASE WHEN $4 THEN $2 ELSE '' END,after_event=CASE WHEN $4 THEN $3 ELSE '' END,scan_from=CASE WHEN $4 THEN scan_from ELSE NULL END,scan_before=CASE WHEN $4 THEN scan_before ELSE NULL END,lease_token=NULL,lease_until=NULL,next_run_at=clock_timestamp()+CASE WHEN $4 THEN interval '0 seconds' ELSE interval '5 minutes' END,last_success_at=clock_timestamp(),last_completed_at=CASE WHEN $4 THEN last_completed_at ELSE clock_timestamp() END,error_code=NULL WHERE organization_id=$1",&[&claim.org,&user,&event,&full]).await?;
    Ok(())
}

pub async fn retry(pg: &PostgresClient, claim: &Claim) -> Result<()> {
    pg.execute("UPDATE team_usage_admission_scans SET lease_token=NULL,lease_until=NULL,next_run_at=clock_timestamp()+interval '60 seconds',error_code='admission_dependency_unconfirmed' WHERE organization_id=$1 AND lease_token=$2",&[&claim.org,&claim.token]).await?;
    Ok(())
}
