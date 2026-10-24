//! Synthetic financial metadata on an explicitly isolated PostgreSQL instance.
use super::team_stripe::*;
use crate::{
    config::PostgresConfig,
    infrastructure::postgres::PostgresClient,
    services::team_stripe::{self, Ingress, Snapshot},
};
use chrono::{Duration, Utc};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

fn notification(id: &str, created: i64) -> Vec<u8> {
    serde_json::to_vec(&json!({"id":id,"created":created,"livemode":false,"type":"invoice.payment_failed","data":{"object":{"object":"invoice","id":"in_fixture","customer":"cus_fixture","subscription":"sub_fixture","description":"PRIVATE_FIXTURE_DO_NOT_STORE","customer_email":"PRIVATE_FIXTURE_DO_NOT_STORE"}}})).unwrap()
}
fn signature(body: &[u8], now: i64) -> String {
    let mut signed = format!("{now}.").into_bytes();
    signed.extend_from_slice(body);
    let mac = ring::hmac::sign(
        &ring::hmac::Key::new(ring::hmac::HMAC_SHA256, b"whsec_local_fixture"),
        &signed,
    );
    format!(
        "t={now},v1={}",
        mac.as_ref()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    )
}
fn observed() -> Snapshot {
    team_stripe::snapshot(&json!({"object":"subscription","id":"sub_fixture","customer":"cus_fixture","livemode":false,"status":"past_due","cancel_at_period_end":false,"latest_invoice":"in_fixture","items":{"has_more":false,"data":[{"quantity":1,"current_period_start":1,"current_period_end":2,"price":{"id":"price_fixture","currency":"usd","unit_amount":2500}}]}}),"sub_fixture","cus_fixture",false,Utc::now()).unwrap()
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn stripe_durable_ingress_lease_ordering_retry_and_scope() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    let config = url.parse::<tokio_postgres::Config>().unwrap();
    assert_eq!(config.get_dbname(), Some("atoaxis_stripe_test"));
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
    let repo = TeamStripeRepository::new(pg.clone());
    let ingress = Ingress::new(
        repo.clone(),
        "acct_fixture".into(),
        false,
        b"whsec_local_fixture".to_vec(),
    )
    .unwrap();
    // Exercise the actual BillingService boundary with the existing encrypted vault.
    use base64::{engine::general_purpose::STANDARD, Engine};
    let key = STANDARD.encode([9_u8; 32]);
    let vault = crate::infrastructure::secret_box::SecretBox::from_env_value(&key).unwrap();
    let credentials =
        std::path::PathBuf::from(std::env::var("STRIPE_TEST_CREDENTIALS_PATH").unwrap());
    std::fs::write(
        &credentials,
        vault
            .seal(
                b"stripe-webhook:acct_fixture:test",
                br#"{"webhook_secret":"whsec_local_fixture"}"#,
            )
            .unwrap(),
    )
    .unwrap();
    std::env::set_var("ATOAXIS_TEAM_STRIPE_ENABLED", "1");
    std::env::set_var("ATOAXIS_STRIPE_ACCOUNT_ID", "acct_fixture");
    std::env::set_var("ATOAXIS_STRIPE_MODE", "test");
    std::env::set_var("ATOAXIS_KMS_KEY_ID", key);
    std::env::set_var("ATOAXIS_STRIPE_WEBHOOK_CREDENTIALS_PATH", &credentials);
    let billing = crate::services::billing::BillingService::new(
        Some(pg.clone()),
        Arc::new(crate::services::authorization::AuthorizationService::new(
            Some(pg.clone()),
        )),
    );
    let now = Utc::now();
    let body = notification("evt_first", now.timestamp());
    assert!(ingress.accept(&body, "invalid", now).await.is_err());
    assert_eq!(
        ingress
            .accept(&body, &signature(&body, now.timestamp()), now)
            .await
            .unwrap(),
        Acceptance::Accepted
    );
    assert_eq!(
        billing
            .stripe_webhook(&body, &signature(&body, now.timestamp()))
            .await
            .unwrap(),
        Acceptance::Duplicate
    );
    std::env::set_var("ATOAXIS_TEAM_STRIPE_ENABLED", "0");
    assert!(matches!(
        billing
            .stripe_webhook(&body, &signature(&body, now.timestamp()))
            .await,
        Err(team_stripe::WebhookFailure::Disabled)
    ));
    std::env::set_var("ATOAXIS_TEAM_STRIPE_ENABLED", "1");
    std::env::set_var("ATOAXIS_STRIPE_MODE", "live");
    assert!(matches!(
        billing
            .stripe_webhook(&body, &signature(&body, now.timestamp()))
            .await,
        Err(team_stripe::WebhookFailure::Unavailable)
    ));
    std::env::set_var("ATOAXIS_STRIPE_MODE", "test");
    // Lost HTTP ACK/restart: stable signed retry does not create a second job revision.
    let restarted = Ingress::new(
        TeamStripeRepository::new(pg.clone()),
        "acct_fixture".into(),
        false,
        b"whsec_local_fixture".to_vec(),
    )
    .unwrap();
    assert_eq!(
        restarted
            .accept(&body, &signature(&body, now.timestamp()), now)
            .await
            .unwrap(),
        Acceptance::Duplicate
    );
    let conflict = notification("evt_first", now.timestamp() - 1);
    assert!(ingress
        .accept(&conflict, &signature(&conflict, now.timestamp()), now)
        .await
        .is_err());
    assert!(repo.claim("acct_fixture", false).await.unwrap().is_none()); // Unbound remains durable/parked.
    let org = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Stripe fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,'acct_fixture',false,'cus_fixture','sub_fixture')",&[&org]).await.unwrap();
    assert!(repo.claim("acct_other", false).await.unwrap().is_none());
    assert!(repo.claim("acct_fixture", true).await.unwrap().is_none());
    let (a, b) = tokio::join!(
        repo.claim("acct_fixture", false),
        repo.claim("acct_fixture", false)
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_eq!(usize::from(a.is_some()) + usize::from(b.is_some()), 1);
    let first = a.or(b).unwrap();
    assert_eq!(first.revision, 1);
    // A second webhook arrives while provider HTTP is in flight.
    let second = notification("evt_second", now.timestamp() - 600);
    ingress
        .accept(&second, &signature(&second, now.timestamp()), now)
        .await
        .unwrap();
    assert!(!repo.complete(&first, &observed()).await.unwrap());
    let next = repo.claim("acct_fixture", false).await.unwrap().unwrap();
    assert_eq!(next.revision, 2);
    // An expired worker must not complete/fail a replacement worker's lease.
    pg.execute("UPDATE team_stripe_reconcile_jobs SET lease_until=now()-interval '1 second' WHERE account_id='acct_fixture'",&[]).await.unwrap();
    let replacement = repo.claim("acct_fixture", false).await.unwrap().unwrap();
    assert!(!repo.complete(&next, &observed()).await.unwrap());
    assert!(!repo
        .fail(&next, Failure::Network, None, None)
        .await
        .unwrap());
    // The billing lock can outlive a lease. Transaction-start now() must not
    // authorize a completion that was already expired when the lock was acquired.
    let mut lock_db=pg.transaction_client().await.unwrap();
    let lock_tx=lock_db.transaction().await.unwrap();
    super::team_seats::lock(&lock_tx,org).await.unwrap();
    let waiting_repo=repo.clone(); let waiting_claim=replacement.clone();
    let waiting=tokio::spawn(async move {waiting_repo.complete(&waiting_claim,&observed()).await});
    let mut queued=false;
    for _ in 0..100 {
        let n:i64=pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'",&[]).await.unwrap().get(0);
        if n>0 {queued=true;break;}
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    assert!(queued,"completion must be waiting behind the billing lock");
    pg.execute("UPDATE team_stripe_reconcile_jobs SET lease_until=clock_timestamp() WHERE account_id='acct_fixture'",&[]).await.unwrap();
    lock_tx.commit().await.unwrap();
    assert!(!waiting.await.unwrap().unwrap());
    let replacement=repo.claim("acct_fixture",false).await.unwrap().unwrap();
    assert!(repo.complete(&replacement, &observed()).await.unwrap());
    assert_eq!(pg.query_one("SELECT count(*) FROM team_analytics_entitlements WHERE organization_id=$1",&[&org]).await.unwrap().get::<_,i64>(0),0); // Webhooks/readback cannot activate a trial.

    let row=pg.query_one("SELECT first_payment_failure_at,amount_minor FROM team_stripe_snapshots WHERE organization_id=$1",&[&org]).await.unwrap();
    let failure: chrono::DateTime<Utc> = row.get(0);
    assert_eq!(failure.timestamp(), now.timestamp() - 600);
    assert_eq!(row.get::<_, i64>(1), 2500);
    assert_eq!(repo.schedule_bound("acct_fixture", false).await.unwrap(), 0);
    pg.execute("UPDATE team_stripe_reconcile_jobs SET last_success_at=now()-interval '6 minutes' WHERE account_id='acct_fixture'",&[]).await.unwrap();
    assert_eq!(repo.schedule_bound("acct_fixture", false).await.unwrap(), 1);
    assert_eq!(repo.schedule_bound("acct_fixture", false).await.unwrap(), 0);
    let refresh = repo.claim("acct_fixture", false).await.unwrap().unwrap();
    // Binding revision changes while the request is outstanding; current snapshot cannot be overwritten.
    pg.execute(
        "UPDATE team_stripe_bindings SET revision=revision+1 WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    assert!(!repo.complete(&refresh, &observed()).await.unwrap());
    let retry = repo.claim("acct_fixture", false).await.unwrap().unwrap();
    let deadline = Utc::now() + Duration::hours(2);
    assert!(repo
        .fail(&retry, Failure::RateLimited, Some(429), Some(deadline))
        .await
        .unwrap());
    let third = notification("evt_third", now.timestamp());
    ingress
        .accept(&third, &signature(&third, now.timestamp()), now)
        .await
        .unwrap();
    let until: chrono::DateTime<Utc> = pg
        .query_one(
            "SELECT retry_at FROM team_stripe_reconcile_jobs WHERE account_id='acct_fixture'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert!(until >= deadline - Duration::microseconds(1));
    assert!(repo.claim("acct_fixture", false).await.unwrap().is_none());
    // A DB commit failure must not ACK or leave a partially accepted inbox event.
    pg.execute("ALTER TABLE team_stripe_reconcile_jobs ADD CONSTRAINT fixture_write_failure CHECK(requested_revision<0) NOT VALID",&[]).await.unwrap();
    let failed = notification("evt_db_failure", now.timestamp());
    assert!(ingress
        .accept(&failed, &signature(&failed, now.timestamp()), now)
        .await
        .is_err());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_inbox WHERE event_id='evt_db_failure'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    pg.execute(
        "ALTER TABLE team_stripe_reconcile_jobs DROP CONSTRAINT fixture_write_failure",
        &[],
    )
    .await
    .unwrap();
    assert_eq!(
        ingress
            .accept(&failed, &signature(&failed, now.timestamp()), now)
            .await
            .unwrap(),
        Acceptance::Accepted
    );
    let stored: String = pg
        .query_one("SELECT json_agg(t)::text FROM team_stripe_inbox t", &[])
        .await
        .unwrap()
        .get(0);
    assert!(!stored.contains("PRIVATE_FIXTURE") && !stored.contains("whsec_local_fixture"));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM subscriptions WHERE provider_subscription_id='sub_fixture'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    ); // No paid access from observations.
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL and loopback HTTP"]
async fn stripe_worker_current_readback_global_cooldown_and_recovery() {
    use crate::{infrastructure::stripe::StripeClient, services::team_stripe_worker::StripeWorker};
    use axum::{
        extract::{Path, State},
        http::StatusCode,
        response::IntoResponse,
        routing::get,
        Json, Router,
    };
    use std::sync::atomic::{AtomicUsize, Ordering};
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
    let org = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Worker fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,'acct_worker',false,'cus_worker','sub_worker')",&[&org]).await.unwrap();
    let mode = Arc::new(AtomicUsize::new(0));
    let requests = Arc::new(AtomicUsize::new(0));
    type Mock = (Arc<AtomicUsize>, Arc<AtomicUsize>);
    let app=Router::new().route("/v1/account",get(|State((_,calls)):State<Mock>|async move {calls.fetch_add(1,Ordering::SeqCst);Json(json!({"object":"account","id":"acct_worker"}))}))
        .route("/v1/subscriptions/:id",get(|State((mode,calls)):State<Mock>,Path(id):Path<String>|async move {
            calls.fetch_add(1,Ordering::SeqCst);
            match mode.load(Ordering::SeqCst) {
                1=>(StatusCode::TOO_MANY_REQUESTS,[("retry-after","120")],"PRIVATE_FIXTURE").into_response(),
                3=>(StatusCode::SERVICE_UNAVAILABLE,"PRIVATE_FIXTURE").into_response(),
                4=>(StatusCode::OK,"not-json PRIVATE_FIXTURE").into_response(),
                6=>(StatusCode::NOT_FOUND,"PRIVATE_FIXTURE").into_response(),
                7=>(StatusCode::UNAUTHORIZED,"PRIVATE_FIXTURE").into_response(),
                8=>(StatusCode::FORBIDDEN,"PRIVATE_FIXTURE").into_response(),
                _=>Json(json!({"id":id,"object":"subscription","customer":if mode.load(Ordering::SeqCst)==2 {"cus_other"} else {"cus_worker"},"status":"active","livemode":false,"cancel_at_period_end":false,"latest_invoice":"in_worker","items":{"has_more":false,"data":[{"id":"si_worker","quantity":1,"current_period_start":1,"current_period_end":2,"price":{"id":if mode.load(Ordering::SeqCst)==12 {"price_changed"} else {"price_worker"},"currency":"usd","unit_amount":100}}]},"description":"PRIVATE_FIXTURE"})).into_response(),
            }
        })).route("/v1/invoices/in_worker",get(|State((mode,calls)):State<Mock>|async move {
            calls.fetch_add(1,Ordering::SeqCst);
            if mode.load(Ordering::SeqCst)==10 {return (StatusCode::TOO_MANY_REQUESTS,[("retry-after","120")],"PRIVATE_FIXTURE").into_response();}
            if mode.load(Ordering::SeqCst)==11 {mode.store(12,Ordering::SeqCst);}
            Json(json!({"object":"invoice","id":"in_worker","livemode":false,"customer":if mode.load(Ordering::SeqCst)==9 {"cus_other"} else {"cus_worker"},"parent":{"subscription_details":{"subscription":"sub_worker"}},"status":"paid","currency":"usd","amount_due":100,"amount_paid":100,"amount_remaining":0,"status_transitions":{"paid_at":1},"lines":{"has_more":false,"data":[]},"description":"PRIVATE_FIXTURE"})).into_response()
        })).with_state((mode.clone(),requests.clone()));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    let repo = TeamStripeRepository::new(pg.clone());
    let worker = StripeWorker::new(repo.clone(), StripeClient::fixture(port, "acct_worker"));
    // With no webhook/activity, the current binding is reconciled automatically.
    assert_eq!(worker.tick().await.unwrap().applied, 1);
    assert!(worker.tick().await.unwrap().idle);
    pg.execute("UPDATE team_stripe_reconcile_jobs SET last_success_at=now()-interval '6 minutes' WHERE account_id='acct_worker'",&[]).await.unwrap();
    assert_eq!(worker.tick().await.unwrap().applied, 1);
    pg.execute("UPDATE team_stripe_reconcile_jobs SET last_success_at=now()-interval '6 minutes' WHERE account_id='acct_worker'",&[]).await.unwrap();
    mode.store(1, Ordering::SeqCst);
    assert_eq!(worker.tick().await.unwrap().deferred, 1);
    let row=pg.query_one("SELECT retry_at,last_error_code FROM team_stripe_runtime_status WHERE account_id='acct_worker'",&[]).await.unwrap();
    assert!(row.get::<_, chrono::DateTime<Utc>>(0) > Utc::now() + Duration::seconds(115));
    assert_eq!(row.get::<_, String>(1), "rate_limited");
    // A restarted worker reads the durable account cooldown before any HTTP request.
    let restarted = StripeWorker::new(repo.clone(), StripeClient::fixture(port, "acct_worker"));
    let before = requests.load(Ordering::SeqCst);
    assert!(restarted.tick().await.unwrap().idle);
    assert_eq!(before, requests.load(Ordering::SeqCst));
    // Simulate deadline expiry only in the isolated fixture. Production has no deadline-reset API.
    for (value, expected) in [
        (3, "provider_unavailable"),
        (7, "auth_required"),
        (8, "permission_required"),
        (2, "provider_scope_mismatch"),
        (4, "unsupported_contract"),
        (6, "subscription_unconfirmed"),
        (9, "unsupported_contract"),
        (10, "rate_limited"),
        (11, "observation_changed"),
    ] {
        pg.execute("UPDATE team_stripe_runtime_status SET retry_at=now()-interval '1 second' WHERE account_id='acct_worker'",&[]).await.unwrap();
        pg.execute("UPDATE team_stripe_reconcile_jobs SET retry_at=now()-interval '1 second' WHERE account_id='acct_worker'",&[]).await.unwrap();
        mode.store(value, Ordering::SeqCst);
        assert_eq!(restarted.tick().await.unwrap().deferred, 1);
        let error:String=pg.query_one("SELECT last_error_code FROM team_stripe_reconcile_jobs WHERE account_id='acct_worker'",&[]).await.unwrap().get(0);
        assert_eq!(error, expected);
        let source: i64 = pg
            .query_one(
                "SELECT source_revision FROM team_stripe_snapshots WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap()
            .get(0);
        assert_eq!(source, 2); // Failure/404 never overwrite a verified snapshot with cancellation.
    }
    pg.execute("UPDATE team_stripe_runtime_status SET retry_at=now()-interval '1 second' WHERE account_id='acct_worker'",&[]).await.unwrap();
    pg.execute("UPDATE team_stripe_reconcile_jobs SET retry_at=now()-interval '1 second' WHERE account_id='acct_worker'",&[]).await.unwrap();
    mode.store(0, Ordering::SeqCst);
    pg.execute("ALTER TABLE team_stripe_snapshots ADD CONSTRAINT fixture_invoice_write CHECK(invoice_observation IS NULL) NOT VALID",&[]).await.unwrap();
    assert!(restarted.tick().await.is_err());
    assert_eq!(
        pg.query_one(
            "SELECT source_revision FROM team_stripe_snapshots WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    pg.execute(
        "ALTER TABLE team_stripe_snapshots DROP CONSTRAINT fixture_invoice_write",
        &[],
    )
    .await
    .unwrap();
    pg.execute("UPDATE team_stripe_runtime_status SET lease_until=now()-interval '1 second' WHERE account_id='acct_worker'",&[]).await.unwrap();
    pg.execute("UPDATE team_stripe_reconcile_jobs SET lease_until=now()-interval '1 second' WHERE account_id='acct_worker'",&[]).await.unwrap();
    assert_eq!(restarted.tick().await.unwrap().applied, 1);
    let row=pg.query_one("SELECT requested_revision,applied_revision,last_error_code FROM team_stripe_reconcile_jobs WHERE account_id='acct_worker'",&[]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), row.get::<_, i64>(1));
    assert!(row.get::<_, Option<String>>(2).is_none());
    let stored: String = pg
        .query_one("SELECT json_agg(t)::text FROM team_stripe_snapshots t", &[])
        .await
        .unwrap()
        .get(0);
    assert!(!stored.contains("PRIVATE_FIXTURE") && !stored.contains("rk_test_synthetic"));
    let invoice: serde_json::Value = pg
        .query_one(
            "SELECT invoice_observation FROM team_stripe_snapshots WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(invoice["invoice_id"], "in_worker");
    assert_eq!(invoice["amount_paid_minor"], 100);
    assert!(!invoice.to_string().contains("PRIVATE_FIXTURE"));
    server.abort();
    let _ = server.await;
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn stripe_customer_durable_provisioning_scope_retry_and_revocation() {
    use crate::{
        infrastructure::stripe::StripeClient, repository::team_stripe_customer::CustomerRepository,
        services::team_stripe_worker::StripeWorker,
    };
    use axum::{
        extract::{Form, Query, State},
        http::HeaderMap,
        response::IntoResponse,
        routing::{get, post},
        Json, Router,
    };
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tokio::sync::Mutex;
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
    async fn tenant(pg: &PostgresClient) -> (Uuid, Uuid) {
        let org = Uuid::now_v7();
        let actor = Uuid::now_v7();
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Customer test')",
            &[&org, &org.to_string()],
        )
        .await
        .unwrap();
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&actor, &actor.to_string()],
        )
        .await
        .unwrap();
        pg.execute(
            "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
            &[&org, &actor],
        )
        .await
        .unwrap();
        (org, actor)
    }
    let (org, actor) = tenant(&pg).await;
    let repo = CustomerRepository::new(pg.clone());
    assert!(repo
        .request(Uuid::now_v7(), org, "acct_customer", false, true)
        .await
        .is_err());
    let (a, b) = tokio::join!(
        repo.request(actor, org, "acct_customer", false, true),
        repo.request(actor, org, "acct_customer", false, true)
    );
    let op = a.unwrap().unwrap().operation_id;
    assert_eq!(op, b.unwrap().unwrap().operation_id);
    assert!(repo.claim("acct_other", false).await.unwrap().is_none());
    assert!(repo.claim("acct_customer", true).await.unwrap().is_none());
    let (a, b) = tokio::join!(
        repo.claim("acct_customer", false),
        repo.claim("acct_customer", false)
    );
    let a = a.unwrap();
    let b = b.unwrap();
    assert_eq!(usize::from(a.is_some()) + usize::from(b.is_some()), 1);
    let claim = a.or(b).unwrap();
    pg.execute("UPDATE team_stripe_customer_operations SET lease_until=now()-interval '1 second' WHERE operation_id=$1",&[&op]).await.unwrap();
    assert!(!repo.complete(&claim, "cus_wrong").await.unwrap());
    #[derive(Clone)]
    struct Mock {
        pg: Arc<PostgresClient>,
        mode: Arc<AtomicUsize>,
        objects: Arc<Mutex<HashMap<String, String>>>,
        calls: Arc<AtomicUsize>,
    }
    let mock = Mock {
        pg: pg.clone(),
        mode: Arc::new(AtomicUsize::new(0)),
        objects: Arc::default(),
        calls: Arc::default(),
    };
    let app=Router::new().route("/v1/account",get(||async{Json(json!({"object":"account","id":"acct_customer"}))}))
        .route("/v1/customers",post(|State(s):State<Mock>,h:HeaderMap,Form(form):Form<HashMap<String,String>>|async move{
            assert_eq!(form.len(),1);let operation=form["metadata[atoaxis_operation]"].clone();let key=format!("atoaxis-customer-v1-{operation}");assert_eq!(h["idempotency-key"],key);assert_eq!(h["stripe-version"],crate::infrastructure::stripe::API_VERSION);
            s.calls.fetch_add(1,Ordering::SeqCst);
            if s.mode.load(Ordering::SeqCst)==2 {return (axum::http::StatusCode::TOO_MANY_REQUESTS,[("retry-after","120")],"PRIVATE_FIXTURE_DO_NOT_STORE").into_response();}
            let customer={let mut objects=s.objects.lock().await;objects.entry(key).or_insert_with(||format!("cus_{}",operation.replace('-',""))).clone()};
            if s.mode.load(Ordering::SeqCst)==1 {s.pg.execute("UPDATE organization_members SET role='member' WHERE organization_id=(SELECT organization_id FROM team_stripe_customer_operations WHERE operation_id=$1)",&[&Uuid::parse_str(&operation).unwrap()]).await.unwrap();}
            Json(json!({"object":"customer","id":customer,"livemode":false,"metadata":{"atoaxis_operation":operation},"email":"PRIVATE_FIXTURE_DO_NOT_STORE","address":{"line1":"PRIVATE_FIXTURE_DO_NOT_STORE"}})).into_response()
        }))
        .route("/v1/customers/search",get(|State(s):State<Mock>,Query(query):Query<HashMap<String,String>>|async move{
            assert_eq!(query["limit"],"2");
            let operation=query["query"].strip_prefix("metadata['atoaxis_operation']:'").unwrap().strip_suffix("'").unwrap();
            let objects=s.objects.lock().await;let mut data=vec![];
            if let Some(id)=objects.get(&format!("atoaxis-customer-v1-{operation}")) {data.push(json!({"id":id,"object":"customer","livemode":false,"metadata":{"atoaxis_operation":operation}}));}
            if s.mode.load(Ordering::SeqCst)==3 {data.push(json!({"id":"cus_ambiguous","object":"customer","livemode":false,"metadata":{"atoaxis_operation":operation}}));}
            Json(json!({"object":"search_result","has_more":false,"data":data}))
        }))
        .route("/v1/customers/:customer",get(|State(s):State<Mock>,axum::extract::Path(customer):axum::extract::Path<String>|async move{
            let objects=s.objects.lock().await;let key=objects.iter().find(|(_,id)|**id==customer).unwrap().0;
            Json(json!({"id":customer,"object":"customer","livemode":false,"metadata":{"atoaxis_operation":key.strip_prefix("atoaxis-customer-v1-").unwrap()},"email":"PRIVATE_FIXTURE_DO_NOT_STORE"}))
        })).with_state(mock.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let task = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    let worker = StripeWorker::new(
        TeamStripeRepository::new(pg.clone()),
        StripeClient::fixture(port, "acct_customer"),
    );
    // Provider creates the customer, but local receipt commit fails. Retry must reuse the key.
    pg.execute("ALTER TABLE team_stripe_customer_operations ADD CONSTRAINT fixture_reject_customer CHECK(customer_id IS NULL) NOT VALID",&[]).await.unwrap();
    assert!(worker.tick().await.is_err());
    assert_eq!(mock.objects.lock().await.len(), 1);
    pg.execute(
        "ALTER TABLE team_stripe_customer_operations DROP CONSTRAINT fixture_reject_customer",
        &[],
    )
    .await
    .unwrap();
    pg.execute("UPDATE team_stripe_customer_operations SET lease_until=now()-interval '1 second' WHERE operation_id=$1",&[&op]).await.unwrap();
    pg.execute("UPDATE team_stripe_runtime_status SET lease_until=now()-interval '1 second' WHERE account_id='acct_customer'",&[]).await.unwrap();
    assert_eq!(worker.tick().await.unwrap().applied, 1);
    assert_eq!(mock.objects.lock().await.len(), 1);
    assert_eq!(mock.calls.load(Ordering::SeqCst), 2);
    assert_eq!(
        repo.request(actor, org, "acct_customer", false, true)
            .await
            .unwrap()
            .unwrap()
            .disposition,
        "verified"
    );
    assert!(worker.tick().await.unwrap().idle);
    // Revocation after network dispatch parks the receipt; the observer cannot open paid access.
    let (org2, actor2) = tenant(&pg).await;
    let op2 = repo
        .request(actor2, org2, "acct_customer", false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    mock.mode.store(1, Ordering::SeqCst);
    assert_eq!(worker.tick().await.unwrap().deferred, 1);
    let row=pg.query_one("SELECT disposition,customer_id FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op2]).await.unwrap();
    assert_eq!(row.get::<_, String>(0), "owner_changed");
    assert!(row.get::<_, Option<String>>(1).is_some());
    assert!(repo
        .request(actor2, org2, "acct_customer", false, false)
        .await
        .is_err());
    // Ambiguous creation past the retry window must stop, not create another customer.
    let (org3, actor3) = tenant(&pg).await;
    let op3 = repo
        .request(actor3, org3, "acct_customer", false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    pg.execute("UPDATE team_stripe_customer_operations SET first_attempt_at=now()-interval '24 hours' WHERE operation_id=$1",&[&op3]).await.unwrap();
    let calls = mock.calls.load(Ordering::SeqCst);
    worker.tick().await.unwrap();
    assert_eq!(calls, mock.calls.load(Ordering::SeqCst));
    assert_eq!(
        repo.request(actor3, org3, "acct_customer", false, true)
            .await
            .unwrap()
            .unwrap()
            .disposition,
        "recovery_required"
    );
    let (org4, actor4) = tenant(&pg).await;
    let op4 = repo
        .request(actor4, org4, "acct_customer", false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    mock.mode.store(2, Ordering::SeqCst);
    assert_eq!(worker.tick().await.unwrap().deferred, 1);
    let row=pg.query_one("SELECT retry_at>now()+interval '100 seconds',last_error_code FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op4]).await.unwrap();
    assert!(row.get::<_, bool>(0));
    assert_eq!(row.get::<_, String>(1), "rate_limited");
    let calls = mock.calls.load(Ordering::SeqCst);
    repo.request(actor4, org4, "acct_customer", false, true)
        .await
        .unwrap();
    assert!(worker.tick().await.unwrap().idle);
    assert_eq!(calls, mock.calls.load(Ordering::SeqCst));
    mock.mode.store(0, Ordering::SeqCst);
    pg.execute(
        "UPDATE team_stripe_runtime_status SET retry_at=now() WHERE account_id='acct_customer'",
        &[],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE team_stripe_customer_operations SET retry_at=now() WHERE operation_id=$1",
        &[&op4],
    )
    .await
    .unwrap();
    assert_eq!(worker.tick().await.unwrap().applied, 1);

    // Current owner explicitly authorizes lookup. Competing stale confirmations cannot reset it.
    let calls = mock.calls.load(Ordering::SeqCst);
    pg.execute(
        "UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2",
        &[&org2, &actor2],
    )
    .await
    .unwrap();
    let status = repo
        .request(actor2, org2, "acct_customer", false, false)
        .await
        .unwrap()
        .unwrap();
    assert!(repo
        .authorize_recovery(actor2, org, "acct_customer", false, op2, status.revision)
        .await
        .is_err());
    let (a, b) = tokio::join!(
        repo.authorize_recovery(actor2, org2, "acct_customer", false, op2, status.revision),
        repo.authorize_recovery(actor2, org2, "acct_customer", false, op2, status.revision)
    );
    assert_eq!(usize::from(a.is_ok()) + usize::from(b.is_ok()), 1);
    assert_eq!(worker.tick().await.unwrap().applied, 1);
    assert_eq!(
        repo.request(actor2, org2, "acct_customer", false, false)
            .await
            .unwrap()
            .unwrap()
            .disposition,
        "verified"
    );
    let status = repo
        .request(actor3, org3, "acct_customer", false, false)
        .await
        .unwrap()
        .unwrap();
    repo.authorize_recovery(actor3, org3, "acct_customer", false, op3, status.revision)
        .await
        .unwrap();
    assert_eq!(worker.tick().await.unwrap().deferred, 1);
    let status = repo
        .request(actor3, org3, "acct_customer", false, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        status.last_error_code.as_deref(),
        Some("customer_not_found_unconfirmed")
    );
    assert!(status.lookup_only);
    // Provider creation becomes visible later; ambiguous candidates still do not authorize binding.
    mock.objects
        .lock()
        .await
        .insert(format!("atoaxis-customer-v1-{op3}"), "cus_late".into());
    mock.mode.store(3, Ordering::SeqCst);
    repo.authorize_recovery(actor3, org3, "acct_customer", false, op3, status.revision)
        .await
        .unwrap();
    assert_eq!(worker.tick().await.unwrap().deferred, 1);
    let status = repo
        .request(actor3, org3, "acct_customer", false, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        status.last_error_code.as_deref(),
        Some("customer_candidates_ambiguous")
    );
    mock.mode.store(0, Ordering::SeqCst);
    repo.authorize_recovery(actor3, org3, "acct_customer", false, op3, status.revision)
        .await
        .unwrap();
    assert_eq!(worker.tick().await.unwrap().applied, 1);
    assert_eq!(mock.calls.load(Ordering::SeqCst), calls);
    assert!(pg.query_one("SELECT first_attempt_at<now()-interval '23 hours' FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op3]).await.unwrap().get::<_,bool>(0));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_customer_authorizations WHERE operation_id=$1",
            &[&op2]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    let dump: String = pg
        .query_one(
            "SELECT json_agg(t)::text FROM team_stripe_customer_operations t",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert!(!dump.contains("PRIVATE_FIXTURE_DO_NOT_STORE"));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_bindings WHERE account_id='acct_customer'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    task.abort();
    let _ = task.await;
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn stripe_quote_owner_customer_catalog_expiry_and_retry_fences() {
    use crate::{
        repository::team_stripe_quote::QuoteRepository, services::team_stripe_catalog::Catalog,
    };
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
    let owner = Uuid::now_v7();
    let other = Uuid::now_v7();
    let operation = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Quote test')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    for actor in [owner, other] {
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&actor, &actor.to_string()],
        )
        .await
        .unwrap();
        pg.execute(
            "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
            &[&org, &actor],
        )
        .await
        .unwrap();
    }
    let repo = QuoteRepository::new(pg.clone());
    assert!(repo
        .customer(owner, org, "acct_quote", false)
        .await
        .is_err());
    pg.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode,disposition,customer_id) VALUES($1,$2,$3,'acct_quote',false,'verified','cus_quote')",&[&operation,&org,&owner]).await.unwrap();
    let proof = repo
        .customer(owner, org, "acct_quote", false)
        .await
        .unwrap();
    assert!(repo
        .customer(owner, org, "acct_other", false)
        .await
        .is_err());
    assert!(repo.customer(owner, org, "acct_quote", true).await.is_err());
    let packages=[10,25,50,100].map(|n|json!({"seats":n,"price_id":format!("price_{n}"),"product_id":"prod_quote","amount_minor":2500,"tax_behavior":"exclusive"}));
    let config = json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":"acct_quote","livemode":false,"currency":"usd","packages":packages});
    let catalog =
        Catalog::parse(&serde_json::to_vec(&config).unwrap(), "acct_quote", false).unwrap();
    let price = json!({"object":"price","id":"price_10","livemode":false,"active":true,"currency":"usd","unit_amount":2500,"tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"object":"product","id":"prod_quote","active":true,"livemode":false},"metadata":{"private":"PRIVATE_FIXTURE_DO_NOT_STORE"}});
    let offer = catalog.verify(10, &price, Utc::now()).unwrap();
    let id = Uuid::now_v7();
    let (a, b) = tokio::join!(repo.save(id, &proof, &offer), repo.save(id, &proof, &offer));
    let a = a.unwrap();
    let b = b.unwrap();
    assert_eq!(a.expires_at, b.expires_at);
    assert_eq!(a.amount_minor, "2500");
    assert!(a.total_due_minor.is_none());
    assert!(!a.checkout_available);
    let other_proof = repo
        .customer(other, org, "acct_quote", false)
        .await
        .unwrap();
    assert!(repo
        .get(&other_proof, id, &catalog.digest().unwrap())
        .await
        .is_err());
    assert!(repo.save(id, &other_proof, &offer).await.is_err());
    let mut changed = config.clone();
    changed["revision"] = json!(2);
    let changed =
        Catalog::parse(&serde_json::to_vec(&changed).unwrap(), "acct_quote", false).unwrap();
    assert!(repo
        .get(&proof, id, &changed.digest().unwrap())
        .await
        .is_err());
    let mut p25 = price.clone();
    p25["id"] = json!("price_25");
    let offer25 = catalog.verify(25, &p25, Utc::now()).unwrap();
    assert!(repo.save(id, &proof, &offer25).await.is_err());
    // Customer changed during provider lookup: no quote can use the old proof.
    pg.execute(
        "UPDATE team_stripe_customer_operations SET revision=revision+1 WHERE operation_id=$1",
        &[&operation],
    )
    .await
    .unwrap();
    assert!(repo.save(Uuid::now_v7(), &proof, &offer).await.is_err());
    assert!(repo
        .get(&proof, id, &catalog.digest().unwrap())
        .await
        .is_err());
    let proof = repo
        .customer(owner, org, "acct_quote", false)
        .await
        .unwrap();
    let second = Uuid::now_v7();
    repo.save(second, &proof, &offer).await.unwrap();
    pg.execute(
        "UPDATE organization_members SET role='admin' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    assert!(repo
        .get(&proof, second, &catalog.digest().unwrap())
        .await
        .is_err());
    assert!(repo.save(Uuid::now_v7(), &proof, &offer).await.is_err());
    pg.execute(
        "UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE team_stripe_quotes SET expires_at=now()-interval '1 second' WHERE id=$1",
        &[&second],
    )
    .await
    .unwrap();
    assert!(repo
        .get(&proof, second, &catalog.digest().unwrap())
        .await
        .is_err());
    assert!(repo.save(second, &proof, &offer).await.is_err());
    let fresh = Uuid::now_v7();
    repo.save(fresh, &proof, &offer).await.unwrap();
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,'acct_quote',false,'cus_quote','sub_quote')",&[&org]).await.unwrap();
    assert!(repo
        .get(&proof, fresh, &catalog.digest().unwrap())
        .await
        .is_err());
    let dump: String = pg
        .query_one(
            "SELECT json_agg(t)::text FROM team_stripe_quotes t WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get(0);
    assert!(!dump.contains("PRIVATE_FIXTURE_DO_NOT_STORE"));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_quotes WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        3
    );
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn stripe_checkout_confirmation_durability_and_owner_fences() {
    use crate::{
        repository::{
            team_stripe_checkout::CheckoutRepository, team_stripe_quote::QuoteRepository,
        },
        services::{team_stripe_catalog::Catalog, team_stripe_checkout::SessionEvidence},
    };
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
    let owner = Uuid::now_v7();
    let customer_op = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Checkout test')",
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
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')",&[&org,&owner]).await.unwrap();
    pg.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode,disposition,customer_id) VALUES($1,$2,$3,'acct_checkout',false,'verified','cus_checkout')",&[&customer_op,&org,&owner]).await.unwrap();
    let catalog=Catalog::parse(&serde_json::to_vec(&json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":"acct_checkout","livemode":false,"currency":"usd","packages":([10,25,50,100].map(|n|json!({"seats":n,"price_id":format!("price_checkout{n}"),"product_id":"prod_checkout","amount_minor":2500,"tax_behavior":"exclusive"})))})).unwrap(),"acct_checkout",false).unwrap();
    let price = json!({"object":"price","id":"price_checkout10","livemode":false,"active":true,"currency":"usd","unit_amount":2500,"tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"object":"product","id":"prod_checkout","active":true,"livemode":false}});
    let quotes = QuoteRepository::new(pg.clone());
    let repo = CheckoutRepository::new(pg.clone());
    let policy=crate::services::team_stripe_checkout::CheckoutPolicy::parse(br#"{"schema_version":1,"owner_approved":true,"return_origin":"https://billing.example.test","automatic_tax":true}"#).unwrap();
    let proof = quotes
        .customer(owner, org, "acct_checkout", false)
        .await
        .unwrap();
    let digest = catalog.digest().unwrap();
    let offer = catalog.verify(10, &price, Utc::now()).unwrap();
    let q = Uuid::now_v7();
    let other_q = Uuid::now_v7();
    quotes.save(q, &proof, &offer).await.unwrap();
    quotes.save(other_q, &proof, &offer).await.unwrap();
    assert!(repo
        .request(&proof, q, &digest, false, &policy)
        .await
        .is_err());
    assert!(repo
        .request(&proof, q, "changed", true, &policy)
        .await
        .is_err());
    let (a, b) = tokio::join!(
        repo.request(&proof, q, &digest, true, &policy),
        repo.request(&proof, q, &digest, true, &policy)
    );
    let a = a.unwrap();
    assert_eq!(a.operation_id, b.unwrap().operation_id);
    assert!(!a.checkout_available && !a.payment_verified);
    // Exercise actual member and invite service writes with an accepted 10-seat package.
    let members = crate::services::organizations::OrganizationsService::new(Some(pg.clone()),Arc::new(crate::services::authorization::AuthorizationService::new(Some(pg.clone()))),None);
    let mut candidates=Vec::new();
    for _ in 0..11 {
        let id=Uuid::now_v7(); pg.execute("INSERT INTO users(id,username) VALUES($1,$2)",&[&id,&id.to_string()]).await.unwrap(); candidates.push(id);
    }
    let request=|id| crate::model::organization::AddOrganizationMemberRequest {user_id:id,role:Some("member".into()),seat_type:Some("developer".into())};
    pg.execute("ALTER TABLE audit_logs ADD CONSTRAINT fixture_member_audit_failure CHECK(action<>'organization.member_upserted') NOT VALID",&[]).await.unwrap();
    assert!(members.add_member(owner,org,request(candidates[0])).await.is_err());
    assert!(pg.query_opt("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2",&[&org,&candidates[0]]).await.unwrap().is_none(),"audit failure must rollback membership");
    pg.execute("ALTER TABLE audit_logs DROP CONSTRAINT fixture_member_audit_failure",&[]).await.unwrap();
    for id in &candidates[..8] { members.add_member(owner,org,request(*id)).await.unwrap(); }
    let (one,two)=tokio::join!(members.add_member(owner,org,request(candidates[8])),members.add_member(owner,org,request(candidates[9])));
    assert_ne!(one.is_ok(),two.is_ok());
    let winner=if one.is_ok(){candidates[8]}else{candidates[9]};
    members.add_member(owner,org,request(winner)).await.unwrap(); // Idempotent existing developer.
    pg.execute("UPDATE users SET is_active=false WHERE id=$1",&[&winner]).await.unwrap();
    assert!(members.add_member(owner,org,request(candidates[10])).await.is_err());
    let invite=Uuid::now_v7();
    pg.execute("INSERT INTO organization_user_invites(id,organization_id,invitee_user_id,invited_by,role,seat_type,expires_at) VALUES($1,$2,$3,$4,'member','developer',now()+interval '1 day')",&[&invite,&org,&candidates[10],&owner]).await.unwrap();
    assert!(members.accept_invite(candidates[10],invite).await.is_err());
    assert_eq!(pg.query_one("SELECT status FROM organization_user_invites WHERE id=$1",&[&invite]).await.unwrap().get::<_,String>(0),"pending");
    members.add_member(owner,org,crate::model::organization::AddOrganizationMemberRequest{user_id:candidates[0],role:Some("viewer".into()),seat_type:Some("viewer".into())}).await.unwrap();
    pg.execute("ALTER TABLE audit_logs ADD CONSTRAINT fixture_invite_audit_failure CHECK(action<>'organization.member_invite_accepted') NOT VALID",&[]).await.unwrap();
    assert!(members.accept_invite(candidates[10],invite).await.is_err());
    assert_eq!(pg.query_one("SELECT status FROM organization_user_invites WHERE id=$1",&[&invite]).await.unwrap().get::<_,String>(0),"pending");
    assert!(pg.query_opt("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2",&[&org,&candidates[10]]).await.unwrap().is_none());
    pg.execute("ALTER TABLE audit_logs DROP CONSTRAINT fixture_invite_audit_failure",&[]).await.unwrap();
    members.accept_invite(candidates[10],invite).await.unwrap();
    let count:i64=pg.query_one("SELECT count(*) FROM organization_members WHERE organization_id=$1 AND deactivated_at IS NULL AND role<>'viewer' AND seat_type='developer'",&[&org]).await.unwrap().get(0);
    assert_eq!(count,10);
    pg.execute("ALTER TABLE audit_logs ADD CONSTRAINT fixture_remove_audit_failure CHECK(action<>'organization.member_deactivated') NOT VALID",&[]).await.unwrap();
    assert!(members.remove_member(owner,org,candidates[10]).await.is_err());
    assert!(pg.query_one("SELECT deactivated_at IS NULL FROM organization_members WHERE organization_id=$1 AND user_id=$2",&[&org,&candidates[10]]).await.unwrap().get::<_,bool>(0));
    pg.execute("ALTER TABLE audit_logs DROP CONSTRAINT fixture_remove_audit_failure",&[]).await.unwrap();
    assert!(members.remove_member(owner,org,candidates[10]).await.unwrap());
    assert!(!members.remove_member(owner,org,candidates[10]).await.unwrap());
    assert_eq!(pg.query_one("SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND resource_id=$2 AND action='organization.member_deactivated'",&[&org,&candidates[10]]).await.unwrap().get::<_,i64>(0),1);

    // Test-only cleanup keeps the pre-existing Checkout fault scenarios independent.
    pg.execute("DELETE FROM organization_members WHERE organization_id=$1 AND user_id<>$2",&[&org,&owner]).await.unwrap();

    assert!(repo
        .request(&proof, other_q, &digest, true, &policy)
        .await
        .is_err());
    assert!(repo
        .status(
            owner,
            Uuid::new_v4(),
            "acct_checkout",
            false,
            a.operation_id
        )
        .await
        .is_err());
    assert!(repo
        .status(owner, org, "acct_wrong", false, a.operation_id)
        .await
        .is_err());
    let claim = repo
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(claim.operation, a.operation_id);
    assert!(repo
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .is_none());
    let retry = Utc::now() + Duration::minutes(5);
    repo.fail(
        &claim,
        &crate::infrastructure::stripe::ProviderError {
            kind: Failure::RateLimited,
            status: Some(429),
            retry_after: Some(retry),
        },
    )
    .await
    .unwrap();
    let status = repo
        .request(&proof, q, &digest, true, &policy)
        .await
        .unwrap();
    assert!(status.retry_at >= retry);
    assert!(repo
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .is_none());
    // Crash/restart and quote expiry do not change the accepted intent/idempotency identity.
    pg.execute(
        "UPDATE team_stripe_quotes SET expires_at=now()-interval '1 second' WHERE id=$1",
        &[&q],
    )
    .await
    .unwrap();
    assert_eq!(
        repo.request(&proof, q, &digest, true, &policy)
            .await
            .unwrap()
            .operation_id,
        claim.operation
    );
    pg.execute("UPDATE team_stripe_checkout_intents SET retry_at=now(),lease_until=now()-interval '1 second' WHERE operation_id=$1",&[&claim.operation]).await.unwrap();
    let restarted = CheckoutRepository::new(pg.clone());
    let again = restarted
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(again.operation, claim.operation);
    assert_eq!(again.request.form(), claim.request.form());
    assert_ne!(again.lease, claim.lease);
    let provider = json!({"object":"checkout.session","id":"cs_test_checkout","mode":"subscription","livemode":false,"customer":"cus_checkout","client_reference_id":again.operation,"metadata":{"atoaxis_checkout_operation":again.operation},"status":"complete","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":(Utc::now()+Duration::hours(1)).timestamp(),"subscription":"sub_checkout","line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_checkout10","currency":"usd","unit_amount":2500}}]},"customer_details":{"email":"PRIVATE_FIXTURE_DO_NOT_STORE"},"url":"PRIVATE_FIXTURE_DO_NOT_STORE"});
    let evidence = SessionEvidence::parse(&provider, &again.expected(), Utc::now()).unwrap();
    assert!(!repo.receive(&claim, &evidence).await.unwrap()); // stale lease
                                                              // Provider accepted but local transaction failed: receipt can be retried with same operation.
    pg.execute("ALTER TABLE team_stripe_checkout_intents ADD CONSTRAINT fixture_receipt_failure CHECK(session_id IS NULL)",&[]).await.unwrap();
    assert!(repo.receive(&again, &evidence).await.is_err());
    pg.execute(
        "ALTER TABLE team_stripe_checkout_intents DROP CONSTRAINT fixture_receipt_failure",
        &[],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE organization_members SET role='admin' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    assert!(!repo.receive(&again, &evidence).await.unwrap()); // receipt saved, never enables payment
    assert!(repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .is_err());
    pg.execute(
        "UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    let status = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(status.disposition, "owner_changed");
    assert!(!status.payment_verified);
    let row = pg
        .query_one(
            "SELECT row_to_json(c)::text FROM team_stripe_checkout_intents c WHERE operation_id=$1",
            &[&claim.operation],
        )
        .await
        .unwrap();
    let metadata: String = row.get(0);
    assert!(metadata.contains("cs_test_checkout"));
    assert!(!metadata.contains("PRIVATE_FIXTURE"));
    assert!(repo
        .request(&proof, other_q, &digest, true, &policy)
        .await
        .is_err());
    // Test-only restore to pre-receipt state models a process crash; no production reset endpoint exists.
    pg.execute("UPDATE team_stripe_checkout_intents SET disposition='pending',session_id=NULL,subscription_id=NULL,retry_at=now(),first_attempt_at=now()-interval '24 hours' WHERE operation_id=$1",&[&claim.operation]).await.unwrap();
    let recovery = repo
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .unwrap();
    assert!(recovery.lookup_only);
    assert!(recovery.session_id.is_none());
    repo.unresolved(&recovery, "checkout_not_found_unconfirmed")
        .await
        .unwrap();
    assert_eq!(
        repo.status(owner, org, "acct_checkout", false, claim.operation)
            .await
            .unwrap()
            .last_error_code
            .as_deref(),
        Some("checkout_not_found_unconfirmed")
    );
    assert!(repo
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .is_none());

    // Isolated replay of the pre-dispatch checkpoint, now through the actual worker/HTTP adapter.
    pg.execute("UPDATE team_stripe_checkout_intents SET disposition='pending',first_attempt_at=now(),retry_at=now(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&claim.operation]).await.unwrap();
    use axum::{
        response::IntoResponse,
        routing::{get, post},
        Json, Router,
    };
    use std::sync::atomic::{AtomicUsize, Ordering};
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_in = calls.clone();
    let mut open = provider.clone();
    open["status"] = json!("open");
    open["subscription"] = json!(null);
    let current = Arc::new(tokio::sync::Mutex::new(open));
    let post_result = current.clone();
    let subscription_calls = Arc::new(AtomicUsize::new(0));
    let sub_calls = subscription_calls.clone();
    let subscription_failure = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let sub_failure = subscription_failure.clone();
    let get_result = current.clone();
    let lookup_mode = Arc::new(AtomicUsize::new(0));
    let list_mode = lookup_mode.clone();
    let list_result = current.clone();
    let sub = json!({"object":"subscription","id":"sub_checkout","customer":"cus_checkout","livemode":false,"metadata":{"atoaxis_checkout_operation":claim.operation},"status":"incomplete","cancel_at_period_end":false,"latest_invoice":null,"items":{"has_more":false,"data":[{"id":"si_checkout","quantity":1,"current_period_start":1792000000,"current_period_end":1794600000,"price":{"id":"price_checkout10","currency":"usd","unit_amount":2500}}]}});
    let app = Router::new()
        .route(
            "/v1/account",
            get(|| async { Json(json!({"object":"account","id":"acct_checkout"})) }),
        )
        .route(
            "/v1/prices/price_checkout10",
            get(move || {
                let price = price.clone();
                async move { Json(price) }
            }),
        )
        .route(
            "/v1/checkout/sessions",
            post(move || {
                let calls = calls_in.clone();
                let result = post_result.clone();
                async move {
                    if calls.fetch_add(1, Ordering::SeqCst) == 0 {
                        return "{".into_response();
                    }
                    Json(result.lock().await.clone()).into_response()
                }
            })
            .get(
                move |axum::extract::Query(query): axum::extract::Query<
                    std::collections::HashMap<String, String>,
                >| {
                    let mode = list_mode.clone();
                    let result = list_result.clone();
                    async move {
                        assert_eq!(
                            query.get("customer").map(String::as_str),
                            Some("cus_checkout")
                        );
                        assert_eq!(query.get("limit").map(String::as_str), Some("100"));
                        let item = result.lock().await.clone();
                        let value = match mode.load(Ordering::SeqCst) {
                            0 => json!({"object":"list","data":[],"has_more":false}),
                            1 => {
                                let mut second = item.clone();
                                second["id"] = json!("cs_test_duplicate");
                                json!({"object":"list","data":[item,second],"has_more":false})
                            }
                            2 => json!({"object":"list","data":[item],"has_more":false}),
                            3 => {
                                let mut page = item;
                                let last = query
                                    .get("starting_after")
                                    .and_then(|s| s.strip_prefix("cs_test_page"))
                                    .and_then(|s| s.parse::<usize>().ok())
                                    .unwrap_or(0);
                                page["id"] = json!(format!("cs_test_page{}", last + 1));
                                page["client_reference_id"] = json!(null);
                                page["metadata"] = json!({});
                                json!({"object":"list","data":[page],"has_more":true})
                            }
                            _ => {
                                let mut wrong = item;
                                wrong["customer"] = json!("cus_other");
                                json!({"object":"list","data":[wrong],"has_more":false})
                            }
                        };
                        Json(value)
                    }
                },
            ),
        )
        .route(
            "/v1/checkout/sessions/cs_test_checkout",
            get(move || {
                let result = get_result.clone();
                async move { Json(result.lock().await.clone()) }
            }),
        )
        .route(
            "/v1/subscriptions/sub_checkout",
            get(move || {
                let sub = sub.clone();
                let calls = sub_calls.clone();
                let failure = sub_failure.clone();
                async move {
                    calls.fetch_add(1, Ordering::SeqCst);
                    if failure.load(Ordering::SeqCst) {
                        return axum::http::StatusCode::SERVICE_UNAVAILABLE.into_response();
                    }
                    Json(sub).into_response()
                }
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let worker = crate::services::team_stripe_worker::StripeWorker::new(
        TeamStripeRepository::new(pg.clone()),
        crate::infrastructure::stripe::StripeClient::fixture(port, "acct_checkout"),
    );
    assert_eq!(worker.checkout_tick(&catalog).await.unwrap().deferred, 1);
    assert_eq!(
        repo.status(owner, org, "acct_checkout", false, claim.operation)
            .await
            .unwrap()
            .last_error_code
            .as_deref(),
        Some("network")
    );
    assert!(worker.checkout_tick(&catalog).await.unwrap().idle);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    pg.execute(
        "UPDATE team_stripe_runtime_status SET retry_at=now() WHERE account_id='acct_checkout'",
        &[],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE team_stripe_checkout_intents SET retry_at=now() WHERE operation_id=$1",
        &[&claim.operation],
    )
    .await
    .unwrap();
    let restarted_worker = crate::services::team_stripe_worker::StripeWorker::new(
        TeamStripeRepository::new(pg.clone()),
        crate::infrastructure::stripe::StripeClient::fixture(port, "acct_checkout"),
    );
    assert_eq!(
        restarted_worker
            .checkout_tick(&catalog)
            .await
            .unwrap()
            .applied,
        1
    );
    let done = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(done.disposition, "session_open");
    assert!(!done.payment_verified);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert!(restarted_worker.checkout_tick(&catalog).await.unwrap().idle);
    let destination = repo
        .destination_proof(
            owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, done.revision),
        )
        .await
        .unwrap();
    assert!(repo
        .destination_proof(
            owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, done.revision - 1)
        )
        .await
        .is_err());
    assert!(repo
        .destination_proof(
            owner,
            org,
            "acct_wrong",
            false,
            (claim.operation, done.revision)
        )
        .await
        .is_err());
    let hosted_client = crate::infrastructure::stripe::StripeClient::fixture(port, "acct_checkout");
    assert!(hosted_client.hosted_checkout(&destination).await.is_err());
    current.lock().await["url"] =
        json!("https://checkout.stripe.com/c/pay/cs_test_checkout#opaque");
    let link = hosted_client.hosted_checkout(&destination).await.unwrap();
    assert_eq!(link.operation_id, claim.operation);
    assert!(link
        .url
        .starts_with("https://checkout.stripe.com/c/pay/cs_test_checkout"));
    pg.execute(
        "UPDATE organization_members SET role='admin' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    assert!(repo
        .destination_proof(
            owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, done.revision)
        )
        .await
        .is_err());
    pg.execute(
        "UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    let stored: String = pg
        .query_one(
            "SELECT row_to_json(c)::text FROM team_stripe_checkout_intents c WHERE operation_id=$1",
            &[&claim.operation],
        )
        .await
        .unwrap()
        .get(0);
    assert!(!stored.contains("checkout.stripe.com"));

    // Existing session polling survives quote/catalog changes and the create idempotency window.
    *current.lock().await = provider.clone();
    pg.execute("UPDATE team_stripe_checkout_intents SET retry_at=now(),first_attempt_at=now()-interval '30 hours' WHERE operation_id=$1",&[&claim.operation]).await.unwrap();
    let changed=Catalog::parse(&serde_json::to_vec(&json!({"schema_version":1,"revision":2,"owner_approved":true,"account_id":"acct_checkout","livemode":false,"currency":"usd","packages":([10,25,50,100].map(|n|json!({"seats":n,"price_id":format!("price_checkout{n}"),"product_id":"prod_checkout","amount_minor":5000,"tax_behavior":"exclusive"})))})).unwrap(),"acct_checkout",false).unwrap();
    // Binding/job/receipt must roll back together if the database cannot commit the binding.
    pg.execute("ALTER TABLE team_stripe_bindings ADD CONSTRAINT fixture_checkout_bind_failure CHECK(subscription_id<>'sub_checkout')",&[]).await.unwrap();
    assert!(restarted_worker.checkout_tick(&changed).await.is_err());
    let old = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(old.disposition, "session_open");
    assert!(!old.payment_verified);
    pg.execute(
        "ALTER TABLE team_stripe_bindings DROP CONSTRAINT fixture_checkout_bind_failure",
        &[],
    )
    .await
    .unwrap();
    pg.execute("UPDATE team_stripe_checkout_intents SET lease_until=now()-interval '1 second' WHERE operation_id=$1",&[&claim.operation]).await.unwrap();
    pg.execute("UPDATE team_stripe_runtime_status SET lease_until=now()-interval '1 second' WHERE account_id='acct_checkout'",&[]).await.unwrap();
    assert_eq!(
        restarted_worker
            .checkout_tick(&changed)
            .await
            .unwrap()
            .applied,
        1
    );
    assert_eq!(calls.load(Ordering::SeqCst), 2); // polling did not POST another Session
    let bound = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(bound.disposition, "bound");
    assert!(!bound.payment_verified);
    // A bound Checkout is not a paid package: independently observed invoice + accepted terms.
    let payments = TeamStripeRepository::new(pg.clone());
    let payment_claim = payments.claim("acct_checkout", false).await.unwrap().unwrap();
    let (mut current, mut invoice, _) = crate::services::team_stripe_payment::tests::fixture(Utc::now());
    current.subscription_id="sub_checkout".into(); current.customer_id="cus_checkout".into();
    current.price_id=Some("price_checkout10".into()); current.amount_minor=Some(2500);
    invoice.subscription_id=current.subscription_id.clone(); invoice.customer_id=current.customer_id.clone();
    invoice.lines[0].subscription_id=Some(current.subscription_id.clone());
    invoice.lines[0].price_id=current.price_id.clone();
    invoice.lines[0].amount_minor=Some(2500); invoice.amount_due_minor=Some(2500); invoice.amount_paid_minor=Some(2500);
    pg.execute("ALTER TABLE team_stripe_snapshots ADD CONSTRAINT fixture_payment_atomic CHECK(payment_assessment IS NULL) NOT VALID",&[]).await.unwrap();
    assert!(payments.complete_observation(&payment_claim,&current,Some(&invoice)).await.is_err());
    assert!(pg.query_opt("SELECT 1 FROM team_stripe_snapshots WHERE organization_id=$1",&[&org]).await.unwrap().is_none());
    pg.execute("ALTER TABLE team_stripe_snapshots DROP CONSTRAINT fixture_payment_atomic",&[]).await.unwrap();
    assert!(payments.complete_observation(&payment_claim,&current,Some(&invoice)).await.unwrap());
    assert!(!payments.complete_observation(&payment_claim,&current,Some(&invoice)).await.unwrap());
    let paid=repo.latest(owner,org,"acct_checkout",false).await.unwrap().unwrap().invoice_assessment.unwrap();
    assert_eq!(paid.state,"settled"); assert_eq!(paid.package_seats,Some(10)); assert!(!paid.access_granted);
    assert!(repo.latest(owner,org,"acct_other",false).await.unwrap().is_none());
    assert!(repo.latest(owner,org,"acct_checkout",true).await.unwrap().is_none());
    pg.execute("UPDATE team_stripe_bindings SET enabled=false WHERE organization_id=$1",&[&org]).await.unwrap();
    assert_eq!(repo.latest(owner,org,"acct_checkout",false).await.unwrap().unwrap().invoice_assessment.unwrap().state,"unconfirmed");
    pg.execute("UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",&[&org]).await.unwrap();
    let event=crate::services::team_stripe::Event {account_id:"acct_checkout".into(),livemode:false,event_id:"evt_payment_refresh".into(),kind:"invoice.paid".into(),created:Utc::now(),customer_id:Some("cus_checkout".into()),subscription_id:Some("sub_checkout".into()),invoice_id:Some(invoice.invoice_id.clone()),supported:true};
    payments.accept(&event,&"b".repeat(64)).await.unwrap();
    let pending=repo.latest(owner,org,"acct_checkout",false).await.unwrap().unwrap().invoice_assessment.unwrap();
    assert_eq!(pending.reason,"reconciliation_pending"); assert_eq!(pending.package_seats,None);
    let next=payments.claim("acct_checkout",false).await.unwrap().unwrap();
    current.observed_at=Utc::now()-Duration::minutes(6); invoice.observed_at=current.observed_at;
    assert!(payments.complete_observation(&next,&current,Some(&invoice)).await.unwrap());
    assert_eq!(repo.latest(owner,org,"acct_checkout",false).await.unwrap().unwrap().invoice_assessment.unwrap().reason,"observation_stale");

    let job:i64=pg.query_one("SELECT count(*) FROM team_stripe_reconcile_jobs WHERE account_id='acct_checkout' AND subscription_id='sub_checkout'",&[]).await.unwrap().get(0);
    assert_eq!(job, 1);
    assert!(restarted_worker.checkout_tick(&changed).await.unwrap().idle);

    // Replay a pre-create checkpoint only in this fixture: a completed Session must be
    // persisted before the unavailable subscription API can fail its verification.
    pg.execute(
        "DELETE FROM team_stripe_reconcile_jobs WHERE account_id='acct_checkout'",
        &[],
    )
    .await
    .unwrap();
    pg.execute(
        "DELETE FROM team_stripe_bindings WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    pg.execute("UPDATE team_stripe_checkout_intents SET disposition='pending',session_id=NULL,subscription_id=NULL,first_attempt_at=now(),retry_at=now(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&claim.operation]).await.unwrap();
    subscription_failure.store(true, Ordering::SeqCst);
    let before = subscription_calls.load(Ordering::SeqCst);
    assert_eq!(
        restarted_worker
            .checkout_tick(&catalog)
            .await
            .unwrap()
            .applied,
        1
    );
    assert_eq!(subscription_calls.load(Ordering::SeqCst), before);
    let saved = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(saved.disposition, "awaiting_verification");
    assert!(!saved.payment_verified);
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    pg.execute("UPDATE team_stripe_checkout_intents SET retry_at=now(),first_attempt_at=now()-interval '30 hours' WHERE operation_id=$1", &[&claim.operation]).await.unwrap();
    assert_eq!(
        restarted_worker
            .checkout_tick(&changed)
            .await
            .unwrap()
            .deferred,
        1
    );
    let failed = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(failed.disposition, "awaiting_verification");
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    // A transient failure cannot regress a complete Session to open.
    pg.execute(
        "UPDATE team_stripe_runtime_status SET retry_at=now() WHERE account_id='acct_checkout'",
        &[],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE team_stripe_checkout_intents SET retry_at=now() WHERE operation_id=$1",
        &[&claim.operation],
    )
    .await
    .unwrap();
    let pending = repo
        .claim("acct_checkout", false, &changed.digest().unwrap())
        .await
        .unwrap()
        .unwrap();
    let mut stale = provider.clone();
    stale["status"] = json!("open");
    stale["subscription"] = json!(null);
    let stale = SessionEvidence::parse(&stale, &pending.expected(), Utc::now()).unwrap();
    assert!(repo.receive(&pending, &stale).await.is_err());
    // Missing remote identity does not free the reservation or mark it expired.
    repo.fail(
        &pending,
        &crate::infrastructure::stripe::ProviderError {
            kind: Failure::NotFound,
            status: Some(404),
            retry_after: None,
        },
    )
    .await
    .unwrap();
    let missing = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(missing.disposition, "recovery_required");
    assert!(repo
        .request(&proof, other_q, &digest, true, &policy)
        .await
        .is_err());
    assert!(!missing.payment_verified);
    // Unknown Session recovery is lookup-only even beyond the create window and after
    // the catalog changes. Empty/ambiguous/bounded scans never permit another POST.
    for (mode, reason) in [
        (0, "checkout_not_found_unconfirmed"),
        (1, "checkout_candidates_ambiguous"),
        (3, "checkout_lookup_limit"),
        (4, "provider_scope_mismatch"),
    ] {
        lookup_mode.store(mode, Ordering::SeqCst);
        pg.execute("UPDATE team_stripe_checkout_intents SET disposition='pending',session_id=NULL,subscription_id=NULL,first_attempt_at=now()-interval '30 hours',retry_at=now(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&claim.operation]).await.unwrap();
        pg.execute(
            "UPDATE team_stripe_runtime_status SET retry_at=now() WHERE account_id='acct_checkout'",
            &[],
        )
        .await
        .unwrap();
        assert_eq!(
            restarted_worker
                .checkout_tick(&changed)
                .await
                .unwrap()
                .deferred,
            1
        );
        let unresolved = repo
            .status(owner, org, "acct_checkout", false, claim.operation)
            .await
            .unwrap();
        assert_eq!(unresolved.disposition, "recovery_required");
        assert_eq!(unresolved.last_error_code.as_deref(), Some(reason));
        assert!(!unresolved.payment_verified);
        assert_eq!(calls.load(Ordering::SeqCst), 3);
    }
    // A single candidate still requires GET verification, then durable receipt before binding.
    lookup_mode.store(2, Ordering::SeqCst);
    pg.execute("UPDATE team_stripe_checkout_intents SET disposition='recovery_required',last_error_code='idempotency_window_unconfirmed',session_id=NULL,subscription_id=NULL,retry_at=now() WHERE operation_id=$1", &[&claim.operation]).await.unwrap();
    pg.execute(
        "UPDATE team_stripe_runtime_status SET retry_at=now() WHERE account_id='acct_checkout'",
        &[],
    )
    .await
    .unwrap();
    assert_eq!(
        restarted_worker
            .checkout_tick(&changed)
            .await
            .unwrap()
            .applied,
        1
    );
    let recovered = repo
        .status(owner, org, "acct_checkout", false, claim.operation)
        .await
        .unwrap();
    assert_eq!(recovered.disposition, "awaiting_verification");
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    assert!(!recovered.payment_verified);
    // New Owner can explicitly reauthorize read-only recovery without rewriting the
    // original actor/quote. CAS and audit must commit together, preserving Retry-After.
    let next_owner = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&next_owner, &next_owner.to_string()],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')", &[&org,&next_owner]).await.unwrap();
    pg.execute(
        "UPDATE organization_members SET role='admin' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &owner],
    )
    .await
    .unwrap();
    pg.execute("UPDATE team_stripe_checkout_intents SET disposition='owner_changed',session_id=NULL,subscription_id=NULL,first_attempt_at=now(),retry_at=now()+interval '5 minutes' WHERE operation_id=$1", &[&claim.operation]).await.unwrap();
    let incident = repo
        .latest(next_owner, org, "acct_checkout", false)
        .await
        .unwrap()
        .unwrap();
    assert!(repo
        .latest(owner, org, "acct_checkout", false)
        .await
        .is_err());
    assert!(repo
        .authorize_recovery(
            owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, incident.revision)
        )
        .await
        .is_err());
    assert!(repo
        .authorize_recovery(
            next_owner,
            org,
            "acct_wrong",
            false,
            (claim.operation, incident.revision)
        )
        .await
        .is_err());
    assert!(repo
        .authorize_recovery(
            next_owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, incident.revision - 1)
        )
        .await
        .is_err());
    pg.execute("UPDATE team_stripe_checkout_intents SET lease_until=now()+interval '5 minutes' WHERE operation_id=$1",&[&claim.operation]).await.unwrap();
    assert!(repo
        .authorize_recovery(
            next_owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, incident.revision)
        )
        .await
        .is_err());
    pg.execute(
        "UPDATE team_stripe_checkout_intents SET lease_until=NULL WHERE operation_id=$1",
        &[&claim.operation],
    )
    .await
    .unwrap();
    pg.execute("ALTER TABLE team_stripe_checkout_authorizations ADD CONSTRAINT fixture_checkout_reauthorization_failure CHECK(revision<0)",&[]).await.unwrap();
    assert!(repo
        .authorize_recovery(
            next_owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, incident.revision)
        )
        .await
        .is_err());
    assert_eq!(
        repo.latest(next_owner, org, "acct_checkout", false)
            .await
            .unwrap()
            .unwrap()
            .revision,
        incident.revision
    );
    pg.execute("ALTER TABLE team_stripe_checkout_authorizations DROP CONSTRAINT fixture_checkout_reauthorization_failure",&[]).await.unwrap();
    let (one, two) = tokio::join!(
        repo.authorize_recovery(
            next_owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, incident.revision)
        ),
        repo.authorize_recovery(
            next_owner,
            org,
            "acct_checkout",
            false,
            (claim.operation, incident.revision)
        )
    );
    assert_ne!(one.is_ok(), two.is_ok());
    let authorized = repo
        .latest(next_owner, org, "acct_checkout", false)
        .await
        .unwrap()
        .unwrap();
    assert!(authorized.lookup_only);
    assert_eq!(authorized.retry_at, incident.retry_at);
    assert!(repo
        .claim("acct_checkout", false, &digest)
        .await
        .unwrap()
        .is_none());
    let audit: i64 = pg
        .query_one(
            "SELECT count(*) FROM team_stripe_checkout_authorizations WHERE operation_id=$1",
            &[&claim.operation],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(audit, 1);
    pg.execute(
        "UPDATE team_stripe_checkout_intents SET retry_at=now() WHERE operation_id=$1",
        &[&claim.operation],
    )
    .await
    .unwrap();
    let read_only = repo
        .claim("acct_checkout", false, &changed.digest().unwrap())
        .await
        .unwrap()
        .unwrap();
    assert!(read_only.lookup_only); // younger than 23h: the durable authorization forbids POST.
    assert_eq!(read_only.proof.actor, next_owner);
    let original: Uuid = pg
        .query_one(
            "SELECT actor_id FROM team_stripe_checkout_intents WHERE operation_id=$1",
            &[&claim.operation],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(original, owner);
    let receipt = SessionEvidence::parse(&provider, &read_only.expected(), Utc::now()).unwrap();
    pg.execute(
        "UPDATE organization_members SET role='admin' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &next_owner],
    )
    .await
    .unwrap();
    assert!(!repo.receive(&read_only, &receipt).await.unwrap());
    let parked: String = pg
        .query_one(
            "SELECT disposition FROM team_stripe_checkout_intents WHERE operation_id=$1",
            &[&claim.operation],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(parked, "owner_changed");
    server.abort();
    let _ = server.await;
    let count: i64 = pg
        .query_one(
            "SELECT count(*) FROM team_stripe_bindings WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 0);
}


#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn stripe_guarded_observation_commit_and_lost_confirmation_boundary() {
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
    for expire_during_prepare in [false, true] {
        let org = Uuid::now_v7();
        let owner = Uuid::now_v7();
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Guarded Stripe observation')",
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
        let file = crate::infrastructure::team_financial_guard::TestLedger::new(&[org]);
        let guard = &file.guard;
        super::team_analytics_entitlement::start_trial(&pg, org, owner, 10, &file.deployment())
            .await
            .unwrap();
        let account = format!("acct_guarded_{}", Uuid::now_v7().simple());
        let subscription = format!("sub_guarded_{}", Uuid::now_v7());
        let customer = format!("cus_guarded_{}", Uuid::now_v7());
        pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,false,$3,$4)", &[&org,&account,&customer,&subscription]).await.unwrap();
        pg.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,false,$2)", &[&account,&subscription]).await.unwrap();
        let repo = TeamStripeRepository::new_guarded(pg.clone(), file.deployment());
        super::team_financial_ingress::seed_empty_fixture(&pg,guard,&crate::services::team_financial_ingress::Scope{account:account.clone(),live:false}).await.unwrap();
        let claim = repo.claim(&account, false).await.unwrap().unwrap();
        let (mut snapshot, _, _) = crate::services::team_stripe_payment::tests::fixture(Utc::now());
        snapshot.subscription_id = subscription.clone();
        snapshot.customer_id = customer;
        snapshot.observed_at = Utc::now();
        let token = guard.read().unwrap().organization_token(org).unwrap();
        let unguarded = TeamStripeRepository::new(pg.clone());
        // Restored pre-enrollment SQL plus a disabled deployment flag must not
        // discard the still-configured, independently enrolled roster.
        let saved=pg.query_one("DELETE FROM team_analytics_entitlements WHERE organization_id=$1 RETURNING revision,state,created_at,updated_at", &[&org]).await.unwrap();
        {
            let _environment = guard.environment();
            std::env::set_var("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED", "false");
            let restored = TeamStripeRepository::new(pg.clone());
            assert!(restored.complete(&claim, &snapshot).await.is_err());
            assert_eq!(pg.query_one("SELECT count(*) FROM team_stripe_snapshots WHERE organization_id=$1", &[&org]).await.unwrap().get::<_,i64>(0),0);
            assert_eq!(pg.query_one("SELECT applied_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND livemode=false AND subscription_id=$2", &[&account,&subscription]).await.unwrap().get::<_,i64>(0),0);
        }
        pg.execute("INSERT INTO team_analytics_entitlements(organization_id,revision,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5)", &[&org,&saved.get::<_,i64>(0),&saved.get::<_,serde_json::Value>(1),&saved.get::<_,chrono::DateTime<Utc>>(2),&saved.get::<_,chrono::DateTime<Utc>>(3)]).await.unwrap();

        assert!(
            unguarded.complete(&claim, &snapshot).await.is_err(),
            "enrolled state cannot use precommercial unguarded observations"
        );
        assert!(pg
            .query_opt(
                "SELECT 1 FROM team_stripe_snapshots WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .is_none());
        assert_eq!(
            guard.read().unwrap().organization_token(org).unwrap(),
            token
        );
        assert!(repo.complete(&claim, &snapshot).await.unwrap());
        let current: crate::services::team_analytics_entitlement::State = serde_json::from_value(
            pg.query_one(
                "SELECT state FROM team_analytics_entitlements WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap()
            .get(0),
        )
        .unwrap();
        assert_eq!(current.revision, 2);
        guard
            .read()
            .unwrap()
            .snapshot
            .verify(org, Some(&current))
            .unwrap();
        pg.execute("UPDATE team_stripe_reconcile_jobs SET requested_revision=2,retry_at=now() WHERE account_id=$1", &[&account]).await.unwrap();
        let second = repo.claim(&account, false).await.unwrap().unwrap();
        snapshot.observed_at = Utc::now();
        if expire_during_prepare {
            pg.execute("UPDATE team_stripe_reconcile_jobs SET lease_until=clock_timestamp()+interval '1 second' WHERE account_id=$1", &[&account]).await.unwrap();
            guard.delay_prepare_once_ms(1500);
        } else {
            guard.fail_commit_confirmation_once();
        }
        assert_eq!(
            repo.complete(&second, &snapshot)
                .await
                .unwrap_err()
                .to_string(),
            "financial_guard_commit_reconciliation_required"
        );
        assert_eq!(
            pg.query_one(
                "SELECT applied_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1",
                &[&account]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            if expire_during_prepare { 1 } else { 2 }
        );
        let external = guard.read().unwrap();
        let pending = external.snapshot.organizations[&org]
            .pending
            .as_ref()
            .unwrap();
        assert_eq!(pending.state.revision, 3);
        assert!(
            super::team_analytics_entitlement::reconcile_trial(
                &pg,
                org,
                owner,
                pending.transition_id,
                guard
            )
            .await
            .is_err(),
            "trial recovery cannot approve provider/payment transitions"
        );
        // Even an otherwise no-op older provider revision cannot bypass a pending guard.
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        super::team_seats::lock(&tx, org).await.unwrap();
        let assessment =
            crate::services::team_stripe_payment::assess(&snapshot, None, None, Utc::now());
        let mut stale = second.clone();
        stale.revision = 1;
        assert!(super::team_analytics_entitlement::observe(
            &tx,
            &stale,
            &snapshot,
            None,
            &assessment,
            Utc::now(),
            &file.deployment().observation()
        )
        .await
        .is_err());
        tx.rollback().await.unwrap();
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        pg.execute("DELETE FROM users WHERE id=$1", &[&owner])
            .await
            .unwrap();
        pg.execute(
            "DELETE FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&account],
        )
        .await
        .unwrap();
    }
}
