use crate::models::ForegroundApp;
use std::path::Path;
use windows_sys::Win32::{
    Foundation::CloseHandle,
    System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    },
    UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId},
};

pub fn current_foreground_app(include_window_title: bool) -> Result<ForegroundApp, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return Err("Windows did not report a foreground window".into());
        }

        let mut pid = 0_u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return Err("could not resolve foreground process id".into());
        }

        // Privacy invariant: do not even ask Windows for the title until the user has
        // enabled title consent. This keeps raw titles out of memory and out of policy
        // processing in the default configuration.
        let window_title = if include_window_title {
            let mut title_buffer = vec![0_u16; 1024];
            let title_len =
                GetWindowTextW(hwnd, title_buffer.as_mut_ptr(), title_buffer.len() as i32);
            if title_len > 0 {
                String::from_utf16(&title_buffer[..title_len as usize]).ok()
            } else {
                None
            }
        } else {
            None
        };

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return Err(format!("could not inspect foreground process {pid}"));
        }

        let mut path_buffer = vec![0_u16; 2048];
        let mut path_len = path_buffer.len() as u32;
        let query_ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            path_buffer.as_mut_ptr(),
            &mut path_len,
        );
        let _ = CloseHandle(handle);
        if query_ok == 0 {
            return Err(format!("could not read executable path for process {pid}"));
        }

        let executable_path = String::from_utf16(&path_buffer[..path_len as usize])
            .map_err(|error| error.to_string())?;
        let identifier = Path::new(&executable_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(&executable_path)
            .to_string();
        let app_name = identifier
            .strip_suffix(".exe")
            .or_else(|| identifier.strip_suffix(".EXE"))
            .unwrap_or(&identifier)
            .to_string();

        Ok(ForegroundApp {
            app_name,
            identifier,
            pid,
            window_title,
        })
    }
}
