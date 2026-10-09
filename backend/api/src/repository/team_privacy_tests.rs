//! Destructive tests require an explicitly isolated database; never use POSTGRES_URL.
use crate::{config::PostgresConfig, infrastructure::postgres::PostgresClient};
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn consent_lifecycle_and_webhook_durability() {
    let url = std::env::var("POSTGRES_TEST_URL").expect("isolated POSTGRES_TEST_URL required");
    assert!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname() == Some("atoaxis_team_test"),
        "refuse a database not named atoaxis_team_test"
    );
    let pg = PostgresClient::connect(&PostgresConfig {
        url: Some(url),
        max_connections: 4,
    })
    .await
    .unwrap();
    pg.migrate().await.unwrap();
    pg.migrate().await.unwrap(); // Idempotent boot; opt-ins must not advance on restart.
    let org = Uuid::now_v7();
    let user = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id, username, email) VALUES($1,$2,$3)",
        &[
            &user,
            &format!("team-test-{user}"),
            &format!("{user}@example.test"),
        ],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organizations(id, slug, name) VALUES($1,$2,'Test')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')", &[&org, &user]).await.unwrap();
    pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual)
        VALUES($1,$2,true,true)", &[&org, &user]).await.unwrap();
    let row = pg.query_one("SELECT consent_version, aggregate_from, individual_from FROM organization_analytics_consents
        WHERE organization_id=$1 AND user_id=$2", &[&org, &user]).await.unwrap();
    let version: i64 = row.get("consent_version");
    let from: chrono::DateTime<chrono::Utc> = row.get("aggregate_from");
    assert_eq!(version, 1);
    assert!(row
        .get::<_, Option<chrono::DateTime<chrono::Utc>>>("individual_from")
        .is_some());
    pg.execute(
        "UPDATE organization_analytics_consents SET share_aggregate=true, share_individual=true
        WHERE organization_id=$1 AND user_id=$2",
        &[&org, &user],
    )
    .await
    .unwrap();
    pg.migrate().await.unwrap();
    let row = pg
        .query_one(
            "SELECT consent_version, aggregate_from FROM organization_analytics_consents
        WHERE organization_id=$1 AND user_id=$2",
            &[&org, &user],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, i64>("consent_version"), version);
    assert_eq!(
        row.get::<_, chrono::DateTime<chrono::Utc>>("aggregate_from"),
        from
    );
    pg.execute("UPDATE organization_members SET deactivated_at=now() WHERE organization_id=$1 AND user_id=$2", &[&org, &user]).await.unwrap();
    pg.execute("UPDATE organization_members SET deactivated_at=NULL WHERE organization_id=$1 AND user_id=$2", &[&org, &user]).await.unwrap();
    let row = pg.query_one("SELECT share_aggregate,share_individual,aggregate_from FROM organization_analytics_consents
        WHERE organization_id=$1 AND user_id=$2", &[&org, &user]).await.unwrap();
    assert!(!row.get::<_, bool>("share_aggregate"));
    assert!(!row.get::<_, bool>("share_individual"));
    assert!(row
        .get::<_, Option<chrono::DateTime<chrono::Utc>>>("aggregate_from")
        .is_none());
    let pg = std::sync::Arc::new(pg);
    let authorization = crate::services::authorization::AuthorizationService::new(Some(pg.clone()));
    let member = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&member, &member.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organization_members(organization_id,user_id,role,seat_type)
        VALUES($1,$2,'member','developer')",
        &[&org, &member],
    )
    .await
    .unwrap();
    let team = Uuid::now_v7();
    let other_team = Uuid::now_v7();
    for id in [team, other_team] {
        pg.execute(
            "INSERT INTO teams(id,organization_id,name,slug) VALUES($1,$2,'Team',$3)",
            &[&id, &org, &id.to_string()],
        )
        .await
        .unwrap();
    }
    pg.execute(
        "INSERT INTO team_members(team_id,user_id,role) VALUES($1,$2,'lead')",
        &[&team, &member],
    )
    .await
    .unwrap();
    assert!(authorization
        .require_team_read(member, org, Some(team))
        .await
        .is_ok());
    assert!(authorization
        .require_team_read(member, org, Some(other_team))
        .await
        .is_err());
    assert!(authorization
        .require_team_read(member, org, None)
        .await
        .is_err());
    assert!(authorization
        .require_team_read(user, org, Some(other_team))
        .await
        .is_ok());
    let foreign_org = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Other')",
        &[&foreign_org, &foreign_org.to_string()],
    )
    .await
    .unwrap();
    assert!(authorization
        .require_team_read(user, foreign_org, Some(team))
        .await
        .is_err());
    let repo_id = Uuid::now_v7();
    let project = Uuid::now_v7();
    assert!(pg
        .execute(
            "INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,
        github_installation_id,project_id,team_id) VALUES($1,$2,90001,90001,$3,$4)",
            &[&foreign_org, &repo_id, &project, &team]
        )
        .await
        .is_err());
    // A rolled-back reader cannot see an earlier generation as current.
    let generation: i64 = pg
        .query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get("generation");
    pg.execute(
        "INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate)
        VALUES($1,$2,true)",
        &[&org, &member],
    )
    .await
    .unwrap();
    let changed: i64 = pg
        .query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get("generation");
    assert!(changed > generation);
    pg.execute("UPDATE organization_members SET seat_type='viewer' WHERE organization_id=$1 AND user_id=$2", &[&org, &member]).await.unwrap();
    assert!(!pg.query_one("SELECT share_aggregate FROM organization_analytics_consents WHERE organization_id=$1 AND user_id=$2", &[&org, &member]).await.unwrap().get::<_,bool>("share_aggregate"));
    let repo = crate::repository::team_webhooks::TeamWebhookRepository::new(pg.clone());
    let ch = std::sync::Arc::new(
        crate::infrastructure::database::ClickHouseClient::new(&crate::config::ClickHouseConfig {
            url: "http://127.0.0.1:1".into(),
            database: "unused_test".into(),
            user: None,
            password: None,
        })
        .await
        .unwrap(),
    ); // Lazy client; this test never calls ClickHouse.
    let links = crate::repository::team_insights::TeamInsightsRepository::new(pg.clone(), ch);
    pg.execute(
        "UPDATE organization_analytics_consents SET share_aggregate=true,share_individual=true
        WHERE organization_id=$1 AND user_id=$2",
        &[&org, &user],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,
        github_installation_id,project_id,team_id,enabled) VALUES($1,$2,90001,90001,$3,$4,true)",
        &[&org, &repo_id, &project, &team],
    )
    .await
    .unwrap();
    for item in [1i64, 2i64] {
        pg.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,kind,number,state,
            opened_at,provider_updated_at) VALUES($1,$2,$3,'pull_request',$4,'open',now(),now())",
            &[&org, &repo_id, &item, &(item as i32)]).await.unwrap();
    }
    let request = crate::model::team_insights::LinkRequest {
        session_id: "a".repeat(64),
        repository_id: repo_id,
        work_item_id: 1,
    };
    let first = links.propose(org, user, &request).await.unwrap();
    assert_eq!(
        links.propose(org, user, &request).await.unwrap().id,
        first.id
    );
    assert!(links
        .decide_link(org, member, first.id, "confirmed")
        .await
        .unwrap()
        .is_none());
    assert!(links
        .decide_link(org, user, first.id, "confirmed")
        .await
        .unwrap()
        .is_some());
    assert_eq!(
        links
            .receipt_links(org, repo_id, 1, Some(team))
            .await
            .unwrap()[0]
            .allocation_targets,
        1
    );
    pg.execute(
        "UPDATE team_rollouts SET enabled=true WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    let allocation_generation = pg
        .query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get::<_, i64>(0);
    let identities = vec!["d".repeat(64)];
    assert_eq!(
        links
            .allocate(org, user, first.id, &identities, allocation_generation)
            .await
            .unwrap()
            .len(),
        1
    );
    // Response loss repeats the receipt without allocating a second copy.
    assert_eq!(
        links
            .allocate(org, user, first.id, &identities, allocation_generation)
            .await
            .unwrap()
            .len(),
        1
    );
    assert!(links
        .allocate(org, user, first.id, &identities, allocation_generation - 1)
        .await
        .is_err());
    let second = links
        .propose(
            org,
            user,
            &crate::model::team_insights::LinkRequest {
                work_item_id: 2,
                ..request
            },
        )
        .await
        .unwrap();
    links
        .decide_link(org, user, second.id, "confirmed")
        .await
        .unwrap();
    assert_eq!(
        links
            .receipt_links(org, repo_id, 1, Some(team))
            .await
            .unwrap()[0]
            .allocation_targets,
        2
    );
    let current_generation = pg
        .query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get::<_, i64>(0);
    assert!(links
        .allocate(org, user, first.id, &identities, current_generation)
        .await
        .unwrap()
        .is_empty());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_usage_allocations WHERE user_id=$1",
            &[&user]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    links
        .decide_link(org, user, second.id, "withdrawn")
        .await
        .unwrap();
    assert_eq!(
        links
            .receipt_links(org, repo_id, 1, Some(team))
            .await
            .unwrap()[0]
            .allocation_targets,
        1
    );
    pg.execute(
        "UPDATE organization_analytics_consents SET share_aggregate=false,share_individual=false
        WHERE organization_id=$1 AND user_id=$2",
        &[&org, &user],
    )
    .await
    .unwrap();
    assert!(links
        .receipt_links(org, repo_id, 1, Some(team))
        .await
        .unwrap()
        .is_empty());
    assert!(links
        .decide_link(org, user, second.id, "confirmed")
        .await
        .unwrap()
        .is_none());
    let delivery = Uuid::now_v7().to_string();
    let event = crate::services::team_webhooks::GithubMetadata {
        event: "installation".into(),
        action: "deleted".into(),
        installation_id: 42,
        repository_id: None,
        item: None,
        review_at: None,
        details: None,
    };
    repo.accept_github(&delivery, "first-hash", &event)
        .await
        .unwrap();
    repo.accept_github(&delivery, "first-hash", &event)
        .await
        .unwrap();
    assert!(repo
        .accept_github(&delivery, "second-hash", &event)
        .await
        .is_err());
    assert!(repo.process_github().await.unwrap());
    assert!(!repo.process_github().await.unwrap());
    // Cascading organization deletion must not recreate a generation FK row.
    pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
        .await
        .unwrap();
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_rollouts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .is_none());
}
