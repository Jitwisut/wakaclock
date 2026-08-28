use crate::models::{AppRule, DesktopCategory};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DesktopSettings {
    pub enabled: bool,
    pub idle_timeout_seconds: u64,
    pub private_mode: bool,
    pub title_tracking: bool,
    pub denied_app_names: Vec<String>,
    pub denied_window_patterns: Vec<String>,
    pub rules: Vec<AppRule>,
}

impl DesktopSettings {
    pub fn load() -> Result<Self, String> {
        let path = Self::path();
        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Self::default()),
            Err(error) => {
                return Err(format!("failed to read {}: {error}", path.display()));
            }
        };
        let settings: Self = toml::from_str(&content)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        settings.validate()?;
        Ok(settings)
    }

    pub(crate) fn fail_closed() -> Self {
        Self {
            enabled: false,
            private_mode: true,
            ..Self::default()
        }
    }

    pub fn save(&self) -> Result<(), String> {
        self.validate()?;
        let path = Self::path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let content = toml::to_string_pretty(self).map_err(|error| error.to_string())?;
        let temporary_path = path.with_extension(format!("toml.tmp-{}", std::process::id()));
        fs::write(&temporary_path, content).map_err(|error| error.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&temporary_path, fs::Permissions::from_mode(0o600))
                .map_err(|error| error.to_string())?;
        }
        replace_settings_file(&temporary_path, &path)
    }

    pub fn validate(&self) -> Result<(), String> {
        if !(60..=86_400).contains(&self.idle_timeout_seconds) {
            return Err("idle timeout must be between 60 seconds and 24 hours".into());
        }
        if self
            .rules
            .iter()
            .any(|rule| rule.id.trim().is_empty() || rule.label.trim().is_empty())
        {
            return Err("app rules require a non-empty id and label".into());
        }
        Ok(())
    }

    pub fn path() -> PathBuf {
        dirs::home_dir()
            .expect("failed to locate home directory")
            .join(".wakaclock")
            .join("desktop.toml")
    }
}

fn replace_settings_file(source: &Path, destination: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        };

        let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
        let destination_wide: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        let result = unsafe {
            MoveFileExW(
                source_wide.as_ptr(),
                destination_wide.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if result == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        fs::rename(source, destination).map_err(|error| error.to_string())
    }
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            idle_timeout_seconds: 15 * 60,
            private_mode: false,
            title_tracking: false,
            denied_app_names: vec![
                "1Password".into(),
                "Keychain Access".into(),
                "KeePass".into(),
                "LastPass".into(),
            ],
            denied_window_patterns: vec![
                "bank".into(),
                "medical".into(),
                "health".into(),
                "password".into(),
                "incognito".into(),
                "private".into(),
            ],
            rules: default_rules(),
        }
    }
}

fn rule(id: &str, label: &str, identifiers: &[&str], category: DesktopCategory) -> AppRule {
    AppRule {
        id: id.into(),
        label: label.into(),
        identifiers: identifiers.iter().map(|value| (*value).into()).collect(),
        enabled: true,
        category,
    }
}

fn default_rules() -> Vec<AppRule> {
    vec![
        rule(
            "vscode",
            "Visual Studio Code",
            &["com.microsoft.VSCode", "code.exe"],
            DesktopCategory::Coding,
        ),
        rule(
            "cursor",
            "Cursor",
            &["com.todesktop.230313mzl4w4u92", "cursor.exe"],
            DesktopCategory::Coding,
        ),
        rule(
            "xcode",
            "Xcode",
            &["com.apple.dt.Xcode"],
            DesktopCategory::Coding,
        ),
        rule(
            "zed",
            "Zed",
            &["dev.zed.Zed", "zed.exe"],
            DesktopCategory::Coding,
        ),
        rule(
            "figma",
            "Figma",
            &["com.figma.Desktop", "figma.exe"],
            DesktopCategory::Designing,
        ),
        rule(
            "sketch",
            "Sketch",
            &["com.bohemiancoding.sketch3"],
            DesktopCategory::Designing,
        ),
        rule(
            "blender",
            "Blender",
            &["org.blenderfoundation.blender", "blender.exe"],
            DesktopCategory::Modeling,
        ),
        rule(
            "slack",
            "Slack",
            &["com.tinyspeck.slackmacgap", "slack.exe"],
            DesktopCategory::Communicating,
        ),
        rule(
            "discord",
            "Discord",
            &["com.hnc.Discord", "discord.exe"],
            DesktopCategory::Communicating,
        ),
        rule(
            "teams",
            "Microsoft Teams",
            &["com.microsoft.teams2", "ms-teams.exe", "teams.exe"],
            DesktopCategory::Communicating,
        ),
        rule(
            "zoom",
            "Zoom",
            &["us.zoom.xos", "zoom.exe", "zoom.us"],
            DesktopCategory::Meeting,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn privacy_defaults_remain_conservative() {
        let settings = DesktopSettings::default();
        assert_eq!(settings.idle_timeout_seconds, 900);
        assert!(!settings.title_tracking);
        assert!(!settings.private_mode);
        assert!(settings
            .denied_app_names
            .iter()
            .any(|name| name == "1Password"));
    }

    #[test]
    fn load_failure_defaults_are_fail_closed() {
        let settings = DesktopSettings::fail_closed();
        assert!(!settings.enabled);
        assert!(settings.private_mode);
        assert!(!settings.title_tracking);
    }

    #[test]
    fn default_rules_cover_both_desktop_platforms() {
        let settings = DesktopSettings::default();
        let vscode = settings
            .rules
            .iter()
            .find(|rule| rule.id == "vscode")
            .unwrap();
        assert!(vscode
            .identifiers
            .iter()
            .any(|id| id == "com.microsoft.VSCode"));
        assert!(vscode.identifiers.iter().any(|id| id == "code.exe"));
    }
}
