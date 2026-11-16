//! Opt-in persistence regressions. Every test owns random accounts in the isolated
//! CLICKHOUSE_TEST_URL instance; no application database configuration is used.
use super::*;
use crate::repository::project_identity::ProjectIdentityRepository;
use crate::repository::project_merge::ProjectMergeRepository;
use crate::services::activity_timeline::{total_seconds, ActivityTimelineService};
use crate::services::heartbeat_ingest::assign_missing_heartbeat_ids;
use wakaclock_core::heartbeat::EntityType;

async fn fixture() -> (
    HeartbeatService,
    Arc<HeartbeatRepository>,
    Arc<crate::infrastructure::database::ClickHouseClient>,
) {
    let ch = crate::test_support::clickhouse_client().await;
    let repo = Arc::new(HeartbeatRepository::new(ch.clone()));
    repo.migrate().await.unwrap();
    // Match startup ordering: identity migration widens both heartbeat facts
    // and the analytics project_daily table.
    crate::repository::analytics::AnalyticsRepository::new(ch.clone())
        .migrate()
        .await
        .unwrap();
    let identity = Arc::new(ProjectIdentityRepository::new(ch.clone()));
    let merges = Arc::new(ProjectMergeRepository::new(ch.clone()));
    merges.migrate().await.unwrap();
    identity.migrate().await.unwrap();
    let service = HeartbeatService::new(
        repo.clone(),
        Arc::new(ProjectIdentityService::new(identity, merges)),
    );
    (service, repo, ch)
}

fn day(offset: i64) -> ResolvedRange {
    let date = (Utc::now().date_naive() + chrono::Duration::days(offset)).to_string();
    ResolvedRange::parse(&date, &date, Some("UTC")).unwrap()
}

fn heartbeat(user: Uuid, id: &str, entity: &str) -> Heartbeat {
    let mut hb = Heartbeat::new(
        user,
        entity.to_owned(),
        EntityType::File,
        "integrity-test".to_owned(),
    );
    hb.heartbeat_id = Some(id.to_owned());
    hb.session_id = Some("integrity-session".to_owned());
    hb.time = day(0).unix_bounds().0 + 3600.0;
    hb
}

#[tokio::test]
#[ignore = "requires isolated ClickHouse via CLICKHOUSE_TEST_URL"]
async fn heartbeat_integrity_multifile_changes_and_staged_revisions() {
    let (service, repo, _) = fixture().await;
    let user = Uuid::now_v7();
    let mut a = heartbeat(user, "a", "a.rs");
    a.ai_change_id = Some("shared-change".into());
    let mut b = a.clone();
    b.entity = "b.rs".into();
    b.heartbeat_id = Some("b".into());
    assert_eq!(
        service
            .process_heartbeats(user, String::new(), vec![a.clone(), b.clone()])
            .await
            .unwrap(),
        2
    );
    // Exercise the persisted lookup separately from in-batch deduplication.
    let mut c = a.clone();
    c.entity = "c.rs".into();
    c.heartbeat_id = Some("c".into());
    assert_eq!(
        service
            .process_heartbeats(user, String::new(), vec![c])
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        service
            .process_heartbeats(user, String::new(), vec![a.clone(), b])
            .await
            .unwrap(),
        0
    );

    // Each revision identity path must use the staged maximum over the DB base.
    for kind in ["transport", "event", "change"] {
        let mut base = heartbeat(user, kind, &format!("{kind}.rs"));
        if kind == "event" {
            base.ai_event_id = Some("event".into());
        }
        if kind == "change" {
            base.ai_change_id = Some("change".into());
        }
        service
            .process_heartbeats(user, String::new(), vec![base.clone()])
            .await
            .unwrap();
        let mut one = base.clone();
        one.revision = 1;
        let mut two = base.clone();
        two.revision = 2;
        if kind != "transport" {
            one.heartbeat_id = Some(format!("{kind}-revision-1"));
            two.heartbeat_id = Some(format!("{kind}-revision-2"));
        }
        assert_eq!(
            service
                .process_heartbeats(user, String::new(), vec![one, two.clone()])
                .await
                .unwrap(),
            2
        );
        assert_eq!(
            service
                .process_heartbeats(user, String::new(), vec![two])
                .await
                .unwrap(),
            0
        );
        let mut skipped = base;
        skipped.revision = 4;
        if kind != "transport" {
            skipped.heartbeat_id = Some(format!("{kind}-revision-4"));
        }
        assert!(service
            .process_heartbeats(user, String::new(), vec![skipped])
            .await
            .is_err());
    }
    let rows = repo.get_by_date(user, &day(0)).await.unwrap();
    assert_eq!(rows.len(), 6);
    assert_eq!(rows.iter().filter(|row| row.revision == 2).count(), 3);
    // Same opaque keys remain independent across accounts.
    let other = Uuid::now_v7();
    assert_eq!(
        service
            .process_heartbeats(other, String::new(), vec![a])
            .await
            .unwrap(),
        1
    );
    assert_eq!(repo.get_by_date(other, &day(0)).await.unwrap().len(), 1);
}

#[tokio::test]
#[ignore = "requires isolated ClickHouse via CLICKHOUSE_TEST_URL"]
async fn heartbeat_integrity_window_filters_winners_and_preserves_legacy_rows() {
    let (service, repo, _) = fixture().await;
    let user = Uuid::now_v7();
    let base = heartbeat(user, "moved", "moved.rs");
    service
        .process_heartbeats(user, String::new(), vec![base.clone()])
        .await
        .unwrap();
    let mut correction = base.clone();
    correction.revision = 1;
    correction.time += 86400.0;
    service
        .process_heartbeats(user, String::new(), vec![correction])
        .await
        .unwrap();
    assert!(repo.get_by_date(user, &day(0)).await.unwrap().is_empty());
    let new_day = repo.get_by_date(user, &day(1)).await.unwrap();
    assert_eq!(new_day.len(), 1);
    assert_eq!(new_day[0].revision, 1);
    // Measurement repair uses the same bounded winner relation and must not
    // repair a superseded revision merely because its timestamp was in range.
    use sha2::{Digest, Sha256};
    let session = base.session_id.as_deref().unwrap();
    let operation = base.heartbeat_id.as_deref().unwrap();
    let reference = format!(
        "{:x}",
        Sha256::digest(format!(
            "{}:{session}{}:{operation}{}:{}",
            session.len(),
            operation.len(),
            base.entity.len(),
            base.entity
        ))
    );
    let (old_start, old_end) = day(0).unix_bounds();
    let (new_start, new_end) = day(1).unix_bounds();
    assert!(repo
        .get_by_measurement_repair_references(
            user,
            old_start,
            old_end,
            std::slice::from_ref(&reference)
        )
        .await
        .unwrap()
        .is_empty());
    let repaired = repo
        .get_by_measurement_repair_references(user, new_start, new_end, &[reference])
        .await
        .unwrap();
    assert_eq!(repaired.len(), 1);
    assert_eq!(repaired[0].revision, 1);

    let wide = ResolvedRange::parse(
        &day(0).start.to_string(),
        &day(1).end.to_string(),
        Some("UTC"),
    )
    .unwrap();
    assert_eq!(repo.get_by_date(user, &wide).await.unwrap().len(), 1);
    let other = Uuid::now_v7();
    service
        .process_heartbeats(other, String::new(), vec![base.clone()])
        .await
        .unwrap();
    assert_eq!(repo.get_by_date(other, &day(0)).await.unwrap().len(), 1);
    // Direct service insertion simulates pre-existing ID-less history. Identical
    // legacy observations must not become one logical operation after this fix.
    let mut legacy = base;
    legacy.heartbeat_id = None;
    legacy.session_id = None;
    service
        .process_heartbeats(user, String::new(), vec![legacy.clone(), legacy])
        .await
        .unwrap();
    assert_eq!(repo.get_by_date(user, &day(0)).await.unwrap().len(), 2);
}

#[tokio::test]
#[ignore = "requires isolated ClickHouse via CLICKHOUSE_TEST_URL"]
async fn heartbeat_integrity_assigned_ids_delete_retry_and_projection_recovery() {
    let (service, repo, ch) = fixture().await;
    let user = Uuid::now_v7();
    let mut original = heartbeat(user, "unused", "capture.rs");
    original.heartbeat_id = None;
    original.activity_segments = vec![ActivitySegment {
        segment_id: "segment".into(),
        start: original.time - 15.0,
        end: original.time,
        source: Some("editor_active_v1".into()),
    }];
    original.active_seconds = Some(15.0);
    let mut batch = vec![original.clone(), original];
    // Distinct observations have distinct segment identities even when their
    // measured intervals overlap. Reusing a segment ID intentionally dedups the
    // projection, which would not exercise recovery of both independent rows.
    batch[1].activity_segments[0].segment_id = "segment-second".into();
    assign_missing_heartbeat_ids(&mut batch);
    let ids = batch
        .iter()
        .map(|hb| hb.heartbeat_id.clone().unwrap())
        .collect::<Vec<_>>();
    assert_ne!(ids[0], ids[1]);
    assert_eq!(
        service
            .process_heartbeats(user, String::new(), batch.clone())
            .await
            .unwrap(),
        2
    );
    let rows = repo.get_by_date(user, &day(0)).await.unwrap();
    assert_eq!(rows.len(), 2);
    assert!(rows
        .iter()
        .all(|row| ids.contains(row.heartbeat_id.as_ref().unwrap())));
    let timeline = ActivityTimelineService::new(ch.clone(), 900.0);
    let (start, end) = day(0).unix_bounds();
    let before = total_seconds(&timeline.canonical(user, start, end).await.unwrap());
    assert_eq!(
        before, 15.0,
        "random transport IDs must not double overlapping time"
    );
    // Simulate a raw-success/projection-failure boundary, then exercise replay.
    ch.get_client().query("ALTER TABLE wakaclock.activity_intervals DELETE WHERE user_id = ? SETTINGS mutations_sync = 1")
        .bind(user).execute().await.unwrap();
    assert_eq!(
        service
            .process_heartbeats_strict(user, String::new(), batch.clone())
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        repo.existing_activity_segment_ids(user, &ids[0], &["segment".into()])
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        total_seconds(&timeline.canonical(user, start, end).await.unwrap()),
        before
    );
    let other = Uuid::now_v7();
    service
        .process_heartbeats(other, String::new(), batch.clone())
        .await
        .unwrap();
    repo.delete_ids(user, &ids).await.unwrap();
    assert!(repo.get_by_date(user, &day(0)).await.unwrap().is_empty());
    assert_eq!(
        service
            .process_heartbeats(user, String::new(), batch)
            .await
            .unwrap(),
        0
    );
    assert!(repo.get_by_date(user, &day(0)).await.unwrap().is_empty());
    assert_eq!(repo.get_by_date(other, &day(0)).await.unwrap().len(), 2);
}
