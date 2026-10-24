//! Synthetic workflow metadata. Requires an explicitly isolated database, never POSTGRES_URL.
use crate::{
    config::PostgresConfig,
    infrastructure::{database::ClickHouseClient, postgres::PostgresClient},
    repository::{
        team_actions::TeamActionsRepository,
        team_trust::{Registry, TeamTrustRepository},
    },
    services::{
        authorization::AuthorizationService, team_actions::*, team_comparison::Family,
        team_insights::TeamInsightsService,
    },
};
use chrono::{Datelike, Duration, Utc};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn improvement_action_cas_scope_retry_retention_and_restore() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
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
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    let team = Uuid::now_v7();
    let other = Uuid::now_v7();
    let owner = Uuid::now_v7();
    let lead = Uuid::now_v7();
    let viewer = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Workflow metadata fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO teams(id,organization_id,name,slug) VALUES($1,$2,'Fixture','fixture')",
        &[&team, &org],
    )
    .await
    .unwrap();
    for (user, role) in [(owner, "owner"), (lead, "member"), (viewer, "viewer")] {
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,'developer')",&[&org,&user,&role]).await.unwrap();
        pg.execute(
            "INSERT INTO team_members(team_id,user_id,role) VALUES($1,$2,$3)",
            &[&team, &user, &if user == lead { "lead" } else { "member" }],
        )
        .await
        .unwrap();
    }
    pg.execute(
        "UPDATE team_rollouts SET enabled=TRUE WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    let trust = TeamTrustRepository::new(pg.clone());
    trust.policy(org).await.unwrap();
    let path = std::env::temp_dir().join(format!("team-action-ledger-{}.json", Uuid::now_v7()));
    std::fs::write(
        &path,
        serde_json::to_vec(&Registry {
            schema_version: 1,
            checked_at: Utc::now(),
            organizations: BTreeMap::new(),
            dispositions: vec![],
        })
        .unwrap(),
    )
    .unwrap();
    std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &path);
    trust.export_registry(&path).await.unwrap();
    let ch = Arc::new(
        ClickHouseClient::new(&crate::config::ClickHouseConfig {
            url: "http://127.0.0.1:1".into(),
            user: None,
            password: None,
            database: "synthetic_only".into(),
        })
        .await
        .unwrap(),
    );
    let service = TeamInsightsService::new(
        Some(Arc::new(
            crate::repository::team_insights::TeamInsightsRepository::new(pg.clone(), ch),
        )),
        Arc::new(AuthorizationService::new(Some(pg.clone()))),
        true,
    );
    std::env::set_var("ATOAXIS_TEAM_WORKFLOW_ENABLED", "1");
    let r = TeamActionsRepository::new(pg.clone());
    let now = Utc::now();
    let monday =
        now.date_naive() - Duration::days(now.weekday().num_days_from_monday() as i64 + 14);
    let edit = Edit {
        request_id: Uuid::new_v4(),
        expected_revision: 0,
        owner_id: lead,
        title: "Evaluate review flow".into(),
        focus: "review_flow".into(),
        family: Family::TeamCost,
        baseline_week: monday,
        followup_week: monday + Duration::days(7),
        status: "planned".into(),
    };
    let id = Uuid::now_v7();
    let generation = trust.registry_entry(org).await.unwrap().generation;
    // Committed handoff, response/export absent: no history disappears and reads
    // remain closed until a stable request retry makes the proof durable.
    assert_eq!(
        r.write(
            owner,
            org,
            id,
            Some(team),
            Some(&edit),
            None,
            "Asia/Bangkok"
        )
        .await
        .unwrap(),
        1
    );
    assert!(r.guard(org).await.is_err());
    let created = service
        .mutate_action(owner, org, id, Some(team), Some(&edit), None)
        .await
        .unwrap();
    assert_eq!(created["revision"], 1);
    assert!(created.get("state_hash").is_none());
    let first = r.get(owner, org, id).await.unwrap();
    let backup = pg
        .query_one(
            "SELECT to_jsonb(a) FROM team_improvement_actions a WHERE organization_id=$1 AND id=$2",
            &[&org, &id],
        )
        .await
        .unwrap()
        .get::<_, serde_json::Value>(0);
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_action_history WHERE action_id=$1",
            &[&id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        trust.registry_entry(org).await.unwrap().generation,
        generation
    );
    assert!(!pg.query_one("SELECT COALESCE((SELECT share_aggregate FROM organization_analytics_consents WHERE organization_id=$1 AND user_id=$2),FALSE)",&[&org,&lead]).await.unwrap().get::<_,bool>(0));
    assert!(r
        .list(
            viewer,
            org,
            &List {
                team_id: Some(team),
                after: None,
                limit: Some(1)
            }
        )
        .await
        .is_ok());
    assert!(r
        .list(
            viewer,
            org,
            &List {
                team_id: None,
                after: None,
                limit: Some(1)
            }
        )
        .await
        .is_err());
    assert!(r.get(owner, other, id).await.is_err());
    let mut update = edit.clone();
    update.request_id = Uuid::new_v4();
    update.expected_revision = 1;
    update.title = "Follow review process".into();
    update.status = "active".into();
    assert!(r
        .write(
            viewer,
            org,
            id,
            Some(team),
            Some(&update),
            None,
            "Asia/Bangkok"
        )
        .await
        .is_err());
    // Two actual transactions contend; exactly one revision wins.
    let mut competing = update.clone();
    competing.request_id = Uuid::new_v4();
    competing.title = "Alternative workflow".into();
    let (a, b) = tokio::join!(
        r.write(
            lead,
            org,
            id,
            Some(team),
            Some(&update),
            None,
            "Asia/Bangkok"
        ),
        r.write(
            owner,
            org,
            id,
            Some(team),
            Some(&competing),
            None,
            "Asia/Bangkok"
        )
    );
    assert_eq!(usize::from(a.is_ok()) + usize::from(b.is_ok()), 1);
    trust.export_registry(&path).await.unwrap();
    assert_eq!(r.get(owner, org, id).await.unwrap().revision, 2);
    assert_eq!(
        r.history(lead, org, id, None).await.unwrap().changes.len(),
        2
    );
    assert_eq!(
        trust.registry_entry(org).await.unwrap().generation,
        generation
    );
    let proof = r.guard(org).await.unwrap();
    let deletion = Delete {
        request_id: Uuid::new_v4(),
        expected_revision: 2,
    };
    service
        .mutate_action(owner, org, id, Some(team), None, Some(&deletion))
        .await
        .unwrap();
    assert!(service
        .validate_actions(owner, org, Some(team), &proof)
        .await
        .is_err());
    service
        .mutate_action(owner, org, id, Some(team), None, Some(&deletion))
        .await
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_action_history WHERE action_id=$1",
            &[&id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        3
    );
    assert!(r.get(owner, org, id).await.is_err());
    assert!(r.history(owner, org, id, None).await.is_err());
    // Restore row/history from before deletion while the independent ledger
    // retains its tombstone. No old payload may become readable or reused.
    let ledger: Registry = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    let mut c = pg.transaction_client().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.batch_execute("SET LOCAL session_replication_role=replica")
        .await
        .unwrap();
    tx.execute("UPDATE team_improvement_actions SET revision=1,title=$3,state_hash=$4,deleted=FALSE,request_id=$5,request_hash=$6 WHERE organization_id=$1 AND id=$2",&[&org,&id,&first.title,&first.state_hash,&edit.request_id,&backup["request_hash"].as_str().unwrap()]).await.unwrap();
    tx.execute("DELETE FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',2)=$1 AND split_part(delivery_id,':',3)::bigint>1",&[&id.to_string()]).await.unwrap();
    tx.commit().await.unwrap();
    assert!(r.guard(org).await.is_err());
    trust.reconcile_restore(&ledger).await.unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(r.get(owner, org, id).await.is_err());
    assert!(r.history(owner, org, id, None).await.is_err());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_actions WHERE id=$1",
            &[&id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    pg.execute(
        "UPDATE team_rollouts SET enabled=TRUE WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(r
        .write(
            owner,
            org,
            id,
            Some(team),
            Some(&edit),
            None,
            "Asia/Bangkok"
        )
        .await
        .is_err());
    // Owner removed: assignment is inaccessible immediately without treating it
    // as analytics consent; the existing leased cleanup removes the metadata.
    let id2 = Uuid::now_v7();
    let mut fresh = edit.clone();
    fresh.request_id = Uuid::new_v4();
    service
        .mutate_action(owner, org, id2, Some(team), Some(&fresh), None)
        .await
        .unwrap();
    let pending_page = service
        .actions(
            owner,
            org,
            &List {
                team_id: Some(team),
                after: None,
                limit: Some(25),
            },
        )
        .await
        .unwrap();
    let _constructed_response = serde_json::to_vec(&pending_page).unwrap();
    pg.execute(
        "DELETE FROM team_members WHERE team_id=$1 AND user_id=$2",
        &[&team, &lead],
    )
    .await
    .unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(service
        .validate_actions(owner, org, Some(team), &pending_page.proof)
        .await
        .is_err());
    assert!(r.get(owner, org, id2).await.is_err());
    pg.execute("INSERT INTO team_cleanup_jobs(organization_id,phase,retry_at) VALUES($1,13,now()) ON CONFLICT(organization_id) DO UPDATE SET phase=13,retry_at=now(),completed_at=NULL",&[&org]).await.unwrap();
    for _ in 0..4 {
        trust.cleanup_tick(Utc::now()).await.unwrap();
    }
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_actions WHERE id=$1",
            &[&id2]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    trust.export_registry(&path).await.unwrap();
    assert!(r.guard(org).await.is_ok());
    // History retention is tied to immutable creation/change times, not an
    // edited updated_at. This native fixture represents an old operational task.
    let aged = Uuid::now_v7();
    let aged_request = Uuid::new_v4();
    pg.execute("INSERT INTO team_improvement_actions(organization_id,id,owner_id,title,focus,family,baseline_week,followup_week,timezone,status,created_by,changed_by,request_id,request_hash,created_at) VALUES($1,$2,$3,'Expired workflow','review_flow','team_cost',$4,$5,'Asia/Bangkok','active',$3,$3,$6,'synthetic_retention',now()-interval '13 months')",&[&org,&aged,&owner,&monday,&(monday+Duration::days(7)),&aged_request]).await.unwrap();
    pg.execute("UPDATE team_improvement_actions SET title='Recently edited old workflow',request_id=gen_random_uuid() WHERE organization_id=$1 AND id=$2",&[&org,&aged]).await.unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(r.get(owner, org, aged).await.is_err());
    assert!(r.history(owner, org, aged, None).await.is_err());
    pg.execute("UPDATE team_cleanup_jobs SET phase=13,retry_at=now(),completed_at=NULL WHERE organization_id=$1",&[&org]).await.unwrap();
    for _ in 0..3 {
        trust.cleanup_tick(Utc::now()).await.unwrap();
    }
    trust.export_registry(&path).await.unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_action_history WHERE action_id=$1",
            &[&aged]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    // Backup before creation has no row/history at all. The independent active
    // UUID receives a missing-source barrier, never a fabricated action payload.
    pg.execute(
        "INSERT INTO team_members(team_id,user_id,role) VALUES($1,$2,'lead')",
        &[&team, &lead],
    )
    .await
    .unwrap();
    trust.export_registry(&path).await.unwrap();
    let missing = Uuid::now_v7();
    let unseen = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&unseen, &unseen.to_string()],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'member','developer')",&[&org,&unseen]).await.unwrap();
    pg.execute(
        "INSERT INTO team_members(team_id,user_id,role) VALUES($1,$2,'member')",
        &[&team, &unseen],
    )
    .await
    .unwrap();
    trust.export_registry(&path).await.unwrap();
    let mut next = edit.clone();
    next.request_id = Uuid::new_v4();
    next.owner_id = unseen;
    service
        .mutate_action(owner, org, missing, Some(team), Some(&next), None)
        .await
        .unwrap();
    let recent: Registry = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    pg.execute(
        "DELETE FROM team_improvement_action_history WHERE action_id=$1",
        &[&missing],
    )
    .await
    .unwrap();
    pg.execute(
        "DELETE FROM team_improvement_actions WHERE id=$1",
        &[&missing],
    )
    .await
    .unwrap();
    pg.execute("DELETE FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',2)=$1",&[&missing.to_string()]).await.unwrap();
    pg.execute("DELETE FROM team_webhook_dispositions WHERE provider='team_action_participant' AND split_part(delivery_id,':',3)=$1",&[&missing.to_string()]).await.unwrap();
    pg.execute(
        "DELETE FROM team_action_account_proof_requirements WHERE account_id=$1",
        &[&unseen],
    )
    .await
    .unwrap();
    assert!(r.guard(org).await.is_err());
    trust.reconcile_restore(&recent).await.unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(r.guard(org).await.is_ok());
    assert!(r.get(owner, org, missing).await.is_err());
    assert!(pg.query_one("SELECT EXISTS(SELECT 1 FROM team_action_account_proof_requirements WHERE account_id=$1)",&[&unseen]).await.unwrap().get::<_,bool>(0));
    assert_eq!(pg.query_one("SELECT reason FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',2)=$1 ORDER BY split_part(delivery_id,':',3)::bigint DESC LIMIT 1",&[&missing.to_string()]).await.unwrap().get::<_,String>(0),"action_restore_blocked");
    // The independent mapping identifies an actor even when its action never
    // existed in this backup. Account erasure must close the missing UUID too.
    pg.execute("DELETE FROM users WHERE id=$1", &[&unseen])
        .await
        .unwrap();
    assert_eq!(pg.query_one("SELECT reason FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',2)=$1 ORDER BY split_part(delivery_id,':',3)::bigint DESC LIMIT 1",&[&missing.to_string()]).await.unwrap().get::<_,String>(0),"action_deleted");
    trust.reconcile_restore(&recent).await.unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(r.guard(org).await.is_ok());
    pg.execute(
        "UPDATE team_rollouts SET enabled=TRUE WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    trust.export_registry(&path).await.unwrap();
    assert!(service
        .actions(
            owner,
            org,
            &List {
                team_id: Some(team),
                after: None,
                limit: Some(25)
            }
        )
        .await
        .unwrap()
        .actions
        .is_empty());
    // Deleting a creator after assignment to a different member must not be
    // blocked by FKs, retain their workflow history, or reopen on a later restore.
    let reassigned = Uuid::now_v7();
    next.request_id = Uuid::new_v4();
    next.owner_id = lead;
    service
        .mutate_action(owner, org, reassigned, Some(team), Some(&next), None)
        .await
        .unwrap();
    let mut tz_client = pg.transaction_client().await.unwrap();
    let tz = tz_client.transaction().await.unwrap();
    tz.batch_execute("SET LOCAL timezone='Asia/Bangkok'")
        .await
        .unwrap();
    let bangkok_hash: String = tz
        .query_one(
            "SELECT team_action_hash(a) FROM team_improvement_actions a WHERE id=$1",
            &[&reassigned],
        )
        .await
        .unwrap()
        .get(0);
    tz.rollback().await.unwrap();
    assert_eq!(
        bangkok_hash,
        r.get(owner, org, reassigned).await.unwrap().state_hash
    );
    // Simulate the worker's committed PostgreSQL checkpoint and a crash before
    // independent proof export. The production finisher must resume with no user.
    let mut deletion_client = pg.transaction_client().await.unwrap();
    let deletion_tx = deletion_client.transaction().await.unwrap();
    deletion_tx
        .execute(
            "UPDATE users SET is_active=FALSE,deleted_at=now() WHERE id=$1",
            &[&owner],
        )
        .await
        .unwrap();
    deletion_tx.execute("INSERT INTO account_deletion_requests(account_id,status,postgres_purged_at,team_action_ledger_required,verification) VALUES($1,'running',now(),TRUE,'{\"objects_purged\":0,\"clickhouse_tables\":[]}'::jsonb)",&[&owner]).await.unwrap();
    deletion_tx
        .execute("DELETE FROM users WHERE id=$1", &[&owner])
        .await
        .unwrap();
    deletion_tx.commit().await.unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_actions WHERE id=$1",
            &[&reassigned]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_action_history WHERE action_id=$1",
            &[&reassigned]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    let mut resumed = pg.account_activity_lock(owner).await.unwrap();
    std::env::set_var(
        "ATOAXIS_TEAM_PRIVACY_LEDGER_PATH",
        path.with_extension("missing"),
    );
    assert!(crate::services::account_deletion::finish_postgres_deletion(
        pg.clone(),
        &mut resumed,
        owner
    )
    .await
    .is_err());
    assert_eq!(
        pg.query_one(
            "SELECT status FROM account_deletion_requests WHERE account_id=$1",
            &[&owner]
        )
        .await
        .unwrap()
        .get::<_, String>(0),
        "running"
    );
    std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &path);
    let completion = crate::services::account_deletion::finish_postgres_deletion(
        pg.clone(),
        &mut resumed,
        owner,
    )
    .await
    .unwrap();
    assert_eq!(completion["deleted"], true);
    assert_eq!(pg.query_one("SELECT verification->>'team_action_ledger' FROM account_deletion_requests WHERE account_id=$1",&[&owner]).await.unwrap().get::<_,String>(0),"durable");
    let repeated = crate::services::account_deletion::finish_postgres_deletion(
        pg.clone(),
        &mut resumed,
        owner,
    )
    .await
    .unwrap();
    assert_eq!(repeated["already_completed"], true);
    assert!(r.guard(org).await.is_ok());
    assert!(r.get(lead, org, reassigned).await.is_err());
    assert_eq!(pg.query_one("SELECT reason FROM team_webhook_dispositions WHERE provider='team_improvement_action' AND split_part(delivery_id,':',2)=$1 ORDER BY split_part(delivery_id,':',3)::bigint DESC LIMIT 1",&[&reassigned.to_string()]).await.unwrap().get::<_,String>(0),"action_deleted");
    drop(resumed);
    drop(deletion_client);
    drop(tz_client);
    drop(c);
    // Request -> soft tombstone -> cleanup -> final worker. The current action
    // and history are both gone, but the original proof obligation must survive.
    let cleaned = Uuid::now_v7();
    let mut own = edit.clone();
    own.request_id = Uuid::new_v4();
    own.owner_id = lead;
    service
        .mutate_action(lead, org, cleaned, Some(team), Some(&own), None)
        .await
        .unwrap();
    let mut request_client = pg.transaction_client().await.unwrap();
    let request_tx = request_client.transaction().await.unwrap();
    crate::infrastructure::postgres::PostgresClient::account_activity_transaction_lock(
        &request_tx,
        lead,
    )
    .await
    .unwrap();
    request_tx
        .query_one("SELECT pg_advisory_xact_lock(74103031)", &[])
        .await
        .unwrap();
    let required =
        crate::services::account_deletion::team_action_deletion_required(&request_tx, lead)
            .await
            .unwrap();
    assert!(required);
    request_tx.execute("INSERT INTO account_deletion_requests(account_id,status,team_action_ledger_required) VALUES($1,'requested',$2)",&[&lead,&required]).await.unwrap();
    request_tx
        .execute(
            "UPDATE users SET is_active=FALSE,deleted_at=now() WHERE id=$1",
            &[&lead],
        )
        .await
        .unwrap();
    request_tx.commit().await.unwrap();
    drop(request_client);
    pg.execute("UPDATE team_cleanup_jobs SET phase=13,retry_at=now(),completed_at=NULL WHERE organization_id=$1",&[&org]).await.unwrap();
    for _ in 0..4 {
        trust.cleanup_tick(Utc::now()).await.unwrap();
    }
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_actions WHERE id=$1",
            &[&cleaned]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_improvement_action_history WHERE action_id=$1",
            &[&cleaned]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    let mut final_client = pg.transaction_client().await.unwrap();
    let final_tx = final_client.transaction().await.unwrap();
    assert!(
        crate::services::account_deletion::team_action_deletion_required(&final_tx, lead)
            .await
            .unwrap()
    );
    final_tx
        .execute("DELETE FROM users WHERE id=$1", &[&lead])
        .await
        .unwrap();
    // Even a legacy empty dependency snapshot cannot downgrade the captured flag.
    final_tx.execute("UPDATE account_deletion_requests SET status='running',postgres_purged_at=now(),team_action_ledger_required=team_action_ledger_required OR FALSE WHERE account_id=$1",&[&lead]).await.unwrap();
    final_tx.commit().await.unwrap();
    drop(final_client);
    let mut resumed_cleaned = pg.account_activity_lock(lead).await.unwrap();
    std::env::set_var(
        "ATOAXIS_TEAM_PRIVACY_LEDGER_PATH",
        path.with_extension("missing"),
    );
    assert!(crate::services::account_deletion::finish_postgres_deletion(
        pg.clone(),
        &mut resumed_cleaned,
        lead
    )
    .await
    .is_err());
    assert_eq!(
        pg.query_one(
            "SELECT status FROM account_deletion_requests WHERE account_id=$1",
            &[&lead]
        )
        .await
        .unwrap()
        .get::<_, String>(0),
        "running"
    );
    std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &path);
    crate::services::account_deletion::finish_postgres_deletion(
        pg.clone(),
        &mut resumed_cleaned,
        lead,
    )
    .await
    .unwrap();
    assert!(pg
        .query_one(
            "SELECT team_action_ledger_required FROM account_deletion_requests WHERE account_id=$1",
            &[&lead]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    std::env::remove_var("ATOAXIS_TEAM_WORKFLOW_ENABLED");
    std::env::remove_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH");
    std::fs::remove_file(path).unwrap();
}
