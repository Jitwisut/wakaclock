use crate::models::ForegroundApp;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

pub mod idle;

pub fn current_foreground_app(include_window_title: bool) -> Result<ForegroundApp, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::current_foreground_app(include_window_title);
    }
    #[cfg(target_os = "windows")]
    {
        return windows::current_foreground_app(include_window_title);
    }
    #[allow(unreachable_code)]
    Err("desktop foreground tracking is implemented for macOS and Windows".into())
}
