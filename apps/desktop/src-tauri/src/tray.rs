use crate::state::DesktopState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

pub fn setup(app: &App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open AtoAxis", true, None::<&str>)?;
    let toggle = MenuItem::with_id(
        app,
        "toggle_tracking",
        "Pause / Resume Tracking",
        true,
        None::<&str>,
    )?;
    let private = MenuItem::with_id(
        app,
        "private_mode",
        "Toggle Private Mode",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit AtoAxis", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &toggle, &private, &quit])?;

    let mut builder = TrayIconBuilder::with_id("atoaxis-main")
        .menu(&menu)
        .tooltip("AtoAxis Desktop")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "toggle_tracking" => {
                let state = app.state::<DesktopState>();
                let mut settings = state.settings();
                settings.enabled = !settings.enabled;
                if settings.save().is_ok() {
                    state.replace_settings(settings);
                }
            }
            "private_mode" => {
                let state = app.state::<DesktopState>();
                let mut settings = state.settings();
                settings.private_mode = !settings.private_mode;
                if settings.save().is_ok() {
                    state.replace_settings(settings);
                }
            }
            "quit" => quit_after_flush(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Quit without throwing away captured activity.
///
/// Asks the sampler to stop, then waits — off the UI thread — for the delivery
/// worker to persist what it still holds. Bounded, so a hung request can never
/// keep the app from closing.
fn quit_after_flush(app: &tauri::AppHandle) {
    let state = app.state::<DesktopState>().inner().clone();
    state.request_shutdown();
    let handle = app.clone();
    std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(6);
        while !state.is_shutdown_complete() && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        handle.exit(0);
    });
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
