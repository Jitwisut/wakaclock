//! Synthetic-only configuration regressions. Written during development-first;
//! do not count these as executed native/restore/provider evidence.
use super::*;
use crate::{config::PostgresConfig, infrastructure::team_financial_guard::TestLedger};

struct Environment(Vec<(&'static str, Option<std::ffi::OsString>)>);
impl Drop for Environment {
    fn drop(&mut self) {
        for (key, old) in &self.0 {
            if let Some(value) = old {
                std::env::set_var(key, value);
            } else {
                std::env::remove_var(key);
            }
        }
    }
}
#[tokio::test]
#[ignore = "isolated atoaxis_team_onboarding_test only; verification phase, serial"]
async fn pilot_original_plan_owner_privacy_timezone_and_restore_fences() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_onboarding_test")
    );
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let ledger = TestLedger::new(&[]);
    let deployment = ledger.deployment();
    let _enrollment = ledger.environment();
    let privacy_path = ledger.path().parent().unwrap().join("pilot-privacy.json");
    let environment = Environment(
        ["ATOAXIS_TEAM_ENABLED", "ATOAXIS_TEAM_PRIVACY_LEDGER_PATH"]
            .into_iter()
            .map(|key| (key, std::env::var_os(key)))
            .collect(),
    );
    std::env::set_var("ATOAXIS_TEAM_ENABLED", "true");
    std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &privacy_path);
    let owner = Uuid::now_v7();
    let outsider = Uuid::now_v7();
    for user in [owner, outsider] {
        pg.execute(
            "INSERT INTO users(id,username,is_active) VALUES($1,$2,true)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
    }
    let intent = Uuid::now_v7();
    let org = super::super::team_organization_birth::create(
        &pg,
        owner,
        "Synthetic pilot",
        &format!("pilot-{intent}"),
        intent,
        &deployment,
    )
    .await
    .unwrap()
    .id;
    let trust = super::super::team_trust::TeamTrustRepository::new(pg.clone());
    let empty = super::super::team_trust::Registry {
        schema_version: 2,
        checked_at: Utc::now(),
        organizations: Default::default(),
        dispositions: vec![],
    };
    std::fs::write(&privacy_path, serde_json::to_vec(&empty).unwrap()).unwrap();
    trust.export_registry(&privacy_path).await.unwrap();
    let plan = prepare(pg.clone(), org, owner, true, "Asia/Bangkok".into())
        .await
        .unwrap();
    assert!(!pg
        .query_one(
            "SELECT enabled FROM team_rollouts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    assert!(
        prepare(pg.clone(), org, outsider, true, "Asia/Bangkok".into())
            .await
            .is_err()
    );
    assert!(apply(pg.clone(), &plan, &plan.hash, false, true)
        .await
        .is_err());
    let first = apply(pg.clone(), &plan, &plan.hash, true, true)
        .await
        .unwrap();
    assert_eq!(first["already_applied"], false);
    assert_eq!(first["current_enabled"], true);
    assert_eq!(first["privacy_confirmation"], "unconfirmed");
    assert!(trust.guard(org).await.is_err());
    assert!(pg
        .query_one(
            "SELECT actor_user_id FROM audit_logs WHERE id=$1",
            &[&plan.body.id]
        )
        .await
        .unwrap()
        .get::<_, Option<Uuid>>(0)
        .is_none());
    let audit_metadata: serde_json::Value = pg
        .query_one(
            "SELECT metadata FROM audit_logs WHERE id=$1",
            &[&plan.body.id],
        )
        .await
        .unwrap()
        .get(0);
    assert!(audit_metadata.get("plan").is_none());
    assert!(audit_metadata.get("namespace").is_none());
    assert!(!audit_metadata
        .to_string()
        .contains(&plan.body.namespace.to_string()));
    assert!(!audit_metadata
        .to_string()
        .contains(&plan.body.expected.enrollment));
    assert!(!audit_metadata
        .to_string()
        .contains(&plan.body.expected.privacy));
    trust.export_registry(&privacy_path).await.unwrap();
    assert!(trust.guard(org).await.is_ok());
    let duplicate = apply(pg.clone(), &plan, &plan.hash, true, true)
        .await
        .unwrap();
    assert_eq!(duplicate["already_applied"], true);
    assert_eq!(duplicate["privacy_confirmation"], "observed");
    let stale_observation = {
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        let value = current(&tx, org).await.unwrap();
        tx.rollback().await.unwrap();
        value
    };
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM audit_logs WHERE id=$1",
            &[&plan.body.id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
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
    assert_eq!(pg.query_one("SELECT count(*) FROM organization_analytics_consents WHERE organization_id=$1 AND (share_aggregate OR share_individual)",&[&org]).await.unwrap().get::<_,i64>(0),0);

    // Simulated history lock: the tool must not move an already selected report
    // timezone. It can still close rollout with that same timezone.
    pg.execute(
        "UPDATE team_report_policies SET locked_at=now() WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    assert!(prepare(pg.clone(), org, owner, true, "UTC".into())
        .await
        .is_err());
    let close = prepare(pg.clone(), org, owner, false, "Asia/Bangkok".into())
        .await
        .unwrap();
    apply(pg.clone(), &close, &close.hash, true, true)
        .await
        .unwrap();
    trust.export_registry(&privacy_path).await.unwrap();
    let historical = apply(pg.clone(), &plan, &plan.hash, true, true)
        .await
        .unwrap();
    assert_eq!(historical["already_applied"], true);
    assert_eq!(historical["current_enabled"], false);
    assert_eq!(historical["matches_original_request"], false);
    // A response from an older committed/readback snapshot cannot attach the
    // later disabled generation's successful privacy check to enabled=true.
    let recaptured = report(pg.clone(), &plan, stale_observation, true).await;
    assert_eq!(recaptured["operation_observation"]["enabled"], true);
    assert_eq!(recaptured["current_enabled"], false);
    assert_eq!(recaptured["privacy_confirmation"], "observed");

    // SQL-only disappearance cannot justify replacing operation/registry proof.
    pg.execute("DELETE FROM audit_logs WHERE id=$1", &[&plan.body.id])
        .await
        .unwrap();
    assert!(apply(pg.clone(), &plan, &plan.hash, true, true)
        .await
        .is_err());
    assert!(!pg
        .query_one(
            "SELECT enabled FROM team_rollouts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    pg.execute("UPDATE organization_members SET deactivated_at=clock_timestamp() WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
    assert!(apply(pg.clone(), &close, &close.hash, true, true)
        .await
        .is_err());
    drop(environment);
}
