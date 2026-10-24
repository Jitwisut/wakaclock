use super::*;
use crate::{
    config::PostgresConfig,
    services::team_financial_source::{Event, Outcome},
};
use chrono::Utc;
use std::{path::PathBuf, sync::Arc};

#[test]
fn source_inventory_json_requires_exact_contract_and_consistent_frozen_request() {
    use crate::services::team_stripe_checkout::CheckoutPolicy;
    let operation = Uuid::now_v7();
    let expected = ExpectedSession {
        operation,
        customer: "cus_inventory",
        price: "price_inventory",
        currency: "usd",
        amount_minor: 100,
        live: false,
    };
    let policy=CheckoutPolicy::parse(br#"{"schema_version":1,"owner_approved":true,"return_origin":"https://fixture.invalid","automatic_tax":false}"#).unwrap();
    let request = FrozenRequest::new(&expected, &policy).unwrap();
    let mut row = json!({"operation_id":operation,"livemode":false,"request_metadata":request,"request_sha256":request.digest().unwrap(),"expected_request":{"customer":"cus_inventory","price":"price_inventory","currency":"usd","amount_minor":100}});
    let original = row.clone();
    normalize("checkout", &mut row).unwrap();
    assert!(row.get("expected_request").is_none());
    let mut wrong = original.clone();
    wrong["request_metadata"]["automatic_tax"] = json!(true);
    assert!(normalize("checkout", &mut wrong).is_err());
    let mut missing = original.clone();
    missing["expected_request"] = Value::Null;
    assert!(normalize("checkout", &mut missing).is_err());
    let mut unknown = original;
    unknown["request_metadata"]["prompt"] = json!("PRIVATE_INVENTORY_MARKER");
    let err = normalize("checkout", &mut unknown).unwrap_err().to_string();
    assert!(!err.contains("PRIVATE_INVENTORY_MARKER"));
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL and built operator CLI"]
async fn financial_source_inventory_consistent_historical_scope_and_loss_detection() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url.clone()),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    let other = Uuid::now_v7();
    let actor = Uuid::now_v7();
    for id in [org, other] {
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'inventory fixture')",
            &[&id, &id.to_string()],
        )
        .await
        .unwrap();
    }
    let scope = Scope {
        organization: org,
        account: format!("acct_inventory{}", org.simple()),
        live: false,
    };
    let namespace = Uuid::now_v7();
    let directory = PathBuf::from(std::env::var("TEAM_FINANCIAL_INVENTORY_TEST_DIR").unwrap());
    std::fs::create_dir(&directory).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let guard = FinancialGuard::new(directory.join("guard.jsonl"))
        .unwrap()
        .pin_namespace(namespace)
        .unwrap();
    guard.initialize(namespace, vec![org, other]).unwrap();
    let empty = preview(&pg, &guard, &scope).await.unwrap();
    assert_eq!(empty.digest.records, 0);
    assert!(empty.checkpoint.is_none());
    assert_eq!(empty.digest.hash, Root::empty(&scope).unwrap().hash);
    assert_eq!(empty.diagnostic()["account_ingress_proof"], "unconfirmed");
    // A read of empty SQL must not create a checkpoint or independent seed.
    assert!(guard.read().unwrap().snapshot.sources.scopes.is_empty());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_financial_source_heads WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );

    let operation = Uuid::now_v7();
    let quote = Uuid::now_v7();
    let checkout = Uuid::now_v7();
    pg.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode,disposition,customer_id) VALUES($1,$2,$3,$4,false,'verified','cus_inventory')",&[&operation,&org,&actor,&scope.account]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_customer_authorizations(operation_id,revision,actor_id,action) VALUES($1,1,$2,'reconcile_existing_customer')",&[&operation,&actor]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_quotes(id,organization_id,actor_id,account_id,livemode,customer_operation,customer_revision,customer_id,package_seats,price_id,product_id,currency,amount_minor,tax_behavior,catalog_revision,catalog_sha256,observed_at,expires_at) VALUES($1,$2,$3,$4,false,$5,1,'cus_inventory',10,'price_inventory','prod_inventory','usd',100,'unspecified','fixture',$6,now(),now()+interval '5 minutes')",&[&quote,&org,&actor,&scope.account,&operation,&"a".repeat(64)]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_checkout_intents(operation_id,organization_id,actor_id,quote_id,account_id,livemode,disposition,session_id,subscription_id) VALUES($1,$2,$3,$4,$5,false,'bound','cs_inventory','sub_inventory')",&[&checkout,&org,&actor,&quote,&scope.account]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_checkout_authorizations(operation_id,revision,actor_id,action) VALUES($1,1,$2,'reconcile_existing_checkout')",&[&checkout,&actor]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,'cus_inventory','sub_inventory',false)",&[&org,&scope.account]).await.unwrap();
    let (_, invoice, _) = crate::services::team_stripe_payment::tests::fixture(Utc::now());
    let invoice = serde_json::to_value(invoice).unwrap();
    pg.execute("INSERT INTO team_stripe_snapshots(organization_id,binding_revision,source_revision,provider_status,cancel_at_period_end,items_complete,observed_at,invoice_observation) VALUES($1,1,1,'active',false,true,now(),$2)",&[&org,&invoice]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_inbox(account_id,livemode,event_id,payload_hash,event_kind,event_created,customer_id,subscription_id,disposition) VALUES($1,false,'evt_inventory',$2,'invoice.payment_succeeded',now(),'cus_inventory','sub_inventory','pending')",&[&scope.account,&"a".repeat(64)]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,false,'sub_inventory')",&[&scope.account]).await.unwrap();
    let baseline = preview(&pg, &guard, &scope).await.unwrap();
    assert_eq!(baseline.digest.records, 9);
    assert_eq!(baseline.counts.len(), 9);
    assert!(!baseline.identity_conflict);
    assert!(!baseline.account_unbound_records);
    assert!(baseline.checkpoint.is_none());
    assert!(!baseline.independent_source_matches);
    // Retry/lease/error scheduling must not alter semantic financial roots.
    for table in [
        "team_stripe_customer_operations",
        "team_stripe_checkout_intents",
        "team_stripe_reconcile_jobs",
    ] {
        pg.execute(&format!("UPDATE {table} SET attempts=attempts+1,retry_at=now()+interval '1 hour',lease_id=$1,lease_until=now()+interval '1 minute',last_error_code='network',last_http_status=503 WHERE account_id=$2"),&[&Uuid::now_v7(),&scope.account]).await.unwrap();
    }
    assert_eq!(
        preview(&pg, &guard, &scope).await.unwrap().digest,
        baseline.digest
    );
    // Same timestamp represented with a different offset is the same fact.
    let mut offset = invoice.clone();
    let at =
        chrono::DateTime::parse_from_rfc3339(invoice["observed_at"].as_str().unwrap()).unwrap();
    offset["observed_at"] = json!(at
        .with_timezone(&chrono::FixedOffset::east_opt(25200).unwrap())
        .to_rfc3339());
    pg.execute(
        "UPDATE team_stripe_snapshots SET invoice_observation=$2 WHERE organization_id=$1",
        &[&org, &offset],
    )
    .await
    .unwrap();
    assert_eq!(
        preview(&pg, &guard, &scope).await.unwrap().digest,
        baseline.digest
    );
    // A restored checkpoint may match SQL but cannot manufacture independent proof.
    pg.execute("INSERT INTO team_financial_source_heads(organization_id,account_id,livemode,schema_version,revision,record_count,root_hash,updated_at) VALUES($1,$2,false,1,1,$3,$4,now())",&[&org,&scope.account,&(baseline.digest.records as i64),&baseline.digest.hash]).await.unwrap();
    let matched = preview(&pg, &guard, &scope).await.unwrap();
    assert!(matched.checkpoint_matches);
    assert!(!matched.independent_source_matches);
    let cli = PathBuf::from(std::env::var("TEAM_FINANCIAL_GUARD_TEST_BIN").unwrap());
    let result = std::process::Command::new(cli)
        .arg("inspect-inventory")
        .arg(directory.join("guard.jsonl"))
        .args([
            "--namespace",
            &namespace.to_string(),
            "--organization",
            &org.to_string(),
            "--account",
            &scope.account,
        ])
        .env("POSTGRES_URL", &url)
        .output()
        .unwrap();
    assert!(result.status.success(), "operator preview failed");
    let output: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(output["checkpoint"], "matches_sql_observation");
    assert_eq!(output["product_authorization_enabled"], false);
    let text = String::from_utf8(result.stdout).unwrap();
    for denied in [
        "cus_inventory",
        "sub_inventory",
        "cs_inventory",
        "in_payment",
        &baseline.digest.hash,
    ] {
        assert!(!text.contains(denied));
    }
    // Each semantic family changes the root, including accepted-request controls.
    let mutations=[
        "UPDATE team_stripe_customer_operations SET first_attempt_at=now() WHERE organization_id=$1",
        "UPDATE team_stripe_customer_operations SET lookup_only=true WHERE organization_id=$1",
        "UPDATE team_stripe_customer_authorizations SET actor_id=$2 WHERE operation_id IN(SELECT operation_id FROM team_stripe_customer_operations WHERE organization_id=$1)",
        "UPDATE team_stripe_quotes SET amount_minor=101 WHERE organization_id=$1",
        "UPDATE team_stripe_checkout_intents SET recovery_actor=$2 WHERE organization_id=$1",
        "UPDATE team_stripe_checkout_intents SET disposition='recovery_required' WHERE organization_id=$1",
        "UPDATE team_stripe_checkout_authorizations SET actor_id=$2 WHERE operation_id IN(SELECT operation_id FROM team_stripe_checkout_intents WHERE organization_id=$1)",
        "UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",
        "UPDATE team_stripe_snapshots SET first_payment_failure_at=now() WHERE organization_id=$1",
        "UPDATE team_stripe_snapshots SET observed_at=observed_at+interval '1 microsecond' WHERE organization_id=$1",
        "UPDATE team_stripe_inbox SET disposition='processed' WHERE account_id=(SELECT account_id FROM team_stripe_bindings WHERE organization_id=$1)",
        "UPDATE team_stripe_reconcile_jobs SET requested_revision=2 WHERE account_id=(SELECT account_id FROM team_stripe_bindings WHERE organization_id=$1)",
    ];
    let mut previous = baseline.digest;
    for sql in mutations {
        let db = pg.transaction_client().await.unwrap();
        if sql.contains("$2") {
            db.execute(sql, &[&org, &Uuid::now_v7()]).await.unwrap();
        } else {
            db.execute(sql, &[&org]).await.unwrap();
        }
        let current = preview(&pg, &guard, &scope).await.unwrap();
        assert_ne!(current.digest, previous, "{sql}");
        assert!(!current.checkpoint_matches);
        previous = current.digest;
    }
    // Unknown JSON cannot be silently dropped or leak content through errors.
    offset["prompt"] = json!("PRIVATE_INVENTORY_MARKER");
    pg.execute(
        "UPDATE team_stripe_snapshots SET invoice_observation=$2 WHERE organization_id=$1",
        &[&org, &offset],
    )
    .await
    .unwrap();
    let err = preview(&pg, &guard, &scope)
        .await
        .err()
        .unwrap()
        .to_string();
    assert_eq!(err, "financial_inventory_json_contract_unsupported");
    assert!(!err.contains("PRIVATE_INVENTORY_MARKER"));
    pg.execute(
        "UPDATE team_stripe_snapshots SET invoice_observation=$2 WHERE organization_id=$1",
        &[&org, &invoice],
    )
    .await
    .unwrap();
    // The entire SQL root must observe one MVCC snapshot, including writers
    // that do not take an organization billing lock. Two committed states only;
    // never a customer from one state and binding from the other.
    let first = preview(&pg, &guard, &scope).await.unwrap().digest;
    let mut db = pg.transaction_client().await.unwrap();
    let tx = db.transaction().await.unwrap();
    tx.execute(
        "UPDATE team_stripe_customer_operations SET revision=2 WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    tx.execute(
        "UPDATE team_stripe_bindings SET revision=2 WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    drop(db);
    let second = preview(&pg, &guard, &scope).await.unwrap().digest;
    assert_ne!(first, second);
    let writer_pg = pg.clone();
    let writer = tokio::spawn(async move {
        for n in 0..20_i64 {
            let revision = 1 + n % 2;
            let mut db = writer_pg.transaction_client().await.unwrap();
            let tx = db.transaction().await.unwrap();
            tx.execute(
                "UPDATE team_stripe_customer_operations SET revision=$2 WHERE organization_id=$1",
                &[&org, &revision],
            )
            .await
            .unwrap();
            tx.query_one("SELECT pg_sleep(0.002)", &[]).await.unwrap();
            tx.execute(
                "UPDATE team_stripe_bindings SET revision=$2 WHERE organization_id=$1",
                &[&org, &revision],
            )
            .await
            .unwrap();
            tx.commit().await.unwrap();
        }
    });
    for _ in 0..25 {
        let at = preview(&pg, &guard, &scope).await.unwrap().digest;
        assert!(
            at == first || at == second,
            "inventory mixed two SQL snapshots"
        );
    }
    writer.await.unwrap();
    // Unknown schema is not auto-accepted after a deployment adds a new field.
    pg.execute(
        "ALTER TABLE team_stripe_quotes ADD COLUMN fixture_unclassified text",
        &[],
    )
    .await
    .unwrap();
    let failed = preview(&pg, &guard, &scope)
        .await
        .err()
        .unwrap()
        .to_string();
    pg.execute(
        "ALTER TABLE team_stripe_quotes DROP COLUMN fixture_unclassified",
        &[],
    )
    .await
    .unwrap();
    assert_eq!(failed, "financial_inventory_schema_unclassified");
    // Disabled binding was included; removing it must not remove historical inbox/jobs.
    pg.execute(
        "DELETE FROM team_stripe_bindings WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    let historical = preview(&pg, &guard, &scope).await.unwrap();
    assert_eq!(historical.counts["inbox"], 1);
    assert_eq!(historical.counts["reconciliation"], 1);
    assert!(!historical.checkpoint_matches);
    // Customer and subscription pointing at different organizations is a conflict.
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,false,'cus_other','sub_other')",&[&other,&scope.account]).await.unwrap();
    pg.execute(
        "UPDATE team_stripe_inbox SET subscription_id='sub_other' WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    assert!(
        preview(&pg, &guard, &scope)
            .await
            .unwrap()
            .identity_conflict
    );
    pg.execute(
        "UPDATE team_stripe_inbox SET subscription_id='sub_inventory' WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_stripe_inbox(account_id,livemode,event_id,payload_hash,event_kind,event_created,customer_id,disposition) VALUES($1,false,'evt_unknown',$2,'invoice.created',now(),'cus_unknown','ignored')",&[&scope.account,&"b".repeat(64)]).await.unwrap();
    let unknown = preview(&pg, &guard, &scope).await.unwrap();
    assert!(unknown.account_unbound_records);
    assert_eq!(unknown.counts["inbox"], 1);
    // Late independent outcome recovers association even without SQL customer rows.
    guard
        .record_source(Event::Outcome {
            scope: scope.clone(),
            outcome: Outcome {
                id: Uuid::now_v7(),
                operation: Uuid::now_v7(),
                request_hash: "c".repeat(64),
                evidence_hash: "d".repeat(64),
                observed_at: Utc::now(),
                identity: Some(ProviderIdentity::Customer {
                    customer: "cus_unknown".into(),
                }),
            },
        })
        .unwrap();
    let outcome = preview(&pg, &guard, &scope).await.unwrap();
    assert!(!outcome.account_unbound_records);
    assert_eq!(outcome.counts["inbox"], 2);
    assert!(!outcome.independent_source_matches);
    // Tombstones survive deletion and retain the subscription association.
    pg.execute("INSERT INTO team_financial_source_tombstones(organization_id,account_id,livemode,record_kind,record_key_hash,prior_record_hash,customer_id,subscription_id,reason,recorded_at) VALUES($1,$2,false,'binding',$3,$4,'cus_inventory','sub_inventory','organization_deleted',now())",&[&org,&scope.account,&"e".repeat(64),&"f".repeat(64)]).await.unwrap();
    pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
        .await
        .unwrap();
    let deleted = preview(&pg, &guard, &scope).await.unwrap();
    assert_eq!(deleted.counts["deletion_marker"], 1);
    assert_eq!(deleted.counts["inbox"], 2);
    assert_eq!(deleted.counts["reconciliation"], 1);
    assert!(deleted.checkpoint.is_none());
    // Explicit count-limit failure. No digest of a truncated account.
    pg.execute("INSERT INTO team_stripe_inbox(account_id,livemode,event_id,payload_hash,event_kind,event_created,customer_id,disposition) SELECT $1,false,'evt_limit_'||n,$2,'invoice.created',now(),'cus_inventory','ignored' FROM generate_series(1,50001)n",&[&scope.account,&"a".repeat(64)]).await.unwrap();
    assert_eq!(
        preview(&pg, &guard, &scope)
            .await
            .err()
            .unwrap()
            .to_string(),
        "financial_inventory_limit"
    );
    pg.execute(
        "DELETE FROM team_stripe_inbox WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    pg.execute(
        "DELETE FROM team_stripe_reconcile_jobs WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    pg.execute(
        "DELETE FROM team_financial_source_tombstones WHERE account_id=$1",
        &[&scope.account],
    )
    .await
    .unwrap();
    pg.execute("DELETE FROM organizations WHERE id=$1", &[&other])
        .await
        .unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}
