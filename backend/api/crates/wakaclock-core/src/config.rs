use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub user_id: Uuid,
    pub server_url: String,
    pub api_key: Option<String>,
}

impl Config {
    /// Normalize a server origin before it is persisted or passed to the API
    /// client.  The client appends `/api/v1` routes itself, so accepting a path
    /// here would produce URLs such as `/api/v1/api/v1/...` and makes it easy to
    /// accidentally point a published extension at an untrusted workspace value.
    pub fn normalize_server_url(value: &str) -> Result<String, String> {
        let trimmed = value.trim().trim_end_matches('/');
        let parsed =
            reqwest::Url::parse(trimmed).map_err(|error| format!("invalid server URL: {error}"))?;
        if !matches!(parsed.scheme(), "https" | "http") {
            return Err("server URL must use http or https".to_string());
        }
        if parsed.host_str().is_none() {
            return Err("server URL must include a host".to_string());
        }
        let host = parsed.host_str().unwrap_or_default();
        if parsed.scheme() == "http" && !matches!(host, "localhost" | "127.0.0.1" | "::1") {
            return Err("plain HTTP is allowed only for a loopback development server".to_string());
        }
        if parsed.path() != "" && parsed.path() != "/" {
            return Err("server URL must be an origin without an API path".to_string());
        }
        if parsed.query().is_some() || parsed.fragment().is_some() || !parsed.username().is_empty()
        {
            return Err(
                "server URL must not contain credentials, query parameters or fragments"
                    .to_string(),
            );
        }
        Ok(trimmed.to_string())
    }

    pub fn load() -> Self {
        let path = Self::config_path();

        if path.exists() {
            let content = fs::read_to_string(&path).expect("failed to read config.toml");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                // Migrate a config created by an older CLI to user-only access the
                // next time it is observed, before any agent can read the key.
                let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
            }
            toml::from_str(&content).expect("config.toml format is invalid")
        } else {
            let default = Self::default();
            default.save();
            default
        }
    }

    pub fn save(&self) {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("failed to create ~/.wakaclock");
        }

        let content = toml::to_string_pretty(self).expect("failed to serialize config");
        // The config contains the API key used by the always-on agent.  Keep it
        // private even when the file is created by a fresh installation.  Write to
        // a sibling first and rename so an interrupted update cannot leave a
        // half-written key behind.
        let temporary = path.with_extension(format!("toml.tmp-{}", std::process::id()));
        fs::write(&temporary, content).expect("failed to write config.toml");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))
                .expect("failed to protect config.toml");
        }
        #[cfg(windows)]
        {
            // Windows does not allow rename-over-existing. The destination is the
            // exact config file we are atomically replacing, never a user-selected
            // path, so removing it here preserves the same crash-safe temp write.
            let _ = fs::remove_file(&path);
        }
        fs::rename(&temporary, &path).expect("failed to replace config.toml");
    }

    pub fn config_path() -> PathBuf {
        let home = dirs::home_dir().expect("failed to locate home directory");
        home.join(".wakaclock").join("config.toml")
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            user_id: Uuid::new_v4(),
            // Hosted users should work without creating a local config first.  A
            // developer can still select a loopback server through the explicit
            // WAKACLOCK_SERVER_URL override or `config set-server-url` command.
            server_url: "https://api.atoaxis.com".to_string(),
            api_key: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Config;

    #[test]
    fn hosted_default_is_production_origin() {
        assert_eq!(Config::default().server_url, "https://api.atoaxis.com");
    }

    #[test]
    fn only_loopback_http_is_allowed() {
        assert!(Config::normalize_server_url("http://localhost:8080/").is_ok());
        assert!(Config::normalize_server_url("http://example.com").is_err());
        assert!(Config::normalize_server_url("https://example.com/api/v1").is_err());
    }
}
