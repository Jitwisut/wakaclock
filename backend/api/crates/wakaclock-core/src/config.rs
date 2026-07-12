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
    pub fn load() -> Self {
        let path = Self::config_path();

        if path.exists() {
            let content = fs::read_to_string(&path).expect("failed to read config.toml");
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
        fs::write(&path, content).expect("failed to write config.toml");
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
            server_url: "http://localhost:8080".to_string(),
            api_key: None,
        }
    }
}
