use super::*;
use crate::{
    config::PostgresConfig, infrastructure::team_financial_guard::TestLedger,
    services::team_stripe::Ingress,
};
use std::sync::Arc;

fn body(id: &str, ignored: bool, now: DateTime<Utc>) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({"id":id,"livemode":false,"created":now.timestamp(),"type":if ignored{"fixture.unknown"}else{"invoice.payment_failed"},"data":{"object":{"object":"invoice","id":"in_ingress","customer":"cus_ingress","subscription":"sub_ingress","description":"PRIVATE_INGRESS_DO_NOT_STORE","email":"PRIVATE_INGRESS_DO_NOT_STORE","prompt":"PRIVATE_INGRESS_DO_NOT_STORE"}}})).unwrap()
}
fn signature(bytes: &[u8], now: DateTime<Utc>) -> String {
    let mut data = format!("{}.", now.timestamp()).into_bytes();
    data.extend_from_slice(bytes);
    let mac = ring::hmac::sign(
        &ring::hmac::Key::new(ring::hmac::HMAC_SHA256, b"whsec_ingress_fixture"),
        &data,
    );
    format!(
        "t={},v1={}",
        now.timestamp(),
        mac.as_ref()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    )
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_ingress_runtime_signed_retry_restore_unknown_commit_and_lock_wait() {
    use super::super::team_stripe::{Acceptance, TeamStripeRepository};
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
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
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Ingress fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    let file = TestLedger::new(&[org]);
    let guard = &file.guard;
    let scope = Scope {
        account: format!("acct_ingress{}", org.simple()),
        live: false,
    };
    let repo = TeamStripeRepository::new_guarded(pg.clone(), file.deployment());
    // Explicit authority must reach Checkout even when no environment guard is
    // present. A valid provider observation plus a missing SQL intent otherwise
    // returns false; the guarded path must reject the missing/pending ingress.
    assert!(std::env::var_os("ATOAXIS_TEAM_FINANCIAL_GUARD_PATH").is_none());
    let checkout_operation = Uuid::now_v7();
    let expected = crate::services::team_stripe_checkout::ExpectedSession {
        operation: checkout_operation,
        customer: "cus_ingress",
        price: "price_payment",
        currency: "usd",
        amount_minor: 100,
        live: false,
    };
    let policy=crate::services::team_stripe_checkout::CheckoutPolicy::parse(br#"{"schema_version":1,"owner_approved":true,"return_origin":"https://fixture.invalid","automatic_tax":false}"#).unwrap();
    let checkout_claim = super::super::team_stripe_checkout::CheckoutClaim {
        operation: checkout_operation,
        revision: 1,
        lease: Uuid::now_v7(),
        proof: super::super::team_stripe_quote::CustomerProof {
            operation: Uuid::now_v7(),
            revision: 1,
            customer: "cus_ingress".into(),
            org,
            actor: Uuid::now_v7(),
            account: scope.account.clone(),
            live: false,
        },
        price: "price_payment".into(),
        currency: "usd".into(),
        amount_minor: 100,
        seats: 10,
        catalog_hash: "a".repeat(64),
        request: crate::services::team_stripe_checkout::FrozenRequest::new(&expected, &policy)
            .unwrap(),
        session_id: Some("cs_ingress".into()),
        lookup_only: false,
    };
    let now = Utc::now();
    let session = crate::services::team_stripe_checkout::SessionEvidence {
        operation: checkout_operation,
        customer: "cus_ingress".into(),
        price: "price_payment".into(),
        currency: "usd".into(),
        amount_minor: 100,
        live: false,
        id: "cs_ingress".into(),
        status: "complete".into(),
        expires_at: now + chrono::Duration::hours(1),
        subscription: Some("sub_ingress".into()),
        observed_at: now,
    };
    let (mut subscription, _, _) = crate::services::team_stripe_payment::tests::fixture(now);
    subscription.subscription_id = "sub_ingress".into();
    subscription.customer_id = "cus_ingress".into();
    let binding = crate::services::team_stripe_checkout::SubscriptionEvidence {
        operation: checkout_operation,
        session: "cs_ingress".into(),
        live: false,
        snapshot: subscription,
    };
    let checkout = repo.checkouts();
    assert!(checkout
        .receive_verified(&checkout_claim, &session, Some(&binding))
        .await
        .is_err());
    assert!(
        !super::super::team_stripe_checkout::CheckoutRepository::new(pg.clone())
            .receive_verified(&checkout_claim, &session, Some(&binding))
            .await
            .unwrap()
    );
    let receiver = Ingress::new(
        repo.clone(),
        scope.account.clone(),
        false,
        b"whsec_ingress_fixture".to_vec(),
    )
    .unwrap();
    let now = Utc::now();
    let first = body("evt_ingress_first", false, now);
    let signed = signature(&first, now);
    assert!(receiver.accept(&first, "invalid", now).await.is_err());
    assert!(guard.read().unwrap().snapshot.ingress.accounts.is_empty());
    assert!(receiver.accept(&first, &signed, now).await.is_err()); // no automatic baseline
    seed_empty_fixture(&pg, guard, &scope).await.unwrap();
    guard.fail_ingress_confirmation_once();
    assert!(receiver.accept(&first, &signed, now).await.is_err());
    let pending = independent(guard, &scope).unwrap();
    assert!(pending.pending.is_some());
    assert!(checkout
        .receive_verified(&checkout_claim, &session, Some(&binding))
        .await
        .is_err());
    let another = body("evt_ingress_other", false, now);
    assert!(receiver
        .accept(&another, &signature(&another, now), now)
        .await
        .is_err());
    assert!(repo.schedule_bound(&scope.account, false).await.is_err());
    assert!(repo.claim(&scope.account, false).await.is_err());
    assert_eq!(
        receiver.accept(&first, &signed, now).await.unwrap(),
        Acceptance::Duplicate
    );
    assert_eq!(
        pg.query_one(
            "SELECT requested_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&scope.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    assert_eq!(independent(guard, &scope).unwrap().receipts.len(), 1);
    assert!(!checkout
        .receive_verified(&checkout_claim, &session, Some(&binding))
        .await
        .unwrap());
    let (a, b) = tokio::join!(
        receiver.accept(&first, &signed, now),
        receiver.accept(&first, &signed, now)
    );
    assert_eq!(a.unwrap(), Acceptance::Duplicate);
    assert_eq!(b.unwrap(), Acceptance::Duplicate);
    // Mutable processing state is not part of immutable acceptance coverage.
    pg.execute("UPDATE team_stripe_inbox SET disposition='processed',processed_at=clock_timestamp() WHERE account_id=$1",&[&scope.account]).await.unwrap();
    assert_eq!(
        receiver.accept(&first, &signed, now).await.unwrap(),
        Acceptance::Duplicate
    );
    let ignored = body("evt_ingress_ignored", true, now);
    guard.fail_ingress_confirmation_once();
    assert!(receiver
        .accept(&ignored, &signature(&ignored, now), now)
        .await
        .is_err());
    assert_eq!(
        receiver
            .accept(&ignored, &signature(&ignored, now), now)
            .await
            .unwrap(),
        Acceptance::Duplicate
    );
    let row=pg.query_one("SELECT disposition,requested_revision FROM team_stripe_inbox WHERE account_id=$1 AND event_id='evt_ingress_ignored'",&[&scope.account]).await.unwrap();
    assert_eq!(row.get::<_, String>(0), "ignored");
    assert_eq!(row.get::<_, Option<i64>>(1), None);

    // COMMIT fails after file Prepare: exact pending receipt survives SQL rollback.
    pg.execute("CREATE FUNCTION fixture_ingress_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id IN ('evt_ingress_rollback','evt_ingress_job_conflict') THEN RAISE EXCEPTION 'synthetic_commit_failure'; END IF; RETURN NEW; END $$",&[]).await.unwrap();
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_ingress_commit_failure AFTER INSERT ON team_stripe_inbox DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_ingress_commit_failure()",&[]).await.unwrap();
    let rollback = body("evt_ingress_rollback", false, now);
    assert!(receiver
        .accept(&rollback, &signature(&rollback, now), now)
        .await
        .is_err());
    let original = independent(guard, &scope).unwrap().pending.unwrap().receipt;
    assert!(pg.query_opt("SELECT 1 FROM team_stripe_inbox WHERE account_id=$1 AND event_id='evt_ingress_rollback'",&[&scope.account]).await.unwrap().is_none());
    pg.execute(
        "DROP TRIGGER fixture_ingress_commit_failure ON team_stripe_inbox",
        &[],
    )
    .await
    .unwrap();
    assert_eq!(
        receiver
            .accept(&rollback, &signature(&rollback, now), now)
            .await
            .unwrap(),
        Acceptance::Duplicate
    );
    assert_eq!(
        independent(guard, &scope).unwrap().receipts["evt_ingress_rollback"],
        original
    );
    assert_eq!(
        pg.query_one(
            "SELECT requested_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&scope.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    // An untracked semantic writer changes the predecessor: never increment again.
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_ingress_commit_failure AFTER INSERT ON team_stripe_inbox DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_ingress_commit_failure()",&[]).await.unwrap();
    let conflict = body("evt_ingress_job_conflict", false, now);
    assert!(receiver
        .accept(&conflict, &signature(&conflict, now), now)
        .await
        .is_err());
    pg.execute(
        "DROP TRIGGER fixture_ingress_commit_failure ON team_stripe_inbox",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_ingress_commit_failure()", &[])
        .await
        .unwrap();
    pg.execute(
        "UPDATE team_stripe_reconcile_jobs SET requested_revision=4 WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    assert!(receiver
        .accept(&conflict, &signature(&conflict, now), now)
        .await
        .is_err());
    pg.execute(
        "UPDATE team_stripe_reconcile_jobs SET requested_revision=2 WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    assert_eq!(
        receiver
            .accept(&conflict, &signature(&conflict, now), now)
            .await
            .unwrap(),
        Acceptance::Duplicate
    );

    // Lease expiry after waiting for the account lock must reject completion.
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,false,'cus_ingress','sub_ingress')",&[&org,&scope.account]).await.unwrap();
    let claim = repo.claim(&scope.account, false).await.unwrap().unwrap();
    pg.execute("UPDATE team_stripe_reconcile_jobs SET lease_until=clock_timestamp()+interval '100 milliseconds' WHERE account_id=$1",&[&scope.account]).await.unwrap();
    let mut db = pg.transaction_client().await.unwrap();
    let held = db.transaction().await.unwrap();
    lock(&held, &scope).await.unwrap();
    let completing = repo.clone();
    let (mut snapshot, _, _) = crate::services::team_stripe_payment::tests::fixture(now);
    snapshot.subscription_id = "sub_ingress".into();
    snapshot.customer_id = "cus_ingress".into();
    let completion = tokio::spawn(async move { completing.complete(&claim, &snapshot).await });
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    held.commit().await.unwrap();
    assert!(!completion.await.unwrap().unwrap());
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_stripe_snapshots WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .is_none());

    // Missing committed event/head cannot use the duplicate path as an ACK shortcut.
    let stored:serde_json::Value=pg.query_one("SELECT to_jsonb(i) FROM team_stripe_inbox i WHERE account_id=$1 AND event_id='evt_ingress_first'",&[&scope.account]).await.unwrap().get(0);
    pg.execute(
        "DELETE FROM team_stripe_inbox WHERE account_id=$1 AND event_id='evt_ingress_first'",
        &[&scope.account],
    )
    .await
    .unwrap();
    assert!(receiver.accept(&first, &signed, now).await.is_err());
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_stripe_inbox WHERE account_id=$1 AND event_id='evt_ingress_first'",
            &[&scope.account]
        )
        .await
        .unwrap()
        .is_none());
    // Restore only this synthetic fault, not a production recovery operation.
    pg.execute("INSERT INTO team_stripe_inbox SELECT * FROM jsonb_populate_record(NULL::team_stripe_inbox,$1)",&[&stored]).await.unwrap();
    let head: serde_json::Value = pg
        .query_one(
            "DELETE FROM team_stripe_ingress_heads h WHERE account_id=$1 RETURNING to_jsonb(h)",
            &[&scope.account],
        )
        .await
        .unwrap()
        .get(0);
    assert!(receiver.accept(&first, &signed, now).await.is_err());
    pg.execute("INSERT INTO team_stripe_ingress_heads SELECT * FROM jsonb_populate_record(NULL::team_stripe_ingress_heads,$1)",&[&head]).await.unwrap();
    assert_eq!(
        receiver.accept(&first, &signed, now).await.unwrap(),
        Acceptance::Duplicate
    );

    let stored: String = pg
        .query_one(
            "SELECT jsonb_agg(to_jsonb(i))::text FROM team_stripe_inbox i WHERE account_id=$1",
            &[&scope.account],
        )
        .await
        .unwrap()
        .get(0);
    assert!(!stored.contains("PRIVATE_INGRESS_DO_NOT_STORE"));
    let _environment = file.environment();
    let path = std::env::var("ATOAXIS_TEAM_FINANCIAL_GUARD_PATH").unwrap();
    assert!(!std::fs::read_to_string(&path)
        .unwrap()
        .contains("PRIVATE_INGRESS_DO_NOT_STORE"));
    let cli = std::process::Command::new(std::env::var("TEAM_FINANCIAL_GUARD_TEST_BIN").unwrap())
        .args([
            "inspect-ingress",
            &path,
            "--namespace",
            &guard.namespace().unwrap().to_string(),
            "--account",
            &scope.account,
        ])
        .env("POSTGRES_URL", std::env::var("POSTGRES_TEST_URL").unwrap())
        .output()
        .unwrap();
    assert!(cli.status.success());
    let safe: serde_json::Value = serde_json::from_slice(&cli.stdout).unwrap();
    assert_eq!(safe["status"], "ingress_verified_only");
    assert_eq!(safe["receipts"], 4);
    assert_eq!(safe["financial_sources"], "unconfirmed");
    let text = String::from_utf8(cli.stdout).unwrap();
    for denied in ["cus_ingress", "sub_ingress", "evt_ingress", &scope.account] {
        assert!(!text.contains(denied));
    }
    // Same signed ID with changed raw body must freeze, never overwrite a receipt.
    let mut changed: serde_json::Value = serde_json::from_slice(&first).unwrap();
    changed["data"]["object"]["description"] = serde_json::json!("different body");
    let changed = serde_json::to_vec(&changed).unwrap();
    assert!(receiver
        .accept(&changed, &signature(&changed, now), now)
        .await
        .is_err());
    let frozen = independent(guard, &scope).unwrap();
    assert_eq!(frozen.receipts.len(), 4);
    assert_eq!(frozen.conflicts.len(), 1);
    assert!(receiver.accept(&first, &signed, now).await.is_err());
    // No entitlement was created from any of these accepted notifications.
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_analytics_entitlements WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .is_none());
}
