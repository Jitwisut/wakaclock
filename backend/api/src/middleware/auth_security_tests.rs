use super::*;
use crate::{config::PostgresConfig, infrastructure::postgres::PostgresClient};

fn headers(token: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::AUTHORIZATION,
        format!("Bearer {token}").parse().unwrap(),
    );
    headers
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn postgres_logout_is_durable_idempotent_and_scoped() {
    let url = std::env::var("POSTGRES_TEST_URL").expect("isolated PostgreSQL required");
    let config = PostgresConfig {
        url: Some(url.clone()),
        max_connections: 2,
    };
    let pg = PostgresClient::connect(&config).await.unwrap();
    pg.migrate().await.unwrap();
    let user = Uuid::now_v7();
    pg.client()
        .execute(
            "INSERT INTO users (id,username) VALUES($1,$2)",
            &[&user, &format!("logout-{user}")],
        )
        .await
        .unwrap();
    let secret = "session-test-secret";
    let token = issue_session_token(user, secret).unwrap();
    let other_token = issue_session_token(user, secret).unwrap();
    for token in [&token, &other_token] {
        pg.client().execute("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '24 hours')", &[&Uuid::now_v7(), &user, &hash_key(token)]).await.unwrap();
    }
    let ch = clickhouse::Client::default().with_url("http://127.0.0.1:1");
    assert!(
        resolve_credentials(Some(&pg), ch.clone(), secret, &headers(&token))
            .await
            .unwrap()
            .is_some()
    );
    for _ in 0..2 {
        crate::services::session_revocation::revoke(
            Some(&pg),
            &ch,
            session_to_revoke(&headers(&token), secret).unwrap(),
        )
        .await
        .unwrap();
    }
    let restarted = PostgresClient::connect(&config).await.unwrap();
    assert!(
        resolve_credentials(Some(&restarted), ch.clone(), secret, &headers(&token))
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        resolve_credentials(Some(&restarted), ch.clone(), secret, &headers(&other_token))
            .await
            .unwrap()
            .is_some()
    );
    assert!(session_to_revoke(&headers(&generate_key()), secret).is_none());
    assert!(session_to_revoke(&headers(&token), "wrong-secret").is_none());
    // A database/schema failure must not become a credential rejection.
    let broken = PostgresClient::connect(&PostgresConfig {
        url: Some(format!(
            "{url}{}options=-csearch_path%3Dmissing_auth_fixture",
            if url.contains('?') { "&" } else { "?" }
        )),
        max_connections: 1,
    })
    .await
    .unwrap();
    for token in [&token, &generate_key()] {
        assert_eq!(
            resolve_credentials(Some(&broken), ch.clone(), secret, &headers(token))
                .await
                .unwrap_err()
                .0,
            axum::http::StatusCode::SERVICE_UNAVAILABLE
        );
    }
    pg.client()
        .execute("DELETE FROM users WHERE id=$1", &[&user])
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires isolated CLICKHOUSE_TEST_URL"]
async fn clickhouse_logout_is_durable_and_preserves_other_sessions() {
    let store = crate::test_support::clickhouse_client().await;
    crate::repository::heartbeat::HeartbeatRepository::new(store.clone())
        .migrate()
        .await
        .unwrap();
    crate::repository::analytics::AnalyticsRepository::new(store.clone())
        .migrate()
        .await
        .unwrap();
    let ch = store.get_client();
    crate::repository::session_revocation::migrate(&ch)
        .await
        .unwrap();
    crate::repository::session_revocation::migrate(&ch)
        .await
        .unwrap();
    let user = Uuid::now_v7();
    ch.query("INSERT INTO wakaclock.users (user_id,username,api_key) VALUES (?,?,'')")
        .bind(user)
        .bind(format!("logout-{user}"))
        .execute()
        .await
        .unwrap();
    let secret = "session-test-secret";
    let token = issue_session_token(user, secret).unwrap();
    let other = issue_session_token(user, secret).unwrap();
    assert!(
        resolve_credentials(None, ch.clone(), secret, &headers(&token))
            .await
            .unwrap()
            .is_some()
    );
    for _ in 0..2 {
        crate::services::session_revocation::revoke(
            None,
            &ch,
            session_to_revoke(&headers(&token), secret).unwrap(),
        )
        .await
        .unwrap();
    }
    let restarted = store.get_client();
    assert!(
        resolve_credentials(None, restarted.clone(), secret, &headers(&token))
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        resolve_credentials(None, restarted, secret, &headers(&other))
            .await
            .unwrap()
            .is_some()
    );
}
