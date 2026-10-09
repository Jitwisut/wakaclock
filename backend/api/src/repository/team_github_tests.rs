//! Run only against the isolated local staging test database.
use super::team_github::GithubRepositoryStore;
use crate::{
    config::PostgresConfig,
    infrastructure::postgres::PostgresClient,
    model::team_github::{GithubRepository, ProjectBinding, SessionContext},
    services::team_webhooks::GithubMetadata,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn github_binding_queue_context_and_revocation() {
    let url = std::env::var("POSTGRES_TEST_URL").expect("isolated database required");
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_test")
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
    let store = GithubRepositoryStore::new(pg.clone());
    let org = Uuid::now_v7();
    let other = Uuid::now_v7();
    let user = Uuid::now_v7();
    let member = Uuid::now_v7();
    let install = (user.as_u128() % 1_000_000_000) as i64 + 1;
    for id in [user, member] {
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&id, &id.to_string()],
        )
        .await
        .unwrap();
    }
    for id in [org, other] {
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'isolated GitHub test')",
            &[&id, &id.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')",&[&id,&user]).await.unwrap();
        pg.execute("INSERT INTO team_rollouts(organization_id,enabled) VALUES($1,true) ON CONFLICT(organization_id) DO UPDATE SET enabled=true",&[&id]).await.unwrap();
    }
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'member','developer')",&[&org,&member]).await.unwrap();
    let repos = [GithubRepository {
        id: install,
        node_id: "test-node".into(),
        full_name: "fixture/private".into(),
        default_branch: Some("main".into()),
        permissions: None,
    }];
    assert!(store
        .select(member, org, install, 1, "fixture", &repos, None)
        .await
        .is_err());
    store
        .select(user, org, install, 1, "fixture", &repos, None)
        .await
        .unwrap();
    assert!(store
        .select(user, other, install, 1, "fixture", &repos, None)
        .await
        .is_err());
    let repo:Uuid=pg.query_one("SELECT repository_id FROM team_repository_scopes WHERE organization_id=$1 AND github_repository_id=$2",&[&org,&install]).await.unwrap().get(0);
    // Installations serialize even across independent database connections/processes.
    let first = store.claim().await.unwrap().unwrap();
    assert_eq!(first.installation, install);
    assert!(store.claim().await.unwrap().is_none());
    pg.execute("UPDATE team_github_installations SET lease_until=now()-interval '1 second' WHERE installation_id=$1",&[&install]).await.unwrap();
    pg.execute(
        "UPDATE team_github_sync_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
        &[&first.id],
    )
    .await
    .unwrap();
    let resumed = store.claim().await.unwrap().unwrap();
    assert_eq!(resumed.id, first.id);
    assert_ne!(resumed.lease, first.lease);
    assert!(store.renew(&first).await.is_err());
    store
        .commit_sync(
            &resumed,
            &[],
            &[],
            &serde_json::json!({"phase":"open_issues"}),
            false,
        )
        .await
        .unwrap();
    let continued = store.claim().await.unwrap().unwrap();
    assert_eq!(continued.checkpoint["phase"], "open_issues");
    store
        .commit_sync(
            &continued,
            &[],
            &[],
            &serde_json::json!({"phase":"done"}),
            true,
        )
        .await
        .unwrap();
    assert!(store
        .commit_sync(&continued, &[], &[], &serde_json::json!({}), true)
        .await
        .is_err());
    store
        .create_attempt(user, org, "state", b"sealed", "session-a")
        .await
        .unwrap();
    assert!(store
        .consume_attempt(member, "state", "session-a")
        .await
        .is_err());
    assert!(store
        .consume_attempt(user, "state", "session-b")
        .await
        .is_err());
    assert!(store
        .consume_attempt(user, "state", "session-a")
        .await
        .is_ok());
    assert!(store
        .consume_attempt(user, "state", "session-a")
        .await
        .is_err());
    // Provider observations never regress a completed check to an older pending event.
    let now = Utc::now();
    let at = now - chrono::Duration::minutes(1);
    let mut client = pg.transaction_client().await.unwrap();
    let tx = client.transaction().await.unwrap();
    let mut fact = super::team_github::SyncFact {
        kind: "check_run".into(),
        external_id: "42".into(),
        work_item: None,
        at,
        metadata: serde_json::json!({"head_sha":"a".repeat(40),"status":"completed","conclusion":"success","source_at":at}),
    };
    super::team_github::upsert_fact(&tx, org, repo, &fact, now)
        .await
        .unwrap();
    fact.at -= chrono::Duration::minutes(1);
    fact.metadata["status"] = serde_json::json!("in_progress");
    super::team_github::upsert_fact(&tx, org, repo, &fact, now + chrono::Duration::seconds(1))
        .await
        .unwrap();
    fact.at = now;
    fact.metadata["source_at"] = serde_json::Value::Null;
    super::team_github::upsert_fact(&tx, org, repo, &fact, now + chrono::Duration::seconds(2))
        .await
        .unwrap();
    let saved:serde_json::Value=tx.query_one("SELECT metadata FROM team_github_facts WHERE organization_id=$1 AND repository_id=$2 AND kind='check_run' AND external_id='42'",&[&org,&repo]).await.unwrap().get(0);
    assert_eq!(saved["status"], "completed");
    fact.kind = "review".into();
    fact.external_id = "43".into();
    fact.at = at;
    fact.metadata = serde_json::json!({"state":"DISMISSED","author_type":"User","author_id":5});
    super::team_github::upsert_fact(&tx, org, repo, &fact, now)
        .await
        .unwrap();
    fact.metadata["state"] = serde_json::json!("APPROVED");
    super::team_github::upsert_fact(&tx, org, repo, &fact, now + chrono::Duration::seconds(1))
        .await
        .unwrap();
    let saved:serde_json::Value=tx.query_one("SELECT metadata FROM team_github_facts WHERE organization_id=$1 AND repository_id=$2 AND kind='review' AND external_id='43'",&[&org,&repo]).await.unwrap().get(0);
    assert_eq!(saved["state"], "DISMISSED");
    tx.commit().await.unwrap();
    let webhook = crate::repository::team_webhooks::TeamWebhookRepository::new(pg.clone());
    let mut work_event = GithubMetadata {
        event: "pull_request".into(),
        action: "synchronize".into(),
        installation_id: install,
        repository_id: Some(install),
        item: Some(crate::services::team_webhooks::WorkItemMetadata {
            external_id: 900,
            number: 9,
            kind: "pull_request".into(),
            state: "open".into(),
            branch: Some("fixture/task".into()),
            author_id: Some(1),
            opened_at: at - chrono::Duration::minutes(1),
            updated_at: at,
            ready_at: None,
            merged_at: None,
            closed_at: None,
        }),
        review_at: None,
        details: Some(crate::services::team_webhooks::GithubDetails {
            head_sha: Some("a".repeat(40)),
            head_repository_id: Some(install),
            draft: Some(false),
            ..Default::default()
        }),
    };
    webhook
        .accept_github(&format!("{org}-new-pr"), "new-pr", &work_event)
        .await
        .unwrap();
    assert!(store.health(org).await.unwrap().pending.unwrap() >= 1);

    assert!(webhook.process_github().await.unwrap());
    work_event.item.as_mut().unwrap().state = "closed".into();
    work_event.item.as_mut().unwrap().updated_at = at + chrono::Duration::seconds(10);
    work_event.item.as_mut().unwrap().closed_at = Some(at + chrono::Duration::seconds(10));
    webhook
        .accept_github(&format!("{org}-closed-pr"), "closed-pr", &work_event)
        .await
        .unwrap();
    assert!(webhook.process_github().await.unwrap());
    // Equal-second, contradictory state is unconfirmed until canonical API reconciliation.
    work_event.item.as_mut().unwrap().state = "open".into();
    work_event.details.as_mut().unwrap().head_sha = Some("b".repeat(40));
    webhook
        .accept_github(&format!("{org}-ambiguous-pr"), "ambiguous-pr", &work_event)
        .await
        .unwrap();
    assert!(webhook.process_github().await.unwrap());
    let saved=pg.query_one("SELECT state,head_sha,lifecycle_coverage FROM team_work_items WHERE organization_id=$1 AND repository_id=$2 AND external_id=900",&[&org,&repo]).await.unwrap();
    assert_eq!(saved.get::<_, String>(0), "closed");
    assert_eq!(saved.get::<_, String>(1), "a".repeat(40));
    assert_eq!(saved.get::<_, String>(2), "unconfirmed");
    pg.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,number,kind,state,opened_at,provider_updated_at) SELECT $1,$2,1000+n,n,'issue','open',now(),now() FROM generate_series(1,205) n",&[&org,&repo]).await.unwrap();
    let mut after = None;
    let mut seen = std::collections::BTreeSet::new();
    loop {
        let page = store
            .work_page(
                org,
                &crate::model::team_github::GithubWorkQuery {
                    team_id: None,
                    after,
                    limit: Some(100),
                },
            )
            .await
            .unwrap();
        for item in page["items"].as_array().unwrap() {
            assert!(seen.insert(item["external_id"].as_i64().unwrap()));
        }
        after = page["next"].as_str().map(str::to_string);
        if after.is_none() {
            break;
        }
    }
    assert_eq!(seen.len(), 206);
    let failed_delivery = format!("{org}-dead-letter");
    webhook
        .accept_github(&failed_delivery, "failed-delivery", &work_event)
        .await
        .unwrap();
    pg.execute("UPDATE team_webhook_inbox SET dead_letter_at=now(),error_code='metadata_schema' WHERE provider='github' AND delivery_id=$1",&[&failed_delivery]).await.unwrap();
    let health = store.health(org).await.unwrap();
    assert_eq!(health.status, "degraded");
    assert_eq!(health.reason, "dead_letter");
    pg.execute("UPDATE team_webhook_inbox SET processed_at=now() WHERE provider='github' AND delivery_id=$1",&[&failed_delivery]).await.unwrap();
    // Same project label does not bind across people: each personal UUID is explicit.
    let p1 = Uuid::now_v7();
    let p2 = Uuid::now_v7();
    for (u, p) in [(user, p1), (member, p2)] {
        store
            .binding(
                org,
                u,
                &ProjectBinding {
                    project_id: p,
                    repository_id: repo,
                },
            )
            .await
            .unwrap();
        pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,true,true)",&[&org,&u]).await.unwrap();
    }
    let mut event = SessionContext {
        event_id: "a".repeat(64),
        session_id: "b".repeat(64),
        collector_id: Uuid::now_v7(),
        project_id: p1,
        repository_id: repo,
        occurred_at: Utc::now(),
        branch: Some("fixture/task".into()),
        commit_sha: Some("c".repeat(40)),
        provenance: "native_session_git".into(),
    };
    store.context(org, user, &event, "hash").await.unwrap();
    store.context(org, user, &event, "hash").await.unwrap();
    assert!(store.context(org, user, &event, "changed").await.is_err());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_session_contexts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    event.event_id = "d".repeat(64);
    assert!(store.context(org, member, &event, "hash2").await.is_err());
    pg.execute("UPDATE organization_analytics_consents SET share_individual=false WHERE organization_id=$1 AND user_id=$2",&[&org,&user]).await.unwrap();
    assert!(store.context(org, user, &event, "hash2").await.is_err());
    // A receipt must close as soon as the signed removal is durably accepted.
    let webhook = crate::repository::team_webhooks::TeamWebhookRepository::new(pg.clone());
    webhook
        .accept_github(
            &format!("remove-{org}"),
            "signed-hash",
            &GithubMetadata {
                event: "installation".into(),
                action: "suspend".into(),
                installation_id: install,
                repository_id: None,
                item: None,
                review_at: None,
                details: None,
            },
        )
        .await
        .unwrap();
    assert!(!pg.query_one("SELECT enabled FROM team_repository_scopes WHERE organization_id=$1 AND repository_id=$2",&[&org,&repo]).await.unwrap().get::<_,bool>(0));
    assert!(webhook.process_github().await.unwrap());
    pg.execute(
        "DELETE FROM organizations WHERE id=ANY($1)",
        &[&vec![org, other]],
    )
    .await
    .unwrap();
    pg.execute("DELETE FROM users WHERE id=ANY($1)", &[&vec![user, member]])
        .await
        .unwrap();
}
