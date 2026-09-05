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
            "quit" => app.exit(0),
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

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
