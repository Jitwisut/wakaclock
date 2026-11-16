use crate::infrastructure::postgres::PostgresClient;
use crate::middleware::auth::SessionRevocation;
use anyhow::Result;

pub async fn revoke(
    postgres: Option<&PostgresClient>,
    client: &clickhouse::Client,
    session: SessionRevocation,
) -> Result<()> {
    crate::repository::session_revocation::revoke(
        postgres,
        client,
        session.user_id,
        &session.token_hash,
        session.expires_at,
    )
    .await
}
