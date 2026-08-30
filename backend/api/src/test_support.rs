//! Shared helpers for opt-in ClickHouse integration tests.
//!
//! These tests deliberately require `CLICKHOUSE_TEST_URL` so they cannot accidentally
//! connect to the application's normal `CLICKHOUSE_URL`. Point it at an isolated
//! ClickHouse instance before running ignored tests.

use std::sync::Arc;

use crate::config::ClickHouseConfig;
use crate::infrastructure::database::ClickHouseClient;

pub async fn clickhouse_client() -> Arc<ClickHouseClient> {
    let url = std::env::var("CLICKHOUSE_TEST_URL")
        .expect("set CLICKHOUSE_TEST_URL to an isolated ClickHouse 24.10 instance");
    let config = ClickHouseConfig {
        url,
        user: std::env::var("CLICKHOUSE_TEST_USER").ok(),
        password: std::env::var("CLICKHOUSE_TEST_PASSWORD").ok(),
        database: std::env::var("CLICKHOUSE_TEST_DATABASE")
            .unwrap_or_else(|_| "default".to_string()),
    };

    let client = Arc::new(
        ClickHouseClient::new(&config)
            .await
            .expect("connect to the isolated ClickHouse test instance"),
    );
    client
        .get_client()
        .query("CREATE DATABASE IF NOT EXISTS wakaclock")
        .execute()
        .await
        .expect("create wakaclock database in isolated ClickHouse test instance");
    client
}
