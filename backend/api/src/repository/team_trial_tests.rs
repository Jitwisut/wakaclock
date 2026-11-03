//! Isolated metadata fixtures; never use a real account or provider credential.
use super::*;
use crate::{
    config::PostgresConfig,
    infrastructure::team_financial_guard::TestLedger,
    services::{
        team_analytics_entitlement::State,
        team_financial_guard::{Head, Pending},
    },
};

struct Environment(Vec<(&'static str, Option<std::ffi::OsString>)>);
impl Environment {
    fn set(values: &[(&'static str, std::ffi::OsString)]) -> Self {
        let previous = values
            .iter()
            .map(|(key, _)| (*key, std::env::var_os(key)))
            .collect();
        for (key, value) in values {
            std::env::set_var(key, value);
        }
        Self(previous)
    }
}
impl Drop for Environment {
    fn drop(&mut self) {
        for (key, value) in &self.0 {
            if let Some(value) = value {
                std::env::set_var(key, value)
            } else {
                std::env::remove_var(key)
            }
        }
    }
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL; run serially"]
async fn team_self_service_trial_owner_rollout_recovery_and_personal_seat_fences() {
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
    let org = Uuid::now_v7();
    let missing = Uuid::now_v7();
    let personal = Uuid::now_v7();
    let old = Uuid::now_v7();
    let owner = Uuid::now_v7();
    let other = Uuid::now_v7();
    for user in [owner, other] {
        pg.execute(
            "INSERT INTO users(id,username,is_active) VALUES($1,$2,true)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
    }
    for id in [org, missing] {
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic trial scope')",
            &[&id, &id.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')",&[&id,&owner]).await.unwrap();
        pg.execute(
            "UPDATE team_rollouts SET enabled=true WHERE organization_id=$1",
            &[&id],
        )
        .await
        .unwrap();
    }
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'viewer','viewer')",&[&org,&other]).await.unwrap();
    let ledger = TestLedger::new(&[org, missing]);
    let deployment = ledger.deployment();
    let guard = &ledger.guard;
    let _environment = Environment::set(&[
        ("ATOAXIS_TEAM_SELF_SERVICE_TRIAL_ENABLED", "0".into()),
        ("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED", "1".into()),
        (
            "ATOAXIS_TEAM_FINANCIAL_GUARD_PATH",
            ledger.path().as_os_str().to_owned(),
        ),
        (
            "ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE",
            guard.namespace().unwrap().to_string().into(),
        ),
    ]);
    assert!(status(&pg, org, owner, &deployment).await.is_err());
    std::env::set_var("ATOAXIS_TEAM_SELF_SERVICE_TRIAL_ENABLED", "1");
    assert!(
        status(&pg, org, owner, &deployment)
            .await
            .unwrap()
            .can_start
    );
    assert!(status(&pg, org, other, &deployment).await.is_err());

    // A genuinely inserted personal org in this transaction can receive only
    // its first owner seat. It does not acquire a financial baseline.
    let mut db = pg.transaction_client().await.unwrap();
    let tx = db.transaction().await.unwrap();
    crate::repository::team_seats::lock(&tx, personal)
        .await
        .unwrap();
    tx.execute("INSERT INTO organizations(id,slug,name,personal_owner_id) VALUES($1,$2,'Synthetic personal creation',$3)",&[&personal,&personal.to_string(),&owner]).await.unwrap();
    crate::repository::team_seats::admit(&tx, personal, owner, "owner", "developer")
        .await
        .unwrap();
    tx.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')",&[&personal,&owner]).await.unwrap();
    tx.commit().await.unwrap();
    assert!(!guard
        .read()
        .unwrap()
        .snapshot
        .organizations
        .contains_key(&personal));
    let tx = db.transaction().await.unwrap();
    crate::repository::team_seats::lock(&tx, personal)
        .await
        .unwrap();
    crate::repository::team_seats::admit(&tx, personal, owner, "owner", "developer")
        .await
        .unwrap();
    tx.rollback().await.unwrap();

    // UPDATE changes xmin too; it must not turn an old unknown org into fresh creation.
    pg.execute("INSERT INTO organizations(id,slug,name,personal_owner_id,created_at) VALUES($1,$2,'Synthetic old scope',$3,clock_timestamp()-interval '1 day')",&[&old,&old.to_string(),&other]).await.unwrap();
    let tx = db.transaction().await.unwrap();
    crate::repository::team_seats::lock(&tx, old).await.unwrap();
    tx.execute(
        "UPDATE organizations SET updated_at=now() WHERE id=$1",
        &[&old],
    )
    .await
    .unwrap();
    assert!(
        crate::repository::team_seats::admit(&tx, old, other, "owner", "developer")
            .await
            .is_err()
    );
    tx.rollback().await.unwrap();

    // Lost Confirm retains the exact original committed trial, not a new window.
    guard.fail_commit_confirmation_once();
    assert!(
        crate::repository::team_analytics_entitlement::start_self_service_trial(
            &pg,
            org,
            owner,
            10,
            &deployment
        )
        .await
        .is_err()
    );
    let pending = status(&pg, org, owner, &deployment).await.unwrap();
    assert_eq!(
        pending.disposition,
        team_trial::Disposition::RecoveryRequired
    );
    let recovery = pending.recovery.clone().unwrap();
    assert!(!pending.can_start);
    let start = pending.trial_started_at;
    let end = pending.trial_ends_at;
    assert!(
        crate::repository::team_analytics_entitlement::reconcile_self_service_trial(
            &pg,
            org,
            other,
            recovery.transition_id,
            &deployment
        )
        .await
        .is_err()
    );
    crate::repository::team_analytics_entitlement::reconcile_self_service_trial(
        &pg,
        org,
        owner,
        recovery.transition_id,
        &deployment,
    )
    .await
    .unwrap();
    let recovered = status(&pg, org, owner, &deployment).await.unwrap();
    assert_eq!(recovered.trial_started_at, start);
    assert_eq!(recovered.trial_ends_at, end);
    assert_eq!(recovered.disposition, team_trial::Disposition::Active);
    assert!(recovered.recovery.is_none());
    crate::repository::team_analytics_entitlement::start_self_service_trial(
        &pg,
        org,
        owner,
        10,
        &deployment,
    )
    .await
    .unwrap();
    assert_eq!(
        status(&pg, org, owner, &deployment)
            .await
            .unwrap()
            .trial_ends_at,
        end
    );
    assert_eq!(pg.query_one("SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND action='team.trial.started'",&[&org]).await.unwrap().get::<_,i64>(0),1);

    // Independent enrollment survives SQL loss. Same-seat personal operation is
    // not a financial grant; a genuinely new developer must fail closed.
    let expired = State::trial(10, Utc::now() - chrono::Duration::days(15)).unwrap();
    let transition = Uuid::now_v7();
    guard
        .prepare(
            missing,
            Head::Legacy,
            Pending {
                transition_id: transition,
                state: Box::new(expired.clone()),
            },
        )
        .unwrap();
    guard
        .confirm_committed(missing, transition, &expired)
        .unwrap();
    let unknown = status(&pg, missing, owner, &deployment).await.unwrap();
    assert_eq!(unknown.disposition, team_trial::Disposition::Unconfirmed);
    assert!(!unknown.can_start);
    assert!(unknown.trial_started_at.is_none());
    let tx = db.transaction().await.unwrap();
    crate::repository::team_seats::lock(&tx, missing)
        .await
        .unwrap();
    assert!(
        crate::repository::team_seats::admit(&tx, missing, other, "member", "developer")
            .await
            .is_err()
    );
    tx.rollback().await.unwrap();
    // Restoring the exact expired entitlement still retains its ten-seat cap.
    pg.execute(
        "INSERT INTO team_analytics_entitlements(organization_id,revision,state,created_at,updated_at) VALUES($1,1,$2,clock_timestamp(),clock_timestamp())",
        &[&missing, &serde_json::to_value(&expired).unwrap()],
    )
    .await
    .unwrap();
    let mut fill = Vec::new();
    for _ in 0..9 {
        let user = Uuid::now_v7();
        fill.push(user);
        pg.execute(
            "INSERT INTO users(id,username,is_active) VALUES($1,$2,true)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'member','developer')",&[&missing,&user]).await.unwrap();
    }
    let tx = db.transaction().await.unwrap();
    crate::repository::team_seats::lock(&tx, missing)
        .await
        .unwrap();
    assert!(
        crate::repository::team_seats::admit(&tx, missing, other, "member", "developer")
            .await
            .is_err()
    );
    crate::repository::team_seats::admit(&tx, missing, owner, "owner", "developer")
        .await
        .unwrap();
    tx.rollback().await.unwrap();
    for id in [org, missing, personal, old] {
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&id])
            .await
            .unwrap();
    }
    for user in fill.into_iter().chain([owner, other]) {
        pg.execute("DELETE FROM users WHERE id=$1", &[&user])
            .await
            .unwrap();
    }
}
