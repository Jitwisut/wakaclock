use anyhow::Result;
use clickhouse::Client;

use crate::config::ClickHouseConfig;

pub struct ClickHouseClient {
    client: Client,
}

impl ClickHouseClient {
    pub async fn new(config: &ClickHouseConfig) -> Result<Self> {
        let mut client = Client::default()
            .with_url(&config.url)
            .with_database(&config.database);

        if let Some(user) = &config.user {
            client = client.with_user(user);
        }

        if let Some(password) = &config.password {
            client = client.with_password(password);
        }

        // Test connection
        client.query("SELECT 1").execute().await?;

        Ok(Self { client })
    }

    pub fn get_client(&self) -> Client {
        self.client.clone()
    }

    pub async fn health_check(&self) -> Result<()> {
        self.client.query("SELECT 1").execute().await?;
        Ok(())
    }
}
