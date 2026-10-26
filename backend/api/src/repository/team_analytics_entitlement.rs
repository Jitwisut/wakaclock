//! Transactional, nonretroactive coverage history. Activation is intentionally not
//! exposed by HTTP until all Team fact-admission/read/restore gates are wired.
use crate::{
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{CommercialDeployment, FinancialGuard, FinancialObservation},
    },
    services::{
        authorization::AuthorizationService,
        team_analytics_entitlement::{Evidence, Scope, State},
        team_financial_guard::{Head, Pending},
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
pub async fn start_trial(
    pg: &PostgresClient,
    org: Uuid,
    actor: Uuid,
    seats: i32,
    deployment: &CommercialDeployment,
) -> Result<State> {
    let guard = deployment.guard();
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_seats::lock(&tx, org).await?;
    AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let existing = load(&tx, org).await?;
    let proof = verify_guard(Some(guard), org, existing.as_ref())?;
    if let Some(existing) = existing {
        ensure!(
            existing.package_seats == seats,
            "trial activation terms changed"
        );
        let change = Change {
            previous: Some(existing.clone()),
            next: None,
            proof,
        };
        prepare_change(Some(guard), org, &change)?;
        tx.commit().await?;
        confirm_change(Some(guard), org, &change, None)?;
        return Ok(existing);
    }
    let state = State::trial(seats, now)?;
    save(&tx, org, &state, "trial_started", now).await?;
    tx.execute(
        "UPDATE team_rollouts SET generation=generation+1,updated_at=$2 WHERE organization_id=$1",
        &[&org, &now],
    )
    .await?;
    tx.execute("INSERT INTO audit_logs(id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,'team.trial.started','organization',$4,$5)", &[&Uuid::now_v7(),&org,&actor,&org,&serde_json::json!({"package_seats":seats,"entitlement_revision":state.revision})]).await?;
    let change = Change {
        previous: None,
        next: Some(state.clone()),
        proof,
    };
    let pending = prepare_change(Some(guard), org, &change)?;
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("financial_guard_commit_reconciliation_required"))?;
    confirm_change(Some(guard), org, &change, pending.as_ref())?;
    Ok(state)
}

struct Proof {
    token: String,
    head: Head,
}
pub(crate) struct Change {
    previous: Option<State>,
    next: Option<State>,
    proof: Option<Proof>,
}
impl Change {
    /// Bridge an already staged provider observation into its outer source group.
    /// Does not append standalone Prepare/Confirm or authorize a different SQL tx.
    pub(super) fn source_group(
        &self,
        guard: &FinancialGuard,
        org: Uuid,
        id: Uuid,
    ) -> Result<Option<crate::services::team_financial_transaction::EnrollmentChange>> {
        let proof = self
            .proof
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("financial_guard_required"))?;
        let current = guard.read()?;
        ensure!(
            current.organization_token(org)? == proof.token,
            "financial_guard_changed_before_commit"
        );
        current.snapshot.verify(org, self.previous.as_ref())?;
        Ok(self.next.as_ref().map(|state| {
            crate::services::team_financial_transaction::EnrollmentChange {
                organization: org,
                expected: proof.head.clone(),
                transition: Pending {
                    transition_id: id,
                    state: state.clone().into(),
                },
            }
        }))
    }
    #[cfg(test)]
    pub(crate) fn changed(&self) -> bool {
        self.next.is_some()
    }
}
fn verify_guard(
    guard: Option<&FinancialGuard>,
    org: Uuid,
    state: Option<&State>,
) -> Result<Option<Proof>> {
    let Some(guard) = guard else {
        ensure!(
            state.is_none(),
            "financial_guard_required_for_enrolled_organization"
        );
        return Ok(None); // Explicitly precommercial operation only; never proof of legacy after rollout.
    };
    guard.namespace()?;
    let snapshot = guard.read()?;
    let head = snapshot.snapshot.verify(org, state)?;
    Ok(Some(Proof {
        token: snapshot.organization_token(org)?,
        head,
    }))
}
/// Final outer-transaction boundary only. Later DB failure leaves the proposal
/// intact and requires reconciliation; never call this from save().
pub(crate) fn prepare_change(
    guard: Option<&FinancialGuard>,
    org: Uuid,
    change: &Change,
) -> Result<Option<Pending>> {
    match (&change.proof, guard) {
        (Some(proof), Some(guard)) => {
            let current = guard.read()?;
            ensure!(
                current.organization_token(org)? == proof.token,
                "financial_guard_changed_before_commit"
            );
            current.snapshot.verify(org, change.previous.as_ref())?;
            if let Some(state) = &change.next {
                let pending = Pending {
                    transition_id: Uuid::now_v7(),
                    state: state.clone().into(),
                };
                guard.prepare(org, proof.head.clone(), pending.clone())?;
                Ok(Some(pending))
            } else {
                Ok(None)
            }
        }
        (None, None) => {
            ensure!(
                change.previous.is_none() && change.next.is_none(),
                "financial_guard_required"
            );
            Ok(None)
        }
        _ => anyhow::bail!("financial_guard_configuration_changed"),
    }
}
/// Invoke only after confirmed DB commit, never after rollback/unknown outcome.
pub(crate) fn confirm_change(
    guard: Option<&FinancialGuard>,
    org: Uuid,
    change: &Change,
    pending: Option<&Pending>,
) -> Result<()> {
    if let Some(pending) = pending {
        let guard = guard.ok_or_else(|| anyhow::anyhow!("financial_guard_required"))?;
        guard
            .confirm_committed(org, pending.transition_id, &pending.state)
            .map_err(|_| anyhow::anyhow!("financial_guard_commit_reconciliation_required"))?;
    }
    verify_guard(
        guard,
        org,
        change.next.as_ref().or(change.previous.as_ref()),
    )?;
    Ok(())
}
/// Lost trial ACK only. Requires already committed, exact canonical initial trial
/// plus matching immutable history and audit; never recreates a missing DB row.
pub async fn reconcile_trial(
    pg: &PostgresClient,
    org: Uuid,
    actor: Uuid,
    transition_id: Uuid,
    guard: &FinancialGuard,
) -> Result<State> {
    guard.namespace()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_seats::lock(&tx, org).await?;
    AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
    let current = load(&tx, org)
        .await?
        .ok_or_else(|| anyhow::anyhow!("trial_commit_not_confirmed"))?;
    ensure!(
        current == State::trial(current.package_seats, current.activated_at)?,
        "trial_reconciliation_cannot_confirm_provider_state"
    );
    let external = guard.read()?;
    let token = external.organization_token(org)?;
    let entry = external
        .snapshot
        .organizations
        .get(&org)
        .ok_or_else(|| anyhow::anyhow!("financial_guard_unknown_organization"))?;
    match (&entry.head, &entry.pending) {
        (Head::Legacy, Some(p)) => ensure!(
            p.transition_id == transition_id && p.state.as_ref() == &current,
            "trial_transition_mismatch"
        ),
        (Head::Enrolled { state }, None) => ensure!(
            entry.committed_transition_id == Some(transition_id) && state.as_ref() == &current,
            "trial_transition_mismatch"
        ),
        _ => anyhow::bail!("trial_transition_unconfirmed"),
    }
    let history=tx.query_opt("SELECT reason,state FROM team_analytics_entitlement_history WHERE organization_id=$1 AND revision=1", &[&org]).await?.ok_or_else(||anyhow::anyhow!("trial_history_missing"))?;
    ensure!(
        history.get::<_, String>(0) == "trial_started"
            && serde_json::from_value::<State>(history.get(1))? == current,
        "trial_history_conflict"
    );
    ensure!(tx.query_opt("SELECT 1 FROM audit_logs WHERE organization_id=$1 AND action='team.trial.started' AND resource_id=$1 AND metadata->>'entitlement_revision'='1' AND metadata->>'package_seats'=$2 FOR SHARE", &[&org,&current.package_seats.to_string()]).await?.is_some(),"trial_audit_missing");
    ensure!(
        guard.read()?.organization_token(org)? == token,
        "financial_guard_changed_during_trial_reconciliation"
    );
    tx.commit().await?;
    guard
        .confirm_committed(org, transition_id, &current)
        .map_err(|_| anyhow::anyhow!("financial_guard_commit_reconciliation_required"))?;
    verify_guard(Some(guard), org, Some(&current))?;
    Ok(current)
}

pub(crate) async fn load(tx: &Transaction<'_>, org: Uuid) -> Result<Option<State>> {
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
pub(crate) async fn observe(
    tx: &Transaction<'_>,
    claim: &super::team_stripe::Claim,
    snapshot: &Snapshot,
    invoice: Option<&Invoice>,
    assessment: &Assessment,
    now: DateTime<Utc>,
    authority: &FinancialObservation,
) -> Result<Change> {
    let guard = authority.guard();
    let previous = load(tx, claim.organization_id).await?;
    if previous.is_some() {
        authority.require_enrolled()?;
    }
    let proof = verify_guard(guard, claim.organization_id, previous.as_ref())?;
    let Some(mut state) = previous.clone() else {
        return Ok(Change {
            previous,
            next: None,
            proof,
        });
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
        return Ok(Change {
            previous,
            next: None,
            proof,
        });
    }
    save(tx, claim.organization_id, &state, "provider_observed", now).await?;
    Ok(Change {
        previous,
        next: Some(state),
        proof,
    })
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
        let ledger = crate::infrastructure::team_financial_guard::TestLedger::new(&[org]);
        let guard = &ledger.guard;
        let deployment = ledger.deployment();
        assert!(start_trial(&pg, org, other, 10, &deployment).await.is_err());
        assert!(start_trial(&pg, org, owner, 11, &deployment).await.is_err());
        // History failure cannot leave an activated trial behind.
        pg.execute("ALTER TABLE team_analytics_entitlement_history ADD CONSTRAINT fixture_history_failure CHECK(reason<>'trial_started') NOT VALID",&[]).await.unwrap();
        assert!(start_trial(&pg, org, owner, 10, &deployment).await.is_err());
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
            start_trial(&pg, org, owner, 10, &deployment),
            start_trial(&pg, org, owner, 10, &deployment)
        );
        let a = a.unwrap();
        assert_eq!(a, b.unwrap());
        assert_eq!(a.trial_ends_at - a.trial_started_at, Duration::days(14));
        assert!(start_trial(&pg, org, owner, 25, &deployment).await.is_err());
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
        let change = observe(
            &tx,
            &claim,
            &snapshot,
            Some(&invoice),
            &assessment,
            now,
            &deployment.observation(),
        )
        .await
        .unwrap();
        assert!(change.changed());
        let paid = load(&tx, org).await.unwrap().unwrap();
        assert!(paid.covered_at(at + Duration::days(20)));
        tx.rollback().await.unwrap(); // Simulated crash/response lost before commit.
        assert_eq!(
            start_trial(&pg, org, owner, 10, &deployment).await.unwrap(),
            a
        );
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        let change = observe(
            &tx,
            &claim,
            &snapshot,
            Some(&invoice),
            &assessment,
            now,
            &deployment.observation(),
        )
        .await
        .unwrap();
        assert!(change.changed());
        let pending = prepare_change(Some(guard), org, &change).unwrap();
        tx.commit().await.unwrap();
        confirm_change(Some(guard), org, &change, pending.as_ref()).unwrap();
        let persisted = start_trial(&pg, org, owner, 10, &deployment).await.unwrap();
        assert_eq!(persisted.revision, 2);
        assert!(persisted.ever_paid);
        let tx = db.transaction().await.unwrap();
        super::super::team_seats::lock(&tx, org).await.unwrap();
        let now = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        assert!(!observe(
            &tx,
            &claim,
            &snapshot,
            Some(&invoice),
            &assessment,
            now,
            &deployment.observation()
        )
        .await
        .unwrap()
        .changed());
        let mut wrong = claim.clone();
        wrong.livemode = true;
        wrong.revision = 2;
        assert!(observe(
            &tx,
            &wrong,
            &snapshot,
            Some(&invoice),
            &assessment,
            now,
            &deployment.observation()
        )
        .await
        .is_err());
        tx.rollback().await.unwrap();
        assert_eq!(
            start_trial(&pg, org, owner, 10, &deployment).await.unwrap(),
            persisted
        );
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
        let change = observe(
            &tx,
            &failure_claim,
            &snapshot,
            None,
            &mismatch,
            now,
            &deployment.observation(),
        )
        .await
        .unwrap();
        assert!(change.changed());
        let current = load(&tx, org).await.unwrap().unwrap();
        assert!(current.first_failure_at.is_none());
        assert!(!current
            .windows
            .iter()
            .any(|w| w.kind == crate::services::team_analytics_entitlement::Kind::Grace));
        let pending = prepare_change(Some(guard), org, &change).unwrap();
        tx.commit().await.unwrap();
        confirm_change(Some(guard), org, &change, pending.as_ref()).unwrap();
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
        let change = observe(
            &tx,
            &failure_claim,
            &snapshot,
            None,
            &delinquent,
            now,
            &deployment.observation(),
        )
        .await
        .unwrap();
        assert!(change.changed());
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
        let pending = prepare_change(Some(guard), org, &change).unwrap();
        tx.commit().await.unwrap();
        confirm_change(Some(guard), org, &change, pending.as_ref()).unwrap();
        let persisted = current;
        // Repeated migrations/restarts do not start another trial or change coverage.
        pg.migrate().await.unwrap();
        assert_eq!(
            start_trial(&pg, org, owner, 10, &deployment).await.unwrap(),
            persisted
        );
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        for u in [owner, other] {
            pg.execute("DELETE FROM users WHERE id=$1", &[&u])
                .await
                .unwrap();
        }
    }
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn team_trial_financial_guard_commit_restore_and_reconciliation() {
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
        let first = Uuid::now_v7();
        let failed = Uuid::now_v7();
        let unknown = Uuid::now_v7();
        let owner = Uuid::now_v7();
        let other = Uuid::now_v7();
        for user in [owner, other] {
            pg.execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&user, &user.to_string()],
            )
            .await
            .unwrap();
        }
        for org in [first, failed, unknown] {
            pg.execute(
                "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Guarded trial fixture')",
                &[&org, &org.to_string()],
            )
            .await
            .unwrap();
            pg.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')", &[&org,&owner]).await.unwrap();
        }
        let fixture =
            crate::infrastructure::team_financial_guard::TestLedger::new(&[first, failed]);
        let guard = &fixture.guard;
        let deployment = fixture.deployment();
        assert!(start_trial(&pg, unknown, owner, 10, &deployment)
            .await
            .is_err());
        assert!(CommercialDeployment::for_test(
            guard.clone().pin_namespace(Uuid::now_v7()).unwrap()
        )
        .is_err());
        // DB commits the trial, then process/response disappears before external confirmation.
        guard.fail_commit_confirmation_once();
        assert_eq!(
            start_trial(&pg, first, owner, 10, &deployment)
                .await
                .unwrap_err()
                .to_string(),
            "financial_guard_commit_reconciliation_required"
        );
        let current: State = serde_json::from_value(
            pg.query_one(
                "SELECT state FROM team_analytics_entitlements WHERE organization_id=$1",
                &[&first],
            )
            .await
            .unwrap()
            .get(0),
        )
        .unwrap();
        let saved = guard.read().unwrap();
        let pending = saved.snapshot.organizations[&first]
            .pending
            .as_ref()
            .unwrap();
        let id = pending.transition_id;
        assert_eq!(pending.state.as_ref(), &current);
        assert!(
            start_trial(&pg, first, owner, 10, &deployment)
                .await
                .is_err(),
            "retry never creates a new trial while outcome is pending"
        );
        assert!(reconcile_trial(&pg, first, other, id, guard).await.is_err());
        assert!(reconcile_trial(&pg, first, owner, Uuid::now_v7(), guard)
            .await
            .is_err());
        // Missing history or audit cannot be filled from the external proposal.
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        let history=tx.query_one("DELETE FROM team_analytics_entitlement_history WHERE organization_id=$1 AND revision=1 RETURNING state,recorded_at", &[&first]).await.unwrap();
        tx.commit().await.unwrap();
        assert!(reconcile_trial(&pg, first, owner, id, guard).await.is_err());
        pg.execute("INSERT INTO team_analytics_entitlement_history(organization_id,revision,reason,state,recorded_at) VALUES($1,1,'trial_started',$2,$3)", &[&first,&history.get::<_,serde_json::Value>(0),&history.get::<_,DateTime<Utc>>(1)]).await.unwrap();
        pg.execute("UPDATE audit_logs SET action='fixture_hidden_trial_audit' WHERE organization_id=$1 AND action='team.trial.started'", &[&first]).await.unwrap();
        assert!(reconcile_trial(&pg, first, owner, id, guard).await.is_err());
        pg.execute("UPDATE audit_logs SET action='team.trial.started' WHERE organization_id=$1 AND action='fixture_hidden_trial_audit'", &[&first]).await.unwrap();
        assert_eq!(
            reconcile_trial(&pg, first, owner, id, guard).await.unwrap(),
            current
        );
        assert_eq!(
            reconcile_trial(&pg, first, owner, id, guard).await.unwrap(),
            current
        );
        assert_eq!(
            start_trial(&pg, first, owner, 10, &deployment)
                .await
                .unwrap(),
            current
        );
        assert_eq!(pg.query_one("SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND action='team.trial.started'", &[&first]).await.unwrap().get::<_,i64>(0),1);
        // A restored pre-enrollment database cannot be reclassified as legacy.
        let lost=pg.query_one("DELETE FROM team_analytics_entitlements WHERE organization_id=$1 RETURNING created_at,updated_at", &[&first]).await.unwrap();
        assert!(start_trial(&pg, first, owner, 10, &deployment)
            .await
            .is_err());
        assert!(reconcile_trial(&pg, first, owner, id, guard).await.is_err());
        pg.execute("INSERT INTO team_analytics_entitlements(organization_id,revision,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5)", &[&first,&current.revision,&serde_json::to_value(&current).unwrap(),&lost.get::<_,DateTime<Utc>>(0),&lost.get::<_,DateTime<Utc>>(1)]).await.unwrap();
        // A truly failed DB COMMIT keeps the prepared external history, but cannot
        // be repaired by claiming that a proposal proves committed activation.
        db.batch_execute("CREATE FUNCTION fixture_deferred_trial_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic deferred trial commit failure'; END$$; CREATE CONSTRAINT TRIGGER fixture_trial_commit_failure AFTER INSERT ON team_analytics_entitlement_history DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_deferred_trial_failure();").await.unwrap();
        assert!(start_trial(&pg, failed, owner, 10, &deployment)
            .await
            .is_err());
        db.batch_execute("DROP TRIGGER fixture_trial_commit_failure ON team_analytics_entitlement_history; DROP FUNCTION fixture_deferred_trial_failure();").await.unwrap();
        let state = guard.read().unwrap();
        let proposal = state.snapshot.organizations[&failed]
            .pending
            .as_ref()
            .unwrap();
        assert!(pg
            .query_opt(
                "SELECT 1 FROM team_analytics_entitlements WHERE organization_id=$1",
                &[&failed]
            )
            .await
            .unwrap()
            .is_none());
        assert!(
            reconcile_trial(&pg, failed, owner, proposal.transition_id, guard)
                .await
                .is_err()
        );
        assert!(start_trial(&pg, failed, owner, 10, &deployment)
            .await
            .is_err());
        for org in [first, failed, unknown] {
            pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
                .await
                .unwrap();
        }
        for user in [owner, other] {
            pg.execute("DELETE FROM users WHERE id=$1", &[&user])
                .await
                .unwrap();
        }
    }
}
