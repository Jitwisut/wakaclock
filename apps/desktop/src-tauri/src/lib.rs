mod engine;
mod models;
mod policy;
mod settings;
mod state;
mod tracker;
mod tray;

use models::DashboardSnapshot;
use settings::DesktopSettings;
use state::{ConfirmedSnapshot, DesktopState};
use tauri::{Manager, State, WindowEvent};
use wakaclock_core::{
    api_client::{ApiClient, ConnectionState, DeliveryFailureKind},
    config::Config,
    heartbeat::{union_activity_seconds, ActivitySegment},
    queue::{Queue, QueueScope},
};

#[tauri::command]
fn get_settings(state: State<'_, DesktopState>) -> DesktopSettings {
    state.settings()
}

#[tauri::command]
fn update_settings(
    settings: DesktopSettings,
    state: State<'_, DesktopState>,
) -> Result<DesktopSettings, String> {
    settings.validate()?;
    settings.save()?;
    state.replace_settings(settings.clone());
    state.request_send();
    Ok(settings)
}

#[tauri::command]
fn refresh_now(state: State<'_, DesktopState>) {
    state.request_send();
}

#[tauri::command]
async fn dashboard_snapshot(state: State<'_, DesktopState>) -> Result<DashboardSnapshot, String> {
    let runtime = state.runtime();
    let category_seconds = state.category_seconds();
    let session_seconds = state.session_seconds();
    let config = Config::load();

    if config
        .api_key
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        return Ok(DashboardSnapshot {
            today_seconds: 0.0,
            today_text: "0m".into(),
            heartbeat_count: 0,
            queued_seconds: 0.0,
            api_connected: false,
            runtime,
            session_seconds,
            category_seconds,
            connection_state: "needs_api_key".into(),
            confirmed_seconds: None,
            display_total_seconds: None,
            queued_heartbeats: 0,
            orphaned_heartbeats: 0,
            last_confirmed_at: None,
            server_snapshot_stale: false,
            coalesced_intents: state.coalesced_intents(),
        });
    }

    let client = ApiClient::new(config).map_err(|error| error.to_string())?;
    let scope = client.queue_scope();
    // A cached total from another account or server must never be shown here.
    state.invalidate_confirmed_snapshot_unless(&scope_key(&scope));

    // Local queue first: it is readable whether or not the server answers, and
    // reporting zero queued while rows sit on disk is what made an outage look
    // like an idle day.
    let local = match Queue::open() {
        Ok(queue) => read_local_queue(&queue, &scope),
        Err(_) => LocalQueueView::default(),
    };

    let probe = client.today().await;
    let (connection_state, api_connected) = match &probe {
        Ok(_) => (ConnectionState::Online, true),
        Err(error) => {
            let kind = DeliveryFailureKind::from_error(error);
            (
                ConnectionState::from_failure_kind(kind),
                !matches!(kind, DeliveryFailureKind::Network),
            )
        }
    };

    if let Ok(today) = &probe {
        state.store_confirmed_snapshot(ConfirmedSnapshot {
            scope_key: scope_key(&scope),
            confirmed_seconds: today.confirmed_seconds.unwrap_or(today.total_seconds),
            intervals: today.active_intervals.clone(),
            heartbeat_count: today.heartbeat_count,
            fetched_at: chrono::Utc::now().timestamp() as f64,
        });
    }

    let cached = state.confirmed_snapshot();
    let stale = probe.is_err() && cached.is_some();
    let confirmed_seconds = cached.as_ref().map(|snapshot| snapshot.confirmed_seconds);
    let display_total_seconds = display_total(cached.as_ref(), &local);

    Ok(DashboardSnapshot {
        today_seconds: display_total_seconds.unwrap_or(0.0),
        today_text: match (&display_total_seconds, probe.is_ok()) {
            (Some(seconds), _) => format_desktop_duration(*seconds),
            (None, true) => "0m".into(),
            (None, false) => "Unknown".into(),
        },
        heartbeat_count: cached.as_ref().map(|s| s.heartbeat_count).unwrap_or(0),
        queued_seconds: local.seconds,
        api_connected,
        runtime,
        session_seconds,
        category_seconds,
        connection_state: connection_state.as_str().to_string(),
        confirmed_seconds,
        display_total_seconds,
        queued_heartbeats: local.depth,
        orphaned_heartbeats: local.orphaned,
        last_confirmed_at: cached.as_ref().map(|snapshot| snapshot.fetched_at),
        server_snapshot_stale: stale,
        coalesced_intents: state.coalesced_intents(),
    })
}

/// Queue facts for one origin + credential, read straight from the durable queue.
#[derive(Debug, Default)]
struct LocalQueueView {
    depth: usize,
    orphaned: usize,
    seconds: f64,
    intervals: Vec<ActivitySegment>,
}

fn read_local_queue(queue: &Queue, scope: &QueueScope) -> LocalQueueView {
    let intervals = queue
        .queued_segments_for_day_scoped(None, scope)
        .unwrap_or_default();
    LocalQueueView {
        depth: queue.len_scoped(scope).unwrap_or(0),
        orphaned: queue.orphaned_len(scope).unwrap_or(0),
        seconds: union_activity_seconds(&intervals),
        intervals,
    }
}

/// Server-confirmed time combined with what is still queued locally.
///
/// Unioned rather than added whenever either side carries intervals: a flush in
/// progress legitimately appears in both, and adding would count it twice. With
/// no cached snapshot the answer is unknown — deliberately not zero.
fn display_total(cached: Option<&ConfirmedSnapshot>, local: &LocalQueueView) -> Option<f64> {
    let cached = cached?;
    if cached.intervals.is_empty() && local.intervals.is_empty() {
        return Some(cached.confirmed_seconds + local.seconds);
    }
    let mut intervals = cached.intervals.clone();
    intervals.extend(local.intervals.iter().cloned());
    Some(union_activity_seconds(&intervals).max(cached.confirmed_seconds))
}

fn scope_key(scope: &QueueScope) -> String {
    format!("{}|{}", scope.destination, scope.owner)
}

fn format_desktop_duration(seconds: f64) -> String {
    let total = seconds.max(0.0) as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    if hours > 0 {
        format!("{hours}h {minutes}m")
    } else {
        format!("{minutes}m")
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(DesktopState::new())
        .setup(|app| {
            tray::setup(app)?;
            let state = app.state::<DesktopState>().inner().clone();
            let handle = app.handle().clone();
            std::thread::Builder::new()
                .name("atoaxis-tracker".into())
                .spawn(move || {
                    let runtime = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build()
                        .expect("failed to create AtoAxis tracker runtime");
                    runtime.block_on(engine::run(handle, state));
                })
                .map_err(|error| error.to_string())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            refresh_now,
            dashboard_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running AtoAxis Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(id: &str, start: f64, end: f64) -> ActivitySegment {
        ActivitySegment {
            segment_id: id.to_string(),
            start,
            end,
            source: Some("desktop".to_string()),
        }
    }

    fn temp_queue() -> (std::path::PathBuf, Queue) {
        let path = std::env::temp_dir().join(format!(
            "atoaxis-desktop-snapshot-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let queue = Queue::open_at(&path).unwrap();
        (path, queue)
    }

    fn scope(destination: &str, owner: &str) -> QueueScope {
        QueueScope {
            destination: destination.to_string(),
            owner: owner.to_string(),
        }
    }

    fn queued_heartbeat(id: &str, start: f64, end: f64) -> serde_json::Value {
        serde_json::json!({
            "heartbeat_id": id,
            "entity": "Code",
            "time": end,
            "activity_segments": [segment(id, start, end)],
        })
    }

    #[test]
    fn offline_snapshot_reports_real_scoped_queue_depth() {
        let (path, queue) = temp_queue();
        let mine = scope("https://api.example.test", "key:mine");
        let other = scope("https://api.example.test", "key:other");
        let now = chrono::Utc::now().timestamp() as f64;
        queue
            .push_scoped(&queued_heartbeat("hb-1", now - 60.0, now - 30.0), &mine)
            .unwrap();
        queue
            .push_scoped(&queued_heartbeat("hb-2", now - 30.0, now - 15.0), &mine)
            .unwrap();
        queue
            .push_scoped(&queued_heartbeat("hb-3", now - 20.0, now - 10.0), &other)
            .unwrap();

        let view = read_local_queue(&queue, &mine);

        // The real count from disk — reporting zero here is what made an outage
        // look like an idle day.
        assert_eq!(view.depth, 2);
        assert_eq!(view.orphaned, 1);
        assert!(view.seconds > 0.0);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn offline_snapshot_unions_cached_confirmed_and_queued_intervals() {
        let cached = ConfirmedSnapshot {
            scope_key: "origin|owner".into(),
            confirmed_seconds: 60.0,
            intervals: vec![segment("server", 100.0, 160.0)],
            heartbeat_count: 4,
            fetched_at: 1.0,
        };
        let local = LocalQueueView {
            depth: 1,
            orphaned: 0,
            seconds: 30.0,
            intervals: vec![segment("local", 160.0, 190.0)],
        };

        // Adjacent, not overlapping: 60s confirmed + 30s queued.
        assert_eq!(display_total(Some(&cached), &local), Some(90.0));
    }

    #[test]
    fn overlap_between_cached_and_queued_intervals_is_not_double_counted() {
        let cached = ConfirmedSnapshot {
            scope_key: "origin|owner".into(),
            confirmed_seconds: 60.0,
            intervals: vec![segment("server", 100.0, 160.0)],
            heartbeat_count: 4,
            fetched_at: 1.0,
        };
        // The same activity is still queued locally (accepted but not yet
        // deleted): the total must stay 60s, not 90s.
        let local = LocalQueueView {
            depth: 1,
            orphaned: 0,
            seconds: 30.0,
            intervals: vec![segment("local", 130.0, 160.0)],
        };

        assert_eq!(display_total(Some(&cached), &local), Some(60.0));
    }

    #[test]
    fn an_unknown_total_is_not_reported_as_zero() {
        let local = LocalQueueView {
            depth: 2,
            orphaned: 0,
            seconds: 45.0,
            intervals: vec![segment("local", 100.0, 145.0)],
        };
        assert_eq!(display_total(None, &local), None);
    }

    #[test]
    fn account_change_invalidates_cached_snapshot_without_deleting_queue() {
        let (path, queue) = temp_queue();
        let first = scope("https://api.example.test", "key:first");
        let now = chrono::Utc::now().timestamp() as f64;
        queue
            .push_scoped(&queued_heartbeat("hb-1", now - 60.0, now - 30.0), &first)
            .unwrap();

        let state = DesktopState::new();
        state.store_confirmed_snapshot(ConfirmedSnapshot {
            scope_key: scope_key(&first),
            confirmed_seconds: 120.0,
            intervals: vec![],
            heartbeat_count: 7,
            fetched_at: 1.0,
        });

        // Same scope: the cache stays.
        state.invalidate_confirmed_snapshot_unless(&scope_key(&first));
        assert!(state.confirmed_snapshot().is_some());

        // Another account on the same server: the cached total is dropped, and the
        // queued rows are untouched.
        let second = scope("https://api.example.test", "key:second");
        state.invalidate_confirmed_snapshot_unless(&scope_key(&second));
        assert!(state.confirmed_snapshot().is_none());
        assert_eq!(queue.len_scoped(&first).unwrap(), 1);
        let _ = std::fs::remove_file(path);
    }
}
