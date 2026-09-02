mod engine;
mod models;
mod policy;
mod settings;
mod state;
mod tracker;
mod tray;

use models::DashboardSnapshot;
use settings::DesktopSettings;
use state::DesktopState;
use tauri::{Manager, State, WindowEvent};
use wakaclock_core::{api_client::ApiClient, config::Config};

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
        });
    }

    match ApiClient::new(config) {
        Ok(client) => match client.today().await {
            Ok(today) => Ok(DashboardSnapshot {
                today_seconds: today.total_seconds,
                today_text: today.human_readable,
                heartbeat_count: today.heartbeat_count,
                queued_seconds: today.queued_seconds,
                api_connected: true,
                runtime,
                session_seconds,
                category_seconds,
            }),
            Err(_) => Ok(DashboardSnapshot {
                today_seconds: 0.0,
                today_text: "Offline".into(),
                heartbeat_count: 0,
                queued_seconds: 0.0,
                api_connected: false,
                runtime,
                session_seconds,
                category_seconds,
            }),
        },
        Err(error) => Err(error.to_string()),
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
