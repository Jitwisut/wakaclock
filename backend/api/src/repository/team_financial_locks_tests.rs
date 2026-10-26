use super::*;
use crate::{
    config::PostgresConfig,
    infrastructure::{postgres::PostgresClient, stripe::ProviderError},
    repository::{
        team_stripe::{Failure, TeamStripeRepository},
        team_stripe_checkout::CheckoutRepository,
        team_stripe_customer::{CustomerClaim, CustomerRepository},
        team_stripe_quote::QuoteRepository,
    },
    services::{
        team_stripe_catalog::Catalog,
        team_stripe_checkout::{CheckoutPolicy, SessionEvidence},
    },
};
use chrono::Utc;
use serde_json::json;
use std::sync::Arc;
use tokio::time::{timeout, Duration};

async fn blocked_query(pg: &PostgresClient, pattern: &str) {
    timeout(Duration::from_secs(5),async {
        loop {
            if pg.query_one("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1)",&[&pattern]).await.unwrap().get::<_,bool>(0) {break;}
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }).await.expect("worker never reached expected DB lock wait");
}
async fn reset_customer(pg: &PostgresClient, op: Uuid) {
    pg.execute("UPDATE team_stripe_customer_operations SET disposition='pending',first_attempt_at=NULL,lease_id=NULL,lease_until=NULL,retry_at=clock_timestamp(),last_error_code=NULL,customer_id=NULL,lookup_only=false WHERE operation_id=$1",&[&op]).await.unwrap();
}
fn wrong_customer(c: &CustomerClaim) -> CustomerClaim {
    CustomerClaim {
        operation_id: c.operation_id,
        organization_id: c.organization_id,
        actor: c.actor,
        lease_id: c.lease_id,
        account_id: "acct_wrong_lock_scope".into(),
        livemode: c.livemode,
        revision: c.revision,
        lookup_only: c.lookup_only,
        customer_id: c.customer_id.clone(),
        financial: None,
    }
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_semantic_lock_order_owner_wait_and_fresh_leases() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 12,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    let owner = Uuid::now_v7();
    let account = format!("acct_locks{}", org.simple());
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Financial lock fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&owner, &owner.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
        &[&org, &owner],
    )
    .await
    .unwrap();
    let repo = Arc::new(CustomerRepository::new(pg.clone()));
    let op = repo
        .request(owner, org, &account, false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    // The worker must wait for owner authorization without holding the operation
    // row. This was the opposite order from request/recovery before normalization.
    pg.execute("UPDATE team_stripe_customer_operations SET first_attempt_at=clock_timestamp()-interval '23 hours'+interval '500 milliseconds' WHERE operation_id=$1",&[&op]).await.unwrap();
    let mut db = pg.transaction_client().await.unwrap();
    let held = db.transaction().await.unwrap();
    held.query_one("SELECT id FROM users WHERE id=$1 FOR UPDATE", &[&owner])
        .await
        .unwrap();
    let cloned = repo.clone();
    let a = account.clone();
    let task = tokio::spawn(async move { cloned.claim(&a, false).await });
    blocked_query(&pg, "SELECT m.role FROM organization_members%FOR SHARE%").await;
    let mut probe = pg.transaction_client().await.unwrap();
    let check = probe.transaction().await.unwrap();
    check.query_one("SELECT operation_id FROM team_stripe_customer_operations WHERE operation_id=$1 FOR UPDATE NOWAIT",&[&op]).await.unwrap();
    check.commit().await.unwrap();
    tokio::time::sleep(Duration::from_millis(700)).await;
    held.commit().await.unwrap();
    assert!(timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap()
        .is_none());
    let stopped=pg.query_one("SELECT disposition,last_error_code FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
    assert_eq!(stopped.get::<_, String>(0), "recovery_required");
    assert_eq!(
        stopped.get::<_, String>(1),
        "idempotency_window_unconfirmed"
    );
    // Lease starts after a billing lock wait, not at transaction start.
    reset_customer(&pg, op).await;
    let held = db.transaction().await.unwrap();
    super::super::team_seats::lock(&held, org).await.unwrap();
    let cloned = repo.clone();
    let a = account.clone();
    let task = tokio::spawn(async move { cloned.claim(&a, false).await });
    blocked_query(&pg, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))").await;
    tokio::time::sleep(Duration::from_millis(800)).await;
    held.commit().await.unwrap();
    let claim = Arc::new(
        timeout(Duration::from_secs(5), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap()
            .unwrap(),
    );
    let remaining:f64=pg.query_one("SELECT extract(epoch FROM lease_until-clock_timestamp())::double precision FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap().get(0);
    assert!(
        remaining > 179.6,
        "new customer lease was aged by a prior lock wait"
    );
    // Completion after lease expiry during an owner wait cannot make a usable
    // customer. Stale observations remain a separate future outcome-ledger gate.
    pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()+interval '300 milliseconds' WHERE operation_id=$1",&[&op]).await.unwrap();
    let held = db.transaction().await.unwrap();
    held.query_one("SELECT id FROM users WHERE id=$1 FOR UPDATE", &[&owner])
        .await
        .unwrap();
    let cloned = repo.clone();
    let c = claim.clone();
    let task = tokio::spawn(async move { cloned.complete(&c, "cus_locks").await });
    blocked_query(&pg, "SELECT m.role FROM organization_members%FOR SHARE%").await;
    tokio::time::sleep(Duration::from_millis(500)).await;
    held.commit().await.unwrap();
    assert!(!timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap());
    assert!(pg
        .query_one(
            "SELECT customer_id IS NULL FROM team_stripe_customer_operations WHERE operation_id=$1",
            &[&op]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    // Expiry after the semantic UPDATE (not merely before it) must roll back.
    reset_customer(&pg, op).await;
    let late = repo.claim(&account, false).await.unwrap().unwrap();
    pg.execute("CREATE FUNCTION fixture_customer_late_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.35); RETURN NEW; END $$",&[]).await.unwrap();
    pg.execute("CREATE TRIGGER fixture_customer_late_write AFTER UPDATE ON team_stripe_customer_operations FOR EACH ROW WHEN (NEW.disposition='verified') EXECUTE FUNCTION fixture_customer_late_write()",&[]).await.unwrap();
    pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()+interval '200 milliseconds' WHERE operation_id=$1",&[&op]).await.unwrap();
    let began = tokio::time::Instant::now();
    assert!(!repo.complete(&late, "cus_locks").await.unwrap());
    assert!(
        began.elapsed() >= Duration::from_millis(300),
        "fixture must exercise post-write expiry"
    );
    assert!(pg
        .query_one(
            "SELECT customer_id IS NULL FROM team_stripe_customer_operations WHERE operation_id=$1",
            &[&op]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    pg.execute(
        "DROP TRIGGER fixture_customer_late_write ON team_stripe_customer_operations",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_customer_late_write()", &[])
        .await
        .unwrap();
    reset_customer(&pg, op).await;
    let claim = repo.claim(&account, false).await.unwrap().unwrap();
    let bad = wrong_customer(&claim);
    repo.unresolved(&bad, "customer_deleted").await.unwrap();
    repo.fail(
        &bad,
        &ProviderError {
            kind: Failure::RateLimited,
            status: Some(429),
            retry_after: None,
        },
    )
    .await
    .unwrap();
    let row=pg.query_one("SELECT revision,disposition,lease_id,last_error_code FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), claim.revision);
    assert_eq!(row.get::<_, String>(1), "pending");
    assert_eq!(row.get::<_, Option<Uuid>>(2), Some(claim.lease_id));
    assert_eq!(row.get::<_, Option<String>>(3), None);
    assert!(repo.complete(&claim, "cus_locks").await.unwrap());
    // Create a real frozen local intent through repository APIs, no provider call.
    let quotes = QuoteRepository::new(pg.clone());
    let proof = quotes.customer(owner, org, &account, false).await.unwrap();
    let config = json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":account,"livemode":false,"currency":"usd","packages":([10,25,50,100].map(|n|json!({"seats":n,"price_id":format!("price_lock{n}"),"product_id":"prod_lock","amount_minor":2500,"tax_behavior":"exclusive"})))});
    let catalog = Catalog::parse(&serde_json::to_vec(&config).unwrap(), &account, false).unwrap();
    let price = json!({"object":"price","id":"price_lock10","livemode":false,"active":true,"currency":"usd","unit_amount":2500,"tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"object":"product","id":"prod_lock","active":true,"livemode":false}});
    let offer = catalog.verify(10, &price, Utc::now()).unwrap();
    let quote = Uuid::now_v7();
    quotes.save(quote, &proof, &offer).await.unwrap();
    let checkout = Arc::new(CheckoutRepository::new(pg.clone()));
    let policy=CheckoutPolicy::parse(br#"{"schema_version":1,"owner_approved":true,"return_origin":"https://fixture.invalid","automatic_tax":false}"#).unwrap();
    let digest = catalog.digest().unwrap();
    let intent = checkout
        .request(&proof, quote, &digest, true, &policy)
        .await
        .unwrap();
    let held = db.transaction().await.unwrap();
    super::super::team_seats::lock(&held, org).await.unwrap();
    let cloned = checkout.clone();
    let a = account.clone();
    let h = digest.clone();
    let task = tokio::spawn(async move { cloned.claim(&a, false, &h).await });
    blocked_query(&pg, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))").await;
    tokio::time::sleep(Duration::from_millis(800)).await;
    held.commit().await.unwrap();
    let checkout_claim = Arc::new(
        timeout(Duration::from_secs(5), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap()
            .unwrap(),
    );
    let remaining:f64=pg.query_one("SELECT extract(epoch FROM lease_until-clock_timestamp())::double precision FROM team_stripe_checkout_intents WHERE operation_id=$1",&[&intent.operation_id]).await.unwrap().get(0);
    assert!(
        remaining > 179.6,
        "new checkout lease was aged by a prior lock wait"
    );
    let provider = json!({"object":"checkout.session","id":"cs_test_lock","mode":"subscription","livemode":false,"customer":"cus_locks","client_reference_id":intent.operation_id,"metadata":{"atoaxis_checkout_operation":intent.operation_id},"status":"open","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":(Utc::now()+chrono::Duration::hours(1)).timestamp(),"subscription":null,"line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_lock10","currency":"usd","unit_amount":2500}}]}});
    let evidence =
        SessionEvidence::parse(&provider, &checkout_claim.expected(), Utc::now()).unwrap();
    pg.execute("UPDATE team_stripe_checkout_intents SET lease_until=clock_timestamp()+interval '300 milliseconds' WHERE operation_id=$1",&[&intent.operation_id]).await.unwrap();
    let held = db.transaction().await.unwrap();
    held.query_one("SELECT id FROM users WHERE id=$1 FOR UPDATE", &[&owner])
        .await
        .unwrap();
    let cloned = checkout.clone();
    let c = checkout_claim.clone();
    let task = tokio::spawn(async move { cloned.receive(&c, &evidence).await });
    blocked_query(&pg, "SELECT m.role FROM organization_members%FOR SHARE%").await;
    tokio::time::sleep(Duration::from_millis(500)).await;
    held.commit().await.unwrap();
    assert!(!timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap());
    let row = pg
        .query_one(
            "SELECT session_id,revision FROM team_stripe_checkout_intents WHERE operation_id=$1",
            &[&intent.operation_id],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, Option<String>>(0), None);
    assert_eq!(row.get::<_, i64>(1), checkout_claim.revision);
    // Checkout must also reject a lease that expires during the write itself.
    pg.execute("UPDATE team_stripe_checkout_intents SET lease_until=clock_timestamp()-interval '1 second',retry_at=clock_timestamp() WHERE operation_id=$1",&[&intent.operation_id]).await.unwrap();
    let late = checkout
        .claim(&account, false, &digest)
        .await
        .unwrap()
        .unwrap();
    let evidence = SessionEvidence::parse(&provider, &late.expected(), Utc::now()).unwrap();
    pg.execute("CREATE FUNCTION fixture_checkout_late_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.35); RETURN NEW; END $$",&[]).await.unwrap();
    pg.execute("CREATE TRIGGER fixture_checkout_late_write AFTER UPDATE ON team_stripe_checkout_intents FOR EACH ROW WHEN (NEW.session_id IS NOT NULL) EXECUTE FUNCTION fixture_checkout_late_write()",&[]).await.unwrap();
    pg.execute("UPDATE team_stripe_checkout_intents SET lease_until=clock_timestamp()+interval '200 milliseconds' WHERE operation_id=$1",&[&intent.operation_id]).await.unwrap();
    let began = tokio::time::Instant::now();
    assert!(!checkout.receive(&late, &evidence).await.unwrap());
    assert!(
        began.elapsed() >= Duration::from_millis(300),
        "fixture must exercise post-write expiry"
    );
    let row = pg
        .query_one(
            "SELECT session_id,revision FROM team_stripe_checkout_intents WHERE operation_id=$1",
            &[&intent.operation_id],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, Option<String>>(0), None);
    assert_eq!(row.get::<_, i64>(1), late.revision);
    pg.execute(
        "DROP TRIGGER fixture_checkout_late_write ON team_stripe_checkout_intents",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_checkout_late_write()", &[])
        .await
        .unwrap();
    // Reconciliation also obtains billing before the authoritative job row.
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,false,'cus_locks','sub_locks')",&[&org,&account]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,false,'sub_locks')",&[&account]).await.unwrap();
    let held = db.transaction().await.unwrap();
    super::super::team_seats::lock(&held, org).await.unwrap();
    let cloned = TeamStripeRepository::new(pg.clone());
    let a = account.clone();
    let task = tokio::spawn(async move { cloned.claim(&a, false).await });
    blocked_query(&pg, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))").await;
    let check = probe.transaction().await.unwrap();
    check.query_one("SELECT subscription_id FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND subscription_id='sub_locks' FOR UPDATE NOWAIT",&[&account]).await.unwrap();
    check.commit().await.unwrap();
    held.commit().await.unwrap();
    assert!(timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap()
        .is_some());
}
