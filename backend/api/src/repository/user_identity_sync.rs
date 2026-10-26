//! Personal identity transaction. Billing lock precedes all user/org row writes.
//! Auth/heartbeat/API-key semantics remain in UserService and are not changed here.
use crate::infrastructure::postgres::PostgresClient;
use anyhow::{ensure, Context, Result};
use uuid::Uuid;

#[derive(Default)]
struct Options {
    #[cfg(test)]
    first_resolved: Option<std::sync::Arc<tokio::sync::Barrier>>,
    #[cfg(test)]
    after_resolve: Option<(
        std::sync::Arc<tokio::sync::Notify>,
        std::sync::Arc<tokio::sync::Notify>,
    )>,
    #[cfg(test)]
    after_users: Option<(
        std::sync::Arc<tokio::sync::Notify>,
        std::sync::Arc<tokio::sync::Notify>,
    )>,
}

pub(crate) async fn sync(
    postgres: &PostgresClient,
    user_id: Uuid,
    username: &str,
    password_hash: &str,
) -> Result<()> {
    run(
        postgres,
        user_id,
        username,
        password_hash,
        Options::default(),
    )
    .await
}
async fn run(
    postgres: &PostgresClient,
    user_id: Uuid,
    username: &str,
    password_hash: &str,
    _options: Options,
) -> Result<()> {
    let slug = format!("personal-{}", user_id.simple());
    // A concurrent first-sync may win with a different UUID after discovery.
    // Roll back our writes and retry from that observed ID; never take a second
    // billing lock while holding user/org rows under the first candidate lock.
    for _attempt in 0..3 {
        let mut db = postgres.transaction_client().await?;
        let tx = db.transaction().await?;
        let found = tx
            .query_opt(
                "SELECT id,personal_owner_id FROM organizations WHERE slug=$1",
                &[&slug],
            )
            .await
            .context("failed to resolve personal PostgreSQL organization")?;
        if let Some(row) = &found {
            ensure!(
                row.get::<_, Option<Uuid>>(1) == Some(user_id),
                "personal identity owner mismatch"
            );
        }
        let candidate = found.map_or_else(Uuid::now_v7, |r| r.get(0));
        #[cfg(test)]
        if _attempt == 0 {
            if let Some(barrier) = &_options.first_resolved {
                barrier.wait().await;
            }
            if let Some((reached, proceed)) = &_options.after_resolve {
                reached.notify_one();
                proceed.notified().await;
            }
        }
        // Concurrent first-sync contenders can discover different candidate
        // orgs but target the same users PK/username unique indexes. Serialize
        // only that immutable user ID before any row write; never infer an ID
        // from a colliding username or acquire this lock after a row lock.
        tx.query_one(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,$2))",
            &[&format!("identity-sync:v1:{user_id}"), &83_761_i64],
        )
        .await?;
        super::team_seats::lock(&tx, candidate).await?;
        tx.execute("INSERT INTO users(id,username,is_active) VALUES($1,$2,TRUE) ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username,updated_at=now()",&[&user_id,&username]).await.context("failed to upsert PostgreSQL user")?;
        tx.execute("INSERT INTO password_credentials(user_id,password_hash) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=now()",&[&user_id,&password_hash]).await.context("failed to upsert PostgreSQL password credential")?;
        #[cfg(test)]
        if _attempt == 0 {
            if let Some((reached, proceed)) = &_options.after_users {
                reached.notify_one();
                proceed.notified().await;
            }
        }
        // Never UPDATE a conflicting actual org under a candidate's lock: a
        // financial writer may hold that org FOR SHARE while waiting on our
        // user row. DO NOTHING + plain SELECT can resolve it without the cycle.
        let inserted=tx.query_opt("INSERT INTO organizations(id,slug,name,personal_owner_id) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO NOTHING RETURNING id,personal_owner_id",&[&candidate,&slug,&format!("{username}'s AtoAxis"),&user_id]).await.context("failed to create personal PostgreSQL organization")?;
        let resolved = match inserted {
            Some(row) => Some(row),
            None => {
                tx.query_opt(
                    "SELECT id,personal_owner_id FROM organizations WHERE slug=$1",
                    &[&slug],
                )
                .await?
            }
        };
        let Some(row) = resolved else {
            tx.rollback().await?;
            continue;
        };
        let actual: Uuid = row.get(0);
        ensure!(
            row.get::<_, Option<Uuid>>(1) == Some(user_id),
            "personal identity owner mismatch"
        );
        if actual != candidate {
            tx.rollback().await?;
            continue;
        }
        tx.execute(
            "UPDATE organizations SET updated_at=now() WHERE id=$1",
            &[&actual],
        )
        .await?;
        super::team_seats::admit(&tx, actual, user_id, "owner", "developer").await?;
        tx.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer') ON CONFLICT(organization_id,user_id) DO UPDATE SET role='owner',seat_type='developer',deactivated_at=NULL",&[&actual,&user_id]).await.context("failed to add user to personal PostgreSQL organization")?;
        tx.commit().await?;
        return Ok(());
    }
    anyhow::bail!("personal identity changed during synchronization; retry required")
}

#[cfg(test)]
#[path = "user_identity_sync_tests.rs"]
mod tests;
