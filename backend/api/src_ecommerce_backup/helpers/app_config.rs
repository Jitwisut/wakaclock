use crate::model::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::Path};

/// Default app name used when credentials are missing.
pub const DEFAULT_APP_NAME: &str = "where_on_sales";

/// Application credential entry loaded from disk.
#[derive(Debug, Deserialize, Serialize)]
struct AppInfo {
    app_name: String,
    app_code_3: String,
}

/// Collection of application credentials keyed by tenant identifier.
#[derive(Debug, Deserialize, Serialize)]
struct AppCredentials {
    #[serde(flatten)]
    entries: HashMap<String, AppInfo>,
}

impl AppCredentials {
    fn load_from_path(path: impl AsRef<Path>) -> AppResult<Self> {
        let path_ref = path.as_ref();
        let content = fs::read_to_string(path_ref).map_err(|err| {
            AppError::Configuration(format!(
                "Failed to read credentials file {}: {}",
                path_ref.display(),
                err
            ))
        })?;

        serde_json::from_str(&content).map_err(|err| {
            AppError::Configuration(format!(
                "Failed to parse credentials JSON {}: {}",
                path_ref.display(),
                err
            ))
        })
    }

    fn primary(&self) -> Option<&AppInfo> {
        self.entries.values().next()
    }

    fn app_name(&self) -> AppResult<&str> {
        self.primary()
            .map(|info| info.app_name.as_str())
            .ok_or_else(|| AppError::Configuration("No app_name found in credentials".to_string()))
    }
}

/// Load the primary app name from a credentials file.
///
/// This helper prefers borrowing wherever possible and only allocates when the
/// caller needs an owned `String`.
pub fn load_app_name(path: impl AsRef<Path>) -> AppResult<String> {
    let credentials = AppCredentials::load_from_path(path)?;
    Ok(credentials.app_name()?.to_owned())
}
