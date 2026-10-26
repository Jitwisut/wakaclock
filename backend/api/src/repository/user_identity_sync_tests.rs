use super::*;
use crate::{config::PostgresConfig, services::authorization::AuthorizationService};
use std::sync::Arc;
use tokio::time::{timeout, Duration};
async fn billing_wait(pg: &PostgresClient) {
    timeout(Duration::from_secs(5),async {
        loop {
            if pg.query_one("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT pg_advisory_xact_lock(hashtextextended($1,0))')",&[]).await.unwrap().get::<_,bool>(0) {break;}
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }).await.expect("identity sync did not wait on billing lock");
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn personal_identity_sync_billing_order_first_sync_race_and_atomic_retry() {
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
    let user = Uuid::now_v7();
    let username = user.to_string();
    let hash = "fixture_identity_hash_not_a_credential";
    // Force eight first-sync calls to observe absence before any is allowed to
    // write. Exactly one personal org/member/credential must remain after retry.
    let barrier = Arc::new(tokio::sync::Barrier::new(8));
    let mut tasks = Vec::new();
    for _ in 0..8 {
        let pg = pg.clone();
        let name = username.clone();
        let barrier = barrier.clone();
        tasks.push(tokio::spawn(async move {
            run(
                &pg,
                user,
                &name,
                hash,
                Options {
                    first_resolved: Some(barrier),
                    after_resolve: None,
                    ..Options::default()
                },
            )
            .await
        }));
    }
    for task in tasks {
        timeout(Duration::from_secs(10), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
    }
    let slug = format!("personal-{}", user.simple());
    let org: Uuid = pg
        .query_one(
            "SELECT id FROM organizations WHERE slug=$1 AND personal_owner_id=$2",
            &[&slug, &user],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(pg.query_one("SELECT count(*) FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role='owner' AND seat_type='developer'",&[&org,&user]).await.unwrap().get::<_,i64>(0),1);
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM password_credentials WHERE user_id=$1",
            &[&user]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    // Actual billing Owner lock must finish while identity is blocked on billing.
    // The previous user/org-upsert-first transaction forms a cycle here.
    let mut db = pg.transaction_client().await.unwrap();
    let tx = db.transaction().await.unwrap();
    super::super::team_financial_locks::organization(&tx, "acct_identity_fixture", false, org)
        .await
        .unwrap();
    let cloned = pg.clone();
    let name = username.clone();
    let task = tokio::spawn(async move { sync(&cloned, user, &name, hash).await });
    billing_wait(&pg).await;
    timeout(
        Duration::from_secs(2),
        AuthorizationService::require_locked_billing_owner(&tx, user, org),
    )
    .await
    .expect("identity sync holds a row ahead of billing")
    .unwrap();
    tx.commit().await.unwrap();
    timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    // A competing first-sync creates the org after discovery. Audit attempts;
    // all writes under the losing candidate must roll back before actual retry.
    let newcomer = Uuid::now_v7();
    let name = newcomer.to_string();
    let reached = Arc::new(tokio::sync::Notify::new());
    let proceed = Arc::new(tokio::sync::Notify::new());
    let cloned = pg.clone();
    let n = name.clone();
    let r = reached.clone();
    let p = proceed.clone();
    let task = tokio::spawn(async move {
        run(
            &cloned,
            newcomer,
            &n,
            hash,
            Options {
                first_resolved: None,
                after_resolve: Some((r, p)),
                ..Options::default()
            },
        )
        .await
    });
    timeout(Duration::from_secs(5), reached.notified())
        .await
        .unwrap();
    let actual = Uuid::now_v7();
    let slug = format!("personal-{}", newcomer.simple());
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&newcomer, &name],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO organizations(id,slug,name,personal_owner_id) VALUES($1,$2,'Identity race',$3)",&[&actual,&slug,&newcomer]).await.unwrap();
    pg.execute(
        "CREATE TABLE fixture_identity_updates(user_id UUID NOT NULL)",
        &[],
    )
    .await
    .unwrap();
    pg.execute("CREATE FUNCTION fixture_identity_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO fixture_identity_updates(user_id) VALUES(NEW.id); RETURN NEW; END $$",&[]).await.unwrap();
    pg.execute("CREATE TRIGGER fixture_identity_update AFTER UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fixture_identity_update()",&[]).await.unwrap();
    proceed.notify_one();
    timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM fixture_identity_updates WHERE user_id=$1",
            &[&newcomer]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1,
        "losing transaction must leave no update receipt"
    );
    pg.execute("DROP TRIGGER fixture_identity_update ON users", &[])
        .await
        .unwrap();
    pg.execute("DROP FUNCTION fixture_identity_update()", &[])
        .await
        .unwrap();
    pg.execute("DROP TABLE fixture_identity_updates", &[])
        .await
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT organization_id FROM organization_members WHERE user_id=$1",
            &[&newcomer]
        )
        .await
        .unwrap()
        .get::<_, Uuid>(0),
        actual
    );
    // A losing candidate already holds its user update when a real personal
    // org becomes visible. Financial holds that actual org FOR SHARE; conflict
    // resolution must not UPDATE it before deciding to roll back the candidate.
    let loser = Uuid::now_v7();
    let name = loser.to_string();
    let actual = Uuid::now_v7();
    let slug = format!("personal-{}", loser.simple());
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&loser, &name],
    )
    .await
    .unwrap();
    let resolved = Arc::new(tokio::sync::Notify::new());
    let start_writes = Arc::new(tokio::sync::Notify::new());
    let wrote_user = Arc::new(tokio::sync::Notify::new());
    let continue_org = Arc::new(tokio::sync::Notify::new());
    let cloned = pg.clone();
    let n = name.clone();
    let r = resolved.clone();
    let start = start_writes.clone();
    let w = wrote_user.clone();
    let p = continue_org.clone();
    let task = tokio::spawn(async move {
        run(
            &cloned,
            loser,
            &n,
            hash,
            Options {
                after_resolve: Some((r, start)),
                after_users: Some((w, p)),
                ..Options::default()
            },
        )
        .await
    });
    timeout(Duration::from_secs(5), resolved.notified())
        .await
        .unwrap();
    // FK validation itself needs a user key-share lock. Create the real org and
    // membership before allowing the losing candidate's key-changing UPSERT.
    pg.execute("INSERT INTO organizations(id,slug,name,personal_owner_id) VALUES($1,$2,'Losing identity candidate',$3)",&[&actual,&slug,&loser]).await.unwrap();
    pg.execute(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
        &[&actual, &loser],
    )
    .await
    .unwrap();
    let held = db.transaction().await.unwrap();
    super::super::team_financial_locks::organization(&held, "acct_identity_fixture", false, actual)
        .await
        .unwrap();
    held.query_one(
        "SELECT id FROM organizations WHERE id=$1 FOR SHARE",
        &[&actual],
    )
    .await
    .unwrap();
    start_writes.notify_one();
    timeout(Duration::from_secs(5), wrote_user.notified())
        .await
        .unwrap();
    continue_org.notify_one();
    timeout(
        Duration::from_secs(2),
        AuthorizationService::require_locked_billing_owner(&held, loser, actual),
    )
    .await
    .expect("losing identity candidate waited on actual org while holding user")
    .unwrap();
    held.commit().await.unwrap();
    timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT organization_id FROM organization_members WHERE user_id=$1",
            &[&loser]
        )
        .await
        .unwrap()
        .get::<_, Uuid>(0),
        actual
    );
    // Unexpected ownership cannot be converted into another person's Owner seat.
    let foreign = Uuid::now_v7();
    let foreign_user = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&foreign_user, &foreign_user.to_string()],
    )
    .await
    .unwrap();
    let foreign_slug = format!("personal-{}", foreign.simple());
    pg.execute(
        "INSERT INTO organizations(id,slug,name,personal_owner_id) VALUES($1,$2,'Owner fence',$3)",
        &[&Uuid::now_v7(), &foreign_slug, &foreign_user],
    )
    .await
    .unwrap();
    assert!(sync(&pg, foreign, &foreign.to_string(), hash)
        .await
        .is_err());
    assert!(pg
        .query_opt("SELECT 1 FROM users WHERE id=$1", &[&foreign])
        .await
        .unwrap()
        .is_none());
    // Failure after user/credential/org writes commits none of them.
    pg.execute("ALTER TABLE organization_members ADD CONSTRAINT fixture_identity_membership_failure CHECK(false) NOT VALID",&[]).await.unwrap();
    let doomed = Uuid::now_v7();
    assert!(sync(&pg, doomed, &doomed.to_string(), hash).await.is_err());
    pg.execute(
        "ALTER TABLE organization_members DROP CONSTRAINT fixture_identity_membership_failure",
        &[],
    )
    .await
    .unwrap();
    assert!(pg
        .query_opt("SELECT 1 FROM users WHERE id=$1", &[&doomed])
        .await
        .unwrap()
        .is_none());
    assert!(pg
        .query_opt(
            "SELECT 1 FROM organizations WHERE personal_owner_id=$1",
            &[&doomed]
        )
        .await
        .unwrap()
        .is_none());
}
