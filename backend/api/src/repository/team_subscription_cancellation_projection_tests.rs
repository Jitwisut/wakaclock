//! Actual HTTP stub + isolated SQL regression. Never real Stripe evidence.
use super::*;
use crate::{
    infrastructure::stripe::StripeClient,
    services::team_subscription_cancellation::lifecycle::ExchangeKind,
};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

fn provider(before: &Subscription, scheduled: bool) -> Value {
    json!({"object":"subscription","id":before.subscription,"customer":before.customer,"livemode":false,"status":"active",
        "cancel_at_period_end":scheduled,"cancel_at":null,"canceled_at":null,
        "ended_at":null,"schedule":null,"pending_update":null,"latest_invoice":null,"trial_end":null,
        "items":{"has_more":false,"data":[{"id":before.item,"quantity":1,
            "current_period_start":before.period_start.unwrap().timestamp(),"current_period_end":before.period_end.unwrap().timestamp(),
            "price":{"id":before.price,"currency":before.currency,"unit_amount":before.amount_minor}}]},
        "description":"PRIVATE_CANCELLATION_PROJECTION_MARKER","metadata":{"prompt":"PRIVATE_CANCELLATION_PROJECTION_MARKER"}})
}
async fn server(
    account: &str,
    before: &Subscription,
    key: &str,
) -> (u16, tokio::task::JoinHandle<()>) {
    server_mode(account, before, key, false).await
}
async fn server_mode(
    account: &str,
    before: &Subscription,
    key: &str,
    read_scheduled: bool,
) -> (u16, tokio::task::JoinHandle<()>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let path = format!("/v1/subscriptions/{}", before.subscription);
    let responses = if read_scheduled {
        vec![
            (
                "GET",
                "/v1/account".into(),
                json!({"object":"account","id":account}),
            ),
            ("GET", path, provider(before, true)),
        ]
    } else {
        vec![
            (
                "GET",
                "/v1/account".to_string(),
                json!({"object":"account","id":account}),
            ),
            ("GET", path.clone(), provider(before, false)),
            (
                "GET",
                "/v1/account".to_string(),
                json!({"object":"account","id":account}),
            ),
            ("POST", path, provider(before, true)),
        ]
    };
    let key = key.to_string();
    let handle = tokio::spawn(async move {
        for (method, path, mut value) in responses {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let mut part = [0_u8; 4096];
            let (header_end, length) = loop {
                let count = stream.read(&mut part).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&part[..count]);
                assert!(bytes.len() < 65536);
                if let Some(end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]).to_ascii_lowercase();
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.strip_prefix("content-length:")
                                .map(|value| value.trim().parse::<usize>().unwrap())
                        })
                        .unwrap_or(0);
                    break (end + 4, length);
                }
            };
            while bytes.len() < header_end + length {
                let count = stream.read(&mut part).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&part[..count]);
            }
            let header = String::from_utf8_lossy(&bytes[..header_end]);
            let lowercase = header.to_ascii_lowercase();
            assert!(header.starts_with(&format!("{method} {path} HTTP/1.1")));
            assert!(lowercase.contains("stripe-version: 2025-04-30.basil"));
            let body = std::str::from_utf8(&bytes[header_end..header_end + length]).unwrap();
            if method == "POST" {
                assert_eq!(body, "cancel_at_period_end=true");
                assert!(
                    lowercase.contains(&format!("idempotency-key: {}", key.to_ascii_lowercase()))
                );
                value["canceled_at"] = json!(Utc::now().timestamp());
            } else {
                assert!(body.is_empty());
            }
            let response = serde_json::to_vec(&value).unwrap();
            stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: {}\r\n\r\n",response.len()).as_bytes()).await.unwrap();
            stream.write_all(&response).await.unwrap();
        }
    });
    (port, handle)
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL; serial only; synthetic provider HTTP stub"]
async fn financial_cancellation_result_projection_current_cas_and_history() {
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
    let f = Fixture::new(pg.clone()).await;
    let _environment = f.ledger.environment();
    let _flag = CancellationFlag::enabled();
    let operation = Uuid::now_v7();
    let request = f
        .repository()
        .accept(f.preparation(operation, f.owner).await)
        .await
        .unwrap();
    let account_lease = Uuid::now_v7();
    pg.execute("INSERT INTO team_stripe_runtime_status(account_id,livemode,lease_id,lease_until) VALUES($1,false,$2,clock_timestamp()+interval '3 minutes')",&[&f.scope.account,&account_lease]).await.unwrap();
    let (port, server) = server(
        &f.scope.account,
        &f.before,
        &request.idempotency_key().unwrap(),
    )
    .await;
    let client = StripeClient::fixture_guarded(port, &f.scope.account, f.ledger.guard.clone());
    let claim = f
        .repository()
        .claim_next(&f.account(), account_lease)
        .await
        .unwrap()
        .unwrap();
    let read = client
        .execute_cancellation_exchange(claim, ExchangeKind::ResourceRead)
        .await
        .unwrap_or_else(|_| panic!("synthetic cancellation read failed"));
    assert!(f.repository().project_result(&read).await.unwrap());
    let row=pg.query_one("SELECT revision,disposition,last_observation_id,first_attempt_at FROM team_subscription_cancellations WHERE operation_id=$1",&[&operation]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), 1);
    assert_eq!(row.get::<_, String>(1), "pending");
    assert_eq!(row.get::<_, Option<Uuid>>(2), Some(read.observation()));
    assert_eq!(row.get::<_, Option<DateTime<Utc>>>(3), None);
    let claim = f
        .repository()
        .claim_next(&f.account(), account_lease)
        .await
        .unwrap()
        .unwrap();
    let mutation = client
        .execute_cancellation_exchange(claim, ExchangeKind::Mutation)
        .await
        .unwrap_or_else(|_| panic!("synthetic cancellation mutation failed"));
    tokio::time::timeout(std::time::Duration::from_secs(10), server)
        .await
        .unwrap()
        .unwrap();
    f.ledger.guard.fail_transaction_confirmation_once();
    assert!(f.repository().project_result(&mutation).await.is_err());
    f.repository()
        .reconcile_history(&f.account())
        .await
        .unwrap();
    let sequence = f.ledger.guard.read().unwrap().sequence;
    assert!(!f.repository().project_result(&mutation).await.unwrap());
    assert!(!f.repository().project_result(&read).await.unwrap());
    assert_eq!(f.ledger.guard.read().unwrap().sequence, sequence);
    let row=pg.query_one("SELECT revision,disposition,last_observation_id,first_attempt_at,read_only FROM team_subscription_cancellations WHERE operation_id=$1",&[&operation]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), 1);
    assert_eq!(row.get::<_, String>(1), "provider_scheduled");
    assert_eq!(row.get::<_, Option<Uuid>>(2), Some(mutation.observation()));
    assert!(row.get::<_, Option<DateTime<Utc>>>(3).is_some());
    assert!(row.get::<_, bool>(4));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_subscription_cancellation_projections WHERE operation_id=$1",
            &[&operation]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    let state = f.ledger.guard.read().unwrap();
    let entry = &state.snapshot.sources.scopes[&f.scope.key().unwrap()];
    assert!(entry.unapplied_outcomes.is_empty());
    assert!(
        super::super::super::team_financial_inventory::preview(&pg, &f.ledger.guard, &f.scope)
            .await
            .unwrap()
            .independent_source_matches
    );
    let bytes = std::fs::read(f.ledger.path()).unwrap();
    let text = String::from_utf8(bytes).unwrap();
    assert!(!text.contains("PRIVATE_CANCELLATION_PROJECTION_MARKER"));
    assert!(!text.contains("rk_test_synthetic"));
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL; serial only; synthetic provider HTTP stub"]
async fn financial_cancellation_worker_original_send_scheduled_read_and_ticket_fences() {
    use crate::{
        repository::team_stripe::TeamStripeRepository, services::team_stripe_worker::StripeWorker,
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
    let f = Fixture::new(pg.clone()).await;
    let _environment = f.ledger.environment();
    let _flag = CancellationFlag::enabled();
    let operation = Uuid::now_v7();
    let request = f
        .repository()
        .accept(f.preparation(operation, f.owner).await)
        .await
        .unwrap();
    let (port, handle) = server(
        &f.scope.account,
        &f.before,
        &request.idempotency_key().unwrap(),
    )
    .await;
    let worker = StripeWorker::new(
        TeamStripeRepository::new_guarded(pg.clone(), f.ledger.deployment()),
        StripeClient::fixture_guarded(port, &f.scope.account, f.ledger.guard.clone()),
    );
    let result = worker.cancellation_tick().await.unwrap();
    assert_eq!(result.applied, 2);
    assert_eq!(result.deferred, 0);
    tokio::time::timeout(std::time::Duration::from_secs(10), handle)
        .await
        .unwrap()
        .unwrap();
    let original: DateTime<Utc> = pg
        .query_one(
            "SELECT first_attempt_at FROM team_subscription_cancellations WHERE operation_id=$1",
            &[&operation],
        )
        .await
        .unwrap()
        .get(0);
    assert!(worker.cancellation_tick().await.unwrap().idle);
    // Advance only the operational retry deadline, not any business evidence.
    pg.execute("UPDATE team_subscription_cancellations SET retry_at=clock_timestamp() WHERE operation_id=$1", &[&operation]).await.unwrap();
    let (port, handle) = server_mode(
        &f.scope.account,
        &f.before,
        &request.idempotency_key().unwrap(),
        true,
    )
    .await;
    let stripe = TeamStripeRepository::new_guarded(pg.clone(), f.ledger.deployment());
    let worker = StripeWorker::new(
        stripe.clone(),
        StripeClient::fixture_guarded(port, &f.scope.account, f.ledger.guard.clone()),
    );
    assert_eq!(worker.cancellation_tick().await.unwrap().applied, 1);
    tokio::time::timeout(std::time::Duration::from_secs(10), handle)
        .await
        .unwrap()
        .unwrap();
    let row=pg.query_one("SELECT disposition,read_only,first_attempt_at FROM team_subscription_cancellations WHERE operation_id=$1", &[&operation]).await.unwrap();
    assert_eq!(row.get::<_, String>(0), "provider_scheduled");
    assert!(row.get::<_, bool>(1));
    assert_eq!(row.get::<_, DateTime<Utc>>(2), original);
    let status = f
        .repository()
        .find_saved(f.owner, f.scope.organization, operation)
        .await
        .unwrap()
        .unwrap()
        .response()
        .await
        .unwrap();
    assert_eq!(status.provider_disposition, Some("provider_scheduled"));
    assert_eq!(status.state, "provider_scheduled");
    assert!(status.provider_observed_at.is_some());
    assert!(status.read_only);
    assert_eq!(status.worker_configured, Some(true));
    pg.execute("UPDATE team_subscription_cancellations SET retry_at=clock_timestamp() WHERE operation_id=$1", &[&operation]).await.unwrap();
    let account_lease = stripe
        .claim_scope(&f.scope.account, false)
        .await
        .unwrap()
        .unwrap();
    let claim = f
        .repository()
        .claim_next(&f.account(), account_lease)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(claim.preferred_kind().unwrap(), ExchangeKind::ResourceRead);
    let ticket = claim.ticket();
    let newer = Uuid::now_v7();
    pg.execute(
        "UPDATE team_stripe_runtime_status SET lease_id=$2 WHERE account_id=$1 AND NOT livemode",
        &[&f.scope.account, &newer],
    )
    .await
    .unwrap();
    assert!(f.repository().finish_attempt(&ticket, None).await.is_err());
    // A stale callback cannot release a different operation lease either.
    pg.execute(
        "UPDATE team_stripe_runtime_status SET lease_id=$2 WHERE account_id=$1 AND NOT livemode",
        &[&f.scope.account, &account_lease],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE team_subscription_cancellations SET lease_id=$2 WHERE operation_id=$1",
        &[&operation, &newer],
    )
    .await
    .unwrap();
    assert!(!f.repository().finish_attempt(&ticket, None).await.unwrap());
    let row=pg.query_one("SELECT lease_id,first_attempt_at FROM team_subscription_cancellations WHERE operation_id=$1", &[&operation]).await.unwrap();
    assert_eq!(row.get::<_, Uuid>(0), newer);
    assert_eq!(row.get::<_, DateTime<Utc>>(1), original);
    assert!(!String::from_utf8(std::fs::read(f.ledger.path()).unwrap())
        .unwrap()
        .contains("PRIVATE_CANCELLATION_PROJECTION_MARKER"));
}
