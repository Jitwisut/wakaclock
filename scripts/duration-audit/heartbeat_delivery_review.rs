use wakaclock_core::{
    heartbeat::ActorType,
    queue::{Queue, QueueScope},
};
use wakaclock_server::services::activity_timeline::{
    total_seconds, ActivityInterval, Timeline,
};

fn anchor(id: &str, time: f64) -> ActivityInterval {
    ActivityInterval {
        segment_id: id.into(),
        heartbeat_id: id.into(),
        start: time,
        end: time,
        source: "editor".into(),
        actor_type: ActorType::Human,
        actor_confidence: 1.0,
        entity: id.into(),
        project: Some(id.into()),
        project_id: None,
        branch: None,
        language: None,
        category: "coding".into(),
        editor: "vscode".into(),
        operating_system: "macos".into(),
        machine: "audit".into(),
    }
}

fn main() {
    let queue_path =
        std::env::temp_dir().join(format!("heartbeat-audit-{}.db", std::process::id()));
    let queue = Queue::open_at(&queue_path).unwrap();
    let scope = QueueScope {
        destination: "https://api.example".into(),
        owner: "audit-owner".into(),
    };
    for revision in [0, 1] {
        queue
            .push_scoped(
                &serde_json::json!({
                    "heartbeat_id": "same",
                    "session_id": "session",
                    "revision": revision,
                    "entity": "a"
                }),
                &scope,
            )
            .unwrap();
    }
    let rows = queue.claim_batch_scoped(&scope, "audit-lease").unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].1["revision"], 0);
    assert_eq!(rows[1].1["revision"], 1);
    drop(queue);
    std::fs::remove_file(queue_path).unwrap();

    let boundary = Timeline::build_clipped(
        &[anchor("before", -840.0), anchor("inside", 840.0)],
        900.0,
        0.0,
        86_400.0,
    );
    assert_eq!(total_seconds(&boundary.bridged), 0.0);

    let projects = Timeline::build(
        &[
            anchor("A", 0.0),
            anchor("B", 600.0),
            anchor("C", 1_200.0),
        ],
        900.0,
    );
    assert_eq!(projects.bridged.len(), 2);
    assert_eq!(projects.bridged[0].entity, "A");
    assert_eq!(projects.bridged[0].end, 600.0);
    assert_eq!(projects.bridged[1].entity, "B");
    assert_eq!(projects.bridged[1].end, 1_200.0);

    println!("heartbeat delivery and duration regression checks passed");
}
