pub fn idle_seconds() -> Result<f64, String> {
    #[cfg(target_os = "macos")]
    {
        return macos_idle_seconds();
    }
    #[cfg(target_os = "windows")]
    {
        return windows_idle_seconds();
    }
    #[allow(unreachable_code)]
    Ok(0.0)
}

#[cfg(target_os = "macos")]
fn macos_idle_seconds() -> Result<f64, String> {
    const COMBINED_SESSION_STATE: u32 = 0;
    const ANY_INPUT_EVENT: u32 = u32::MAX;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state_id: u32, event_type: u32) -> f64;
    }

    let seconds =
        unsafe { CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, ANY_INPUT_EVENT) };
    if seconds.is_finite() && seconds >= 0.0 {
        Ok(seconds)
    } else {
        Err("CoreGraphics returned an invalid idle duration".into())
    }
}

#[cfg(target_os = "windows")]
fn windows_idle_seconds() -> Result<f64, String> {
    use std::mem::size_of;
    use windows_sys::Win32::{
        System::SystemInformation::GetTickCount,
        UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
    };

    let mut input = LASTINPUTINFO {
        cbSize: size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    if unsafe { GetLastInputInfo(&mut input) } == 0 {
        return Err("GetLastInputInfo failed".into());
    }
    let now = unsafe { GetTickCount() };
    Ok(now.wrapping_sub(input.dwTime) as f64 / 1000.0)
}
