use crate::{
    models::{DesktopCategory, ForegroundApp, TrackedActivity},
    settings::DesktopSettings,
};
use sysinfo::{ProcessesToUpdate, System};

pub fn sanitize_activity(
    app: &ForegroundApp,
    settings: &DesktopSettings,
) -> Option<TrackedActivity> {
    if settings.private_mode || is_denied_app(&app.app_name, settings) {
        return None;
    }

    let title = app.window_title.as_deref().unwrap_or_default().trim();
    if !title.is_empty() && is_denied_title(title, settings) {
        return None;
    }

    let rule = settings.rules.iter().find(|rule| {
        rule.enabled
            && rule.identifiers.iter().any(|identifier| {
                identifier.eq_ignore_ascii_case(&app.identifier)
                    || identifier.eq_ignore_ascii_case(&app.app_name)
            })
    })?;

    let entity = if rule.category == DesktopCategory::Meeting && is_zoom_rule(&rule.id) {
        if !zoom_meeting_active(app) {
            return None;
        }
        if settings.title_tracking && !title.is_empty() {
            sanitize_title(title)
        } else {
            "Zoom Meeting".to_string()
        }
    } else {
        app.app_name.clone()
    };

    Some(TrackedActivity {
        app_name: app.app_name.clone(),
        identifier: app.identifier.clone(),
        entity,
        category: rule.category,
    })
}

fn is_denied_app(app_name: &str, settings: &DesktopSettings) -> bool {
    let normalized = app_name.to_ascii_lowercase();
    settings
        .denied_app_names
        .iter()
        .any(|name| normalized.contains(&name.to_ascii_lowercase()))
}

fn is_denied_title(title: &str, settings: &DesktopSettings) -> bool {
    let normalized = title.to_ascii_lowercase();
    settings
        .denied_window_patterns
        .iter()
        .any(|pattern| normalized.contains(&pattern.to_ascii_lowercase()))
}

fn sanitize_title(title: &str) -> String {
    let trimmed = title.trim();
    let value: String = trimmed.chars().take(256).collect();
    if value.is_empty() {
        "Zoom Meeting".into()
    } else {
        value
    }
}

fn is_zoom_rule(rule_id: &str) -> bool {
    rule_id.eq_ignore_ascii_case("zoom")
}

fn zoom_meeting_active(app: &ForegroundApp) -> bool {
    if app
        .window_title
        .as_deref()
        .map(|title| {
            let lower = title.to_ascii_lowercase();
            lower.contains("zoom meeting")
                || lower.contains("zoom webinar")
                || lower.contains("meeting controls")
        })
        .unwrap_or(false)
    {
        return true;
    }

    // Zoom launches CptHost while a meeting/webinar renderer is active on both
    // macOS and Windows. It is intentionally used only as a positive meeting signal;
    // the mere presence of the Zoom home screen is not enough to emit a meeting.
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    system.processes().values().any(|process| {
        let name = process.name().to_string_lossy().to_ascii_lowercase();
        name == "cpthost" || name == "cpthost.exe"
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::DesktopSettings;

    fn app(name: &str, identifier: &str, title: Option<&str>) -> ForegroundApp {
        ForegroundApp {
            app_name: name.into(),
            identifier: identifier.into(),
            pid: 42,
            window_title: title.map(str::to_string),
        }
    }

    #[test]
    fn private_mode_suppresses_everything() {
        let settings = DesktopSettings {
            private_mode: true,
            ..DesktopSettings::default()
        };
        assert!(sanitize_activity(&app("Code", "code.exe", None), &settings).is_none());
    }

    #[test]
    fn denylisted_app_never_leaves_the_machine() {
        let settings = DesktopSettings::default();
        assert!(sanitize_activity(&app("1Password 8", "1password.exe", None), &settings).is_none());
    }

    #[test]
    fn unknown_apps_are_not_misclassified_as_coding() {
        let settings = DesktopSettings::default();
        assert!(sanitize_activity(&app("Photos", "com.apple.Photos", None), &settings).is_none());
    }

    #[test]
    fn matching_cross_platform_rule_maps_category() {
        let settings = DesktopSettings::default();
        let activity =
            sanitize_activity(&app("Visual Studio Code", "code.exe", None), &settings).unwrap();
        assert_eq!(activity.category, DesktopCategory::Coding);
        assert_eq!(activity.entity, "Visual Studio Code");
    }

    #[test]
    fn sensitive_title_is_blocked_before_title_consent_is_considered() {
        let settings = DesktopSettings {
            title_tracking: true,
            ..DesktopSettings::default()
        };
        assert!(sanitize_activity(
            &app("Code", "code.exe", Some("password reset notes")),
            &settings
        )
        .is_none());
    }
}
