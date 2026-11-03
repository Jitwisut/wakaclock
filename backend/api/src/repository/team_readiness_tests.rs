//! Deferred synthetic PostgreSQL read-only metadata regression.
use crate::{config::PostgresConfig, infrastructure::postgres::PostgresClient};
use uuid::Uuid;

#[tokio::test]
#[ignore = "isolated atoaxis_team_test only; verification phase"]
async fn readiness_snapshot_is_tenant_scoped_read_only_bounded_and_detects_changes() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_test")
    );
    let pg = PostgresClient::connect(&PostgresConfig {
        url: Some(url),
        max_connections: 4,
    })
    .await
    .unwrap();
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    let other = Uuid::now_v7();
    for id in [org, other] {
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic readiness scope')",
            &[&id, &id.to_string()],
        )
        .await
        .unwrap();
    }
    let sha = "a".repeat(40);
    pg.execute("INSERT INTO team_release_evidence(organization_id,gate,evidence_scope,passed,evidence_ref,build) VALUES($1,'restore_drill','external',true,'fixture/restore.json',$2)",&[&org,&sha]).await.unwrap();
    pg.execute("INSERT INTO team_release_evidence(organization_id,gate,evidence_scope,passed,evidence_ref) VALUES($1,'support_incident_runbook','local',false,'fixture/support.json')",&[&org]).await.unwrap();
    pg.execute("INSERT INTO team_release_evidence(organization_id,gate,evidence_scope,passed,evidence_ref) VALUES($1,'restore_drill','external',true,'other-tenant-reference')",&[&other]).await.unwrap();
    let snapshot = super::team_insights::read_readiness_snapshot(&pg, org)
        .await
        .unwrap();
    assert!(!snapshot.organization_enabled);
    assert_eq!(snapshot.timezone, None);
    assert_eq!(snapshot.evidence.len(), 2);
    assert!(snapshot
        .evidence
        .iter()
        .all(|row| row.evidence_ref != "other-tenant-reference"));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_report_policies WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_rollouts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    pg.execute("UPDATE team_release_evidence SET passed=false WHERE organization_id=$1 AND gate='restore_drill'",&[&org]).await.unwrap();
    assert_ne!(
        super::team_insights::read_readiness_snapshot(&pg, org)
            .await
            .unwrap(),
        snapshot
    );
    pg.execute("INSERT INTO team_release_evidence(organization_id,gate,evidence_scope,passed,evidence_ref) SELECT $1,'unknown-'||n::text,'unknown',false,'synthetic' FROM generate_series(1,1001) n",&[&org]).await.unwrap();
    assert!(super::team_insights::read_readiness_snapshot(&pg, org)
        .await
        .is_err());
}
