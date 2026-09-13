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

        // Keep construction lazy.  Kafka-mode API replicas intentionally start
        // while ClickHouse is unavailable; request-path access/project state lives
        // in PostgreSQL and the heartbeat is durable once Kafka acknowledges it.
        // Direct/verify startup still probes ClickHouse through the migration pass
        // in `main`, and health checks continue to report the outage.
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
