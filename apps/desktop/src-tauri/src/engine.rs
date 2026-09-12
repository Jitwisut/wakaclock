use crate::{
    models::{RuntimeSnapshot, TrackedActivity, TrackerStatus},
    policy::sanitize_activity,
    state::DesktopState,
    tracker,
};
use chrono::Utc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use wakaclock_core::{
    api_client::ApiClient,
    config::Config,
    heartbeat::{EntityType, Heartbeat, DEDUP_WINDOW_SECONDS},
};

const TICK: Duration = Duration::from_secs(5);
const MAX_ACCOUNTED_TICK_SECONDS: f64 = 10.0;

pub async fn run(app: AppHandle, state: DesktopState) {
    let mut last_entity: Option<String> = None;
    let mut last_sent_at = 0.0_f64;
    let mut previous_tick = Instant::now();
    let mut previous_active_category = None;

    loop {
        let elapsed = previous_tick
            .elapsed()
            .as_secs_f64()
            .min(MAX_ACCOUNTED_TICK_SECONDS);
        previous_tick = Instant::now();
        let settings = state.settings();

        if !settings.enabled {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Paused;
                runtime.idle_seconds = 0.0;
            });
            tokio::time::sleep(TICK).await;
            continue;
        }
        if settings.private_mode {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Private;
                runtime.app_name = None;
                runtime.app_identifier = None;
                runtime.category = None;
            });
            tokio::time::sleep(TICK).await;
            continue;
        }

        let idle_seconds = match tracker::idle::idle_seconds() {
            Ok(value) => value,
            Err(error) => {
                advance_activity_accounting(&mut previous_active_category, None);
                set_unavailable(&state, error);
                tokio::time::sleep(TICK).await;
                continue;
            }
        };
        if idle_seconds >= settings.idle_timeout_seconds as f64 {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Idle;
                runtime.idle_seconds = idle_seconds;
                runtime.category = None;
            });
            tokio::time::sleep(TICK).await;
            continue;
        }

        let foreground = match tracker::current_foreground_app(settings.title_tracking) {
            Ok(value) => value,
            Err(error) => {
                advance_activity_accounting(&mut previous_active_category, None);
                set_unavailable(&state, error);
                tokio::time::sleep(TICK).await;
                continue;
            }
        };

        let Some(activity) = sanitize_activity(&foreground, &settings) else {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Unmonitored;
                runtime.app_name = Some(foreground.app_name.clone());
                runtime.app_identifier = Some(foreground.identifier.clone());
                runtime.category = None;
                runtime.idle_seconds = idle_seconds;
                runtime.last_error = None;
            });
            tokio::time::sleep(TICK).await;
            continue;
        };

        if let Some(category) =
            advance_activity_accounting(&mut previous_active_category, Some(activity.category))
        {
            state.record_category(category.as_str(), elapsed);
        }
        state.update_runtime(|runtime| set_active(runtime, &activity, idle_seconds));

        let now = Utc::now().timestamp_millis() as f64 / 1000.0;
        let app_changed = last_entity.as_deref() != Some(activity.entity.as_str());
        let due = now - last_sent_at >= DEDUP_WINDOW_SECONDS;
        let should_send = app_changed || due || state.take_send_request();
        if should_send {
            match send_activity(&activity).await {
                Ok(error) => {
                    last_entity = Some(activity.entity.clone());
                    last_sent_at = now;
                    state.update_runtime(|runtime| {
                        runtime.last_heartbeat_at = Some(now);
                        runtime.last_error = error;
                    });
                }
                Err(error) => {
                    state.update_runtime(|runtime| runtime.last_error = Some(error));
                }
            }
        }

        if now as u64 % 60 < TICK.as_secs() {
            update_tray_today(&app).await;
        }
        tokio::time::sleep(TICK).await;
    }
}

async fn send_activity(activity: &TrackedActivity) -> Result<Option<String>, String> {
    let config = Config::load();
    if config
        .api_key
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        return Err("API key is not configured in ~/.wakaclock/config.toml".into());
    }

    let mut heartbeat = Heartbeat::new(
        config.user_id,
        activity.entity.clone(),
        EntityType::App,
        format!("atoaxis-desktop/{}", env!("CARGO_PKG_VERSION")),
    );
    heartbeat.category = activity.category.into();
    heartbeat.editor = "AtoAxis Desktop".into();
    heartbeat.operating_system = friendly_os().into();
    heartbeat.machine = std::env::consts::ARCH.into();
    // Desktop activity is sampled only while a foreground app is active and the
    // operating-system idle timer is below the configured threshold. Mark it as
    // human/editor evidence explicitly so combined_v2 keeps the tracker stream in
    // the WakaTime-comparable union; an Unknown anchor would otherwise contribute
    // time in legacy mode but disappear when the human and measured-AI streams are
    // combined.
    heartbeat.actor_type = wakaclock_core::heartbeat::ActorType::Human;
    heartbeat.actor_confidence = 1.0;
    heartbeat.is_ai_generated = false;

    let report = ApiClient::new(config)
        .map_err(|error| error.to_string())?
        .send_heartbeat(heartbeat)
        .await
        .map_err(|error| error.to_string())?;
    Ok(report.error)
}

fn advance_activity_accounting(
    previous: &mut Option<crate::models::DesktopCategory>,
    current: Option<crate::models::DesktopCategory>,
) -> Option<crate::models::DesktopCategory> {
    let accounted = if current.is_some() { *previous } else { None };
    *previous = current;
    accounted
}

fn set_active(runtime: &mut RuntimeSnapshot, activity: &TrackedActivity, idle_seconds: f64) {
    runtime.status = TrackerStatus::Active;
    runtime.app_name = Some(activity.app_name.clone());
    runtime.app_identifier = Some(activity.identifier.clone());
    runtime.category = Some(activity.category);
    runtime.idle_seconds = idle_seconds;
    runtime.last_error = None;
}

fn set_unavailable(state: &DesktopState, error: String) {
    state.update_runtime(|runtime| {
        runtime.status = TrackerStatus::Unavailable;
        runtime.last_error = Some(error);
    });
}

fn friendly_os() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        return "macOS";
    }
    #[cfg(target_os = "windows")]
    {
        return "Windows";
    }
    #[allow(unreachable_code)]
    std::env::consts::OS
}

async fn update_tray_today(app: &AppHandle) {
    let config = Config::load();
    if config.api_key.is_none() {
        return;
    }
    let Ok(client) = ApiClient::new(config) else {
        return;
    };
    let Ok(today) = client.today().await else {
        return;
    };
    if let Some(tray) = app.tray_by_id("atoaxis-main") {
        let tooltip = format!("AtoAxis · Today {}", today.human_readable);
        let _ = tray.set_tooltip(Some(tooltip));
        #[cfg(target_os = "macos")]
        let _ = tray.set_title(Some(format!(" {}", today.human_readable)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accounted_tick_is_bounded_after_sleep_or_suspend() {
        let long_gap = Duration::from_secs(300)
            .as_secs_f64()
            .min(MAX_ACCOUNTED_TICK_SECONDS);
        assert_eq!(long_gap, 10.0);
    }

    #[test]
    fn inactive_transition_resets_accounting_before_resume() {
        use crate::models::DesktopCategory;

        let mut previous = None;
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Coding)),
            None
        );
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Coding)),
            Some(DesktopCategory::Coding)
        );
        assert_eq!(advance_activity_accounting(&mut previous, None), None);
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Meeting)),
            None
        );
    }

    #[test]
    fn app_switch_attributes_elapsed_interval_to_previous_category() {
        use crate::models::DesktopCategory;

        let mut previous = Some(DesktopCategory::Coding);
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Meeting)),
            Some(DesktopCategory::Coding)
        );
        assert_eq!(previous, Some(DesktopCategory::Meeting));
    }
}
