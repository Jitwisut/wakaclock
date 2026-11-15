//! Durable revocation in both supported identity-store modes. No raw tokens.
use crate::infrastructure::postgres::PostgresClient;
use anyhow::Result;
use uuid::Uuid;

pub async fn migrate(client: &clickhouse::Client) -> Result<()> {
    client
        .query(
            "CREATE TABLE IF NOT EXISTS wakaclock.session_revocations (
        user_id UUID, token_hash String, expires_at DateTime
    ) ENGINE = MergeTree ORDER BY (user_id, token_hash) TTL expires_at DELETE",
        )
        .execute()
        .await?;
    Ok(())
}

pub async fn revoke(
    postgres: Option<&PostgresClient>,
    client: &clickhouse::Client,
    user_id: Uuid,
    token_hash: &str,
    expires_at: i64,
) -> Result<()> {
    if let Some(postgres) = postgres {
        postgres.client().execute(
            "UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1 AND token_hash = $2",
            &[&user_id, &token_hash],
        ).await?;
    } else {
        // Synchronous insert: an ACK means subsequent readers see the tombstone.
        client.clone().with_option("async_insert", "0").query("INSERT INTO wakaclock.session_revocations (user_id, token_hash, expires_at) VALUES (?, ?, toDateTime(?))")
            .bind(user_id).bind(token_hash).bind(expires_at).execute().await?;
    }
    Ok(())
}
