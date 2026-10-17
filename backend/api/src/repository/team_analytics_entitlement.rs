//! Transactional, nonretroactive coverage history. Activation is intentionally not
//! exposed by HTTP until all Team fact-admission/read/restore gates are wired.
use crate::{
    infrastructure::postgres::PostgresClient,
    services::{
        authorization::AuthorizationService,
        team_analytics_entitlement::{Evidence, Scope, State},
        team_stripe::Snapshot,
        team_stripe_invoice::Invoice,
        team_stripe_payment::Assessment,
    },
};
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use tokio_postgres::Transaction;
use uuid::Uuid;

/// Internal activation primitive, no card or Stripe dependency. A repeat can never
/// restart the trial. The explicit package comes from the authorized caller.
pub async fn start_trial(pg: &PostgresClient, org: Uuid, actor: Uuid, seats: i32) -> Result<State> {
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_seats::lock(&tx, org).await?;
    AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let existing = load(&tx, org).await?;
    if let Some(existing) = existing {
        ensure!(
            existing.package_seats == seats,
            "trial activation terms changed"
        );
        tx.commit().await?;
        return Ok(existing);
    }
    let state = State::trial(seats, now)?;
    save(&tx, org, &state, "trial_started", now).await?;
    tx.execute("INSERT INTO audit_logs(id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,'team.trial.started','organization',$4,$5)", &[&Uuid::now_v7(),&org,&actor,&org,&serde_json::json!({"package_seats":seats,"entitlement_revision":state.revision})]).await?;
    tx.commit().await?;
    Ok(state)
}
async fn load(tx: &Transaction<'_>, org: Uuid) -> Result<Option<State>> {
    let row=tx.query_opt("SELECT revision,state FROM team_analytics_entitlements WHERE organization_id=$1 FOR UPDATE",&[&org]).await?;
    row.map(|r| {
        let state: State = serde_json::from_value(r.get(1))?;
        state.validate()?;
        ensure!(
            state.revision == r.get::<_, i64>(0),
            "entitlement revision conflict"
        );
        Ok(state)
    })
    .transpose()
}
async fn save(
    tx: &Transaction<'_>,
    org: Uuid,
    state: &State,
    reason: &str,
    now: DateTime<Utc>,
) -> Result<()> {
    let json = serde_json::to_value(state)?;
    tx.execute("INSERT INTO team_analytics_entitlements(organization_id,revision,state,created_at,updated_at) VALUES($1,$2,$3,$4,$4) ON CONFLICT(organization_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state,updated_at=EXCLUDED.updated_at",&[&org,&state.revision,&json,&now]).await?;
    tx.execute("INSERT INTO team_analytics_entitlement_history(organization_id,revision,reason,state,recorded_at) VALUES($1,$2,$3,$4,$5)",&[&org,&state.revision,&reason,&json,&now]).await?;
    Ok(())
}
/// Caller holds the billing lock and has checked provider lease/binding/revision.
/// The worker cannot create an activation row. Persist in the same transaction as
/// financial observations/ACK; this is not authorization for paid analytics.
pub async fn observe(
    tx: &Transaction<'_>,
    claim: &super::team_stripe::Claim,
    snapshot: &Snapshot,
    invoice: Option<&Invoice>,
    assessment: &Assessment,
    now: DateTime<Utc>,
) -> Result<bool> {
    let Some(mut state) = load(tx, claim.organization_id).await? else {
        return Ok(false);
    };
    let scope = Scope {
        account: claim.account_id.clone(),
        live: claim.livemode,
        customer: claim.customer_id.clone(),
        subscription: claim.subscription_id.clone(),
        binding_revision: claim.binding_revision,
    };
    let current = assessment.clone().current(now, true);
    let failure: Option<DateTime<Utc>> = tx.query_one(
        "SELECT min(event_created) FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND customer_id=$4 AND event_kind='invoice.payment_failed' AND ($5::timestamptz IS NULL OR event_created>$5)",
        &[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.customer_id,&state.resolved_failure_through],
    ).await?.get(0);
    let evidence = if current.state == "settled" {
        match (
            current.package_seats,
            current.covered_until,
            invoice.and_then(|i| i.paid_at),
        ) {
            (Some(seats), Some(until), Some(settled_at)) => Evidence::Paid {
                seats,
                until,
                settled_at,
            },
            _ => Evidence::Unconfirmed,
        }
    } else if snapshot.status == "past_due" && current.accepted_terms_verified {
        failure.map_or(Evidence::Unconfirmed, |first_failure| Evidence::PastDue {
            first_failure,
        })
    } else if snapshot.status == "canceled" {
        Evidence::Canceled
    } else {
        Evidence::Unconfirmed
    };
    if !state.observe(&scope, claim.revision, snapshot.observed_at, now, &evidence)? {
        return Ok(false);
    }
    save(tx, claim.organization_id, &state, "provider_observed", now).await?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{config::PostgresConfig, services::team_stripe_payment};
    use chrono::Duration;
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn team_entitlement_trial_durability_owner_scope_and_observation_atomicity() {
        let url = std::env::var("POSTGRES_TEST_URL").unwrap();
        assert_eq!(
            url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
            Some("atoaxis_stripe_test")
        );
        let pg = PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap();
        pg.migrate().await.unwrap();
        pg.migrate().await.unwrap();
        let org = Uuid::now_v7();
        let owner = Uuid::now_v7();
        let other = Uuid::now_v7();
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Entitlement fixture')",
            &[&org, &org.to_string()],
        )
        .await
        .unwrap();
        for u in [owner, other] {
            pg.execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&u, &u.to_string()],
            )
            .await
            .unwrap();
        }
        pg.execute(
            "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
            &[&org, &owner],
        )
        .await
        .unwrap();
        assert!(start_trial(&pg, org, other, 10).await.is_err());
        assert!(start_trial(&pg, org, owner, 11).await.is_err());
        // History failure cannot leave an activated trial behind.
        pg.execute("ALTER TABLE team_analytics_entitlement_history ADD CONSTRAINT fixture_history_failure CHECK(reason<>'trial_started') NOT VALID",&[]).await.unwrap();
        assert!(start_trial(&pg, org, owner, 10).await.is_err());
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_analytics_entitlements WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
        pg.execute("ALTER TABLE team_analytics_entitlement_history DROP CONSTRAINT fixture_history_failure",&[]).await.unwrap();
        let (a, b) = tokio::join!(
            start_trial(&pg, org, owner, 10),
            start_trial(&pg, org, owner, 10)
        );
        let a = a.unwrap();
        assert_eq!(a, b.unwrap());
        assert_eq!(a.trial_ends_at - a.trial_started_at, Duration::days(14));
        assert!(start_trial(&pg, org, owner, 25).await.is_err());
        assert_eq!(pg.query_one("SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND action='team.trial.started'",&[&org]).await.unwrap().get::<_,i64>(0),1);
        let at = DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap();
        let (mut snapshot, invoice, package) = team_stripe_payment::tests::fixture(at);
        snapshot.cancel_at_period_end = true; // Not an effective cancellation.
        let assessment = team_stripe_payment::assess(&snapshot, Some(&invoice), Some(&package), at);
        let claim = super::super::team_stripe::Claim {
            account_id: "acct_entitlement".into(),
            livemode: false,
            subscription_id: snapshot.subscription_id.clone(),
            customer_id: snapshot.customer_id.clone(),
            organization_id: org,
            binding_revision: 1,
            revision: 1,
            lease_id: Uuid::now_v7(),
        };
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        assert!(
            observe(&tx, &claim, &snapshot, Some(&invoice), &assessment, now)
                .await
                .unwrap()
        );
        let paid = load(&tx, org).await.unwrap().unwrap();
        assert!(paid.covered_at(at + Duration::days(20)));
        tx.rollback().await.unwrap(); // Simulated crash/response lost before commit.
        assert_eq!(start_trial(&pg, org, owner, 10).await.unwrap(), a);
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        assert!(
            observe(&tx, &claim, &snapshot, Some(&invoice), &assessment, now)
                .await
                .unwrap()
        );
        tx.commit().await.unwrap();
        let persisted = start_trial(&pg, org, owner, 10).await.unwrap();
        assert_eq!(persisted.revision, 2);
        assert!(persisted.ever_paid);
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        assert!(
            !observe(&tx, &claim, &snapshot, Some(&invoice), &assessment, now)
                .await
                .unwrap()
        );
        let mut wrong = claim.clone();
        wrong.livemode = true;
        wrong.revision = 2;
        assert!(
            observe(&tx, &wrong, &snapshot, Some(&invoice), &assessment, now)
                .await
                .is_err()
        );
        tx.rollback().await.unwrap();
        assert_eq!(start_trial(&pg, org, owner, 10).await.unwrap(), persisted);
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_analytics_entitlement_history WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            2
        );
        // Both failed invoices predate the first delinquency reconciliation.
        // The latest invoice alone must not move the start of the episode.
        let first_failure = at - Duration::hours(12);
        let later_failure = at - Duration::hours(6);
        for (event, invoice_id, failed_at) in [
            ("evt_entitlement_a", "in_old", first_failure),
            ("evt_entitlement_b", "in_new", later_failure),
        ] {
            pg.execute("INSERT INTO team_stripe_inbox(account_id,livemode,event_id,payload_hash,event_kind,event_created,customer_id,subscription_id,invoice_id,disposition) VALUES($1,false,$2,$3,'invoice.payment_failed',$4,$5,$6,$7,'pending')", &[&claim.account_id,&event,&"a".repeat(64),&failed_at,&claim.customer_id,&claim.subscription_id,&invoice_id]).await.unwrap();
        }
        snapshot.status = "past_due".into();
        snapshot.latest_invoice_id = Some("in_new".into());
        snapshot.observed_at = Utc::now();
        snapshot.quantity = Some(2);
        let mismatch =
            team_stripe_payment::assess(&snapshot, None, Some(&package), snapshot.observed_at);
        assert!(!mismatch.accepted_terms_verified);
        let mut failure_claim = claim.clone();
        failure_claim.revision = 2;
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        assert!(
            observe(&tx, &failure_claim, &snapshot, None, &mismatch, now)
                .await
                .unwrap()
        );
        let current = load(&tx, org).await.unwrap().unwrap();
        assert!(current.first_failure_at.is_none());
        assert!(!current
            .windows
            .iter()
            .any(|w| w.kind == crate::services::team_analytics_entitlement::Kind::Grace));
        tx.commit().await.unwrap();
        snapshot.quantity = Some(1);
        snapshot.observed_at = Utc::now();
        failure_claim.revision = 3;
        let delinquent =
            team_stripe_payment::assess(&snapshot, None, Some(&package), snapshot.observed_at);
        assert!(delinquent.accepted_terms_verified);
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        assert!(
            observe(&tx, &failure_claim, &snapshot, None, &delinquent, now)
                .await
                .unwrap()
        );
        let current = load(&tx, org).await.unwrap().unwrap();
        assert_eq!(current.first_failure_at, Some(first_failure));
        assert_eq!(
            current
                .windows
                .iter()
                .find(|w| w.kind == crate::services::team_analytics_entitlement::Kind::Grace)
                .unwrap()
                .end,
            first_failure + Duration::days(7)
        );
        tx.commit().await.unwrap();
        let persisted = current;
        // Repeated migrations/restarts do not start another trial or change coverage.
        pg.migrate().await.unwrap();
        assert_eq!(start_trial(&pg, org, owner, 10).await.unwrap(), persisted);
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        for u in [owner, other] {
            pg.execute("DELETE FROM users WHERE id=$1", &[&u])
                .await
                .unwrap();
        }
    }
}
