use crate::infrastructure::postgres::PostgresClient;
use anyhow::Result;
use chrono::{DateTime, Utc};

pub enum Allocation {
    Issued,
    MissingClient,
    ConfidentialClient,
    Capacity,
}

pub async fn allocate(
    pg: &PostgresClient,
    client_id: &str,
    hash: &str,
    user_code: &str,
    scopes: &[String],
    expires: DateTime<Utc>,
    limit: i64,
) -> Result<Allocation> {
    let mut connection = pg.transaction_client().await?;
    let tx = connection.transaction().await?;
    // Bounded cleanup, including inactive clients. Skip rows another request is using.
    tx.execute("DELETE FROM oauth_device_codes WHERE device_code_hash IN (
        SELECT device_code_hash FROM oauth_device_codes WHERE expires_at <= now() OR consumed_at IS NOT NULL
        ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)", &[]).await?;
    // Serialize allocations per registered client across all API replicas.
    let Some(app) = tx.query_opt("SELECT id,is_confidential FROM oauth_apps WHERE client_id=$1 AND revoked_at IS NULL FOR UPDATE", &[&client_id]).await? else {
        tx.commit().await?; return Ok(Allocation::MissingClient);
    };
    if app.get::<_, bool>("is_confidential") {
        tx.commit().await?;
        return Ok(Allocation::ConfidentialClient);
    }
    let app_id: uuid::Uuid = app.get("id");
    let count: i64 = tx.query_one("SELECT count(*) FROM oauth_device_codes WHERE app_id=$1 AND expires_at>now() AND consumed_at IS NULL", &[&app_id]).await?.get(0);
    if count >= limit {
        tx.commit().await?;
        return Ok(Allocation::Capacity);
    }
    tx.execute("INSERT INTO oauth_device_codes (device_code_hash,user_code,app_id,scopes,expires_at) VALUES($1,$2,$3,$4,$5)", &[&hash,&user_code,&app_id,&scopes,&expires]).await?;
    tx.commit().await?;
    Ok(Allocation::Issued)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use uuid::Uuid;
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn device_capacity_is_atomic_and_expired_records_are_cleaned() {
        let config = crate::config::PostgresConfig {
            url: Some(std::env::var("POSTGRES_TEST_URL").unwrap()),
            max_connections: 8,
        };
        let pg = Arc::new(PostgresClient::connect(&config).await.unwrap());
        pg.migrate().await.unwrap();
        let user = Uuid::now_v7();
        pg.client()
            .execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&user, &format!("device-{user}")],
            )
            .await
            .unwrap();
        let service = crate::services::oauth::OAuthService::new(Some(pg.clone()));
        let app = service
            .register_app(
                user,
                "capacity fixture",
                &["https://example.com/callback".into()],
                false,
            )
            .await
            .unwrap();
        let mut tasks = Vec::new();
        for _ in 0..8 {
            let pg = pg.clone();
            let id = app.client_id.clone();
            tasks.push(tokio::spawn(async move {
                let code = Uuid::new_v4().to_string();
                allocate(
                    &pg,
                    &id,
                    &code,
                    &code,
                    &["read_logged_time".into()],
                    Utc::now() + chrono::Duration::minutes(10),
                    3,
                )
                .await
                .unwrap()
            }));
        }
        let mut issued = 0;
        for task in tasks {
            match task.await.unwrap() {
                Allocation::Issued => issued += 1,
                Allocation::Capacity => {}
                _ => panic!("unexpected client result"),
            }
        }
        assert_eq!(issued, 3);
        pg.client().execute("UPDATE oauth_device_codes SET expires_at=now()-interval '1 minute' WHERE app_id=(SELECT id FROM oauth_apps WHERE client_id=$1)", &[&app.client_id]).await.unwrap();
        let response = service
            .issue_device_code(
                &app.client_id,
                &["read_logged_time".into()],
                "https://example.com/device",
            )
            .await
            .unwrap();
        assert!(!response.device_code.is_empty());
        let count: i64 = pg.client().query_one("SELECT count(*) FROM oauth_device_codes WHERE app_id=(SELECT id FROM oauth_apps WHERE client_id=$1)", &[&app.client_id]).await.unwrap().get(0);
        assert_eq!(count, 1);
        pg.client()
            .execute("DELETE FROM users WHERE id=$1", &[&user])
            .await
            .unwrap();
    }
}
