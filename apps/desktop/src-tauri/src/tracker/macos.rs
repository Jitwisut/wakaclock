use crate::models::ForegroundApp;
use accessibility_sys::{
    kAXErrorSuccess, AXUIElementCopyAttributeValue, AXUIElementCreateApplication, AXUIElementRef,
};
use core_foundation::{
    base::{CFType, CFTypeRef, TCFType},
    string::CFString,
};
use objc2_app_kit::NSWorkspace;

pub fn current_foreground_app(include_window_title: bool) -> Result<ForegroundApp, String> {
    let workspace = NSWorkspace::sharedWorkspace();
    let app = workspace
        .frontmostApplication()
        .ok_or_else(|| "macOS did not report a frontmost application".to_string())?;

    let app_name = app
        .localizedName()
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Unknown application".into());
    let identifier = app
        .bundleIdentifier()
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| app_name.clone());
    let process_id = app.processIdentifier();

    // Privacy invariant: the Accessibility API is never queried unless the user explicitly
    // enabled window-title tracking. If macOS Accessibility permission has not been granted,
    // reading the focused window fails and we degrade to app-only tracking rather than stopping
    // the tracker or prompting repeatedly from the five-second tracking loop.
    let window_title = if include_window_title && process_id > 0 {
        focused_window_title(process_id)
    } else {
        None
    };

    Ok(ForegroundApp {
        app_name,
        identifier,
        pid: u32::try_from(process_id).unwrap_or_default(),
        window_title,
    })
}

fn focused_window_title(process_id: i32) -> Option<String> {
    let application_ref = unsafe { AXUIElementCreateApplication(process_id) };
    if application_ref.is_null() {
        return None;
    }
    let application = unsafe { CFType::wrap_under_create_rule(application_ref.cast()) };

    let application_element = application.as_CFTypeRef().cast_mut().cast();
    let window_ref = copy_attribute(application_element, "AXFocusedWindow")?;
    let window = unsafe { CFType::wrap_under_create_rule(window_ref) };

    let window_element = window.as_CFTypeRef().cast_mut().cast();
    let title_ref = copy_attribute(window_element, "AXTitle")?;
    let title = unsafe { CFType::wrap_under_create_rule(title_ref) }
        .downcast::<CFString>()?
        .to_string();

    if title.trim().is_empty() {
        None
    } else {
        Some(title)
    }
}

fn copy_attribute(element: AXUIElementRef, attribute: &str) -> Option<CFTypeRef> {
    let attribute = CFString::new(attribute);
    let mut value: CFTypeRef = std::ptr::null();
    let error = unsafe {
        AXUIElementCopyAttributeValue(element, attribute.as_concrete_TypeRef(), &mut value)
    };
    if error == kAXErrorSuccess && !value.is_null() {
        Some(value)
    } else {
        None
    }
}
