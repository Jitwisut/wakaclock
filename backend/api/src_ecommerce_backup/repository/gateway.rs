//! # Gateway Repository - ระบบจัดการ Gateway Data
//!
//! โมดูลนี้จัดการข้อมูลที่เกี่ยวข้องกับ Gateway API layer
//! รวมถึงการจัดการ requests, responses, และ metadata
//!
//! ## คุณสมบัติหลัก:
//! - Request/Response logging และ tracking
//! - API gateway metrics และ analytics
//! - Rate limiting data storage
//! - Gateway configuration management
//! - Load balancing และ routing information
//!
//! ## Data Types:
//! - **Gateway Requests**: ข้อมูล incoming requests
//! - **Gateway Responses**: Response data และ status codes
//! - **Routing Rules**: กฎเกณฑ์การ route requests
//! - **Metrics Data**: Performance และ usage statistics

use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::sync::Arc;

use crate::client::database::clickhouse::ClickHouseClient;
use crate::infrastructure::logger::Logger;

/// OAuth state entity
#[derive(Debug, Clone)]
pub struct OAuthStateEntity {
    pub platform: String,
    pub state: String,
    pub shop_id: String,
    pub org_id: String,
    pub redirect_uri: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Platform connection entity
#[derive(Debug, Clone)]
pub struct PlatformConnectionEntity {
    pub platform: String,
    pub shop_id: String,
    pub org_id: String,
    pub user_id: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Gateway repository trait for data access
#[async_trait]
pub trait GatewayRepository: Send + Sync {
    /// Insert OAuth state
    async fn insert_oauth_state(&self, state: &OAuthStateEntity) -> Result<()>;

    /// Find OAuth state by state token
    async fn find_oauth_state_by_token(&self, state: &str) -> Result<Option<OAuthStateEntity>>;

    /// Delete OAuth state
    async fn delete_oauth_state(&self, state: &str) -> Result<()>;

    /// Insert or update platform connection
    async fn upsert_platform_connection(&self, connection: &PlatformConnectionEntity)
        -> Result<()>;

    /// Find platform connection
    async fn find_platform_connection(
        &self,
        platform: &str,
        shop_id: &str,
    ) -> Result<Option<PlatformConnectionEntity>>;

    /// Update platform connection status
    async fn update_platform_connection_status(
        &self,
        platform: &str,
        shop_id: &str,
        status: &str,
    ) -> Result<()>;

    /// Count active connections for platform
    async fn count_active_connections(&self, platform: &str) -> Result<i64>;

    /// Get connections by organization
    async fn get_connections_by_org(&self, org_id: &str) -> Result<Vec<PlatformConnectionEntity>>;
}

/// Gateway repository implementation using ClickHouse
pub struct GatewayRepositoryImpl {
    clickhouse: Arc<ClickHouseClient>,
    logger: Arc<Logger>,
}

impl GatewayRepositoryImpl {
    pub fn new(clickhouse: Arc<ClickHouseClient>, logger: Arc<Logger>) -> Self {
        Self { clickhouse, logger }
    }
}

#[async_trait]
impl GatewayRepository for GatewayRepositoryImpl {
    async fn insert_oauth_state(&self, state: &OAuthStateEntity) -> Result<()> {
        let query = r#"
            INSERT INTO oauth_state (
                platform, state, shop_id, org_id,
                redirect_uri, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        "#;

        self.clickhouse
            .get_client()
            .query(query)
            .bind(&state.platform)
            .bind(&state.state)
            .bind(&state.shop_id)
            .bind(&state.org_id)
            .bind(state.redirect_uri.as_deref().unwrap_or(""))
            .bind(state.created_at)
            .execute()
            .await?;

        self.logger.debug(
            &format!("Inserted OAuth state for platform: {}", state.platform),
            None,
        );

        Ok(())
    }

    async fn find_oauth_state_by_token(&self, state: &str) -> Result<Option<OAuthStateEntity>> {
        #[derive(clickhouse::Row, serde::Deserialize)]
        struct OAuthStateRow {
            platform: String,
            state: String,
            shop_id: String,
            org_id: String,
            redirect_uri: Option<String>,
            created_at: chrono::DateTime<chrono::Utc>,
        }

        let query = r#"
            SELECT platform, state, shop_id, org_id, user_id, redirect_uri, created_at
            FROM oauth_state
            WHERE state = ?
            ORDER BY created_at DESC
            LIMIT 1
        "#;

        let mut cursor = self
            .clickhouse
            .get_client()
            .query(query)
            .bind(state)
            .fetch::<OAuthStateRow>()?;

        if let Some(row) = cursor.next().await? {
            self.logger
                .debug(&format!("Found OAuth state: {}", state), None);

            Ok(Some(OAuthStateEntity {
                platform: row.platform,
                state: row.state,
                shop_id: row.shop_id,
                org_id: row.org_id,
                redirect_uri: row.redirect_uri,
                created_at: row.created_at,
            }))
        } else {
            self.logger
                .debug(&format!("OAuth state not found: {}", state), None);
            Ok(None)
        }
    }

    async fn delete_oauth_state(&self, state: &str) -> Result<()> {
        let query = r#"
            ALTER TABLE oauth_state
            DELETE WHERE state = ?
        "#;

        self.clickhouse
            .get_client()
            .query(query)
            .bind(state)
            .execute()
            .await?;

        self.logger
            .debug(&format!("Deleted OAuth state: {}", state), None);

        Ok(())
    }

    async fn upsert_platform_connection(
        &self,
        connection: &PlatformConnectionEntity,
    ) -> Result<()> {
        // ClickHouse doesn't have native UPSERT, using INSERT with ReplacingMergeTree
        let query = r#"
            INSERT INTO platform_connections (
                platform, shop_id, org_id, user_id, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        "#;

        self.clickhouse
            .get_client()
            .query(query)
            .bind(&connection.platform)
            .bind(&connection.shop_id)
            .bind(&connection.org_id)
            .bind(&connection.user_id)
            .bind(&connection.status)
            .bind(connection.created_at)
            .bind(connection.updated_at)
            .execute()
            .await?;

        self.logger.debug(
            &format!(
                "Upserted platform connection: {} - {}",
                connection.platform, connection.shop_id
            ),
            None,
        );

        Ok(())
    }

    async fn find_platform_connection(
        &self,
        platform: &str,
        shop_id: &str,
    ) -> Result<Option<PlatformConnectionEntity>> {
        #[derive(clickhouse::Row, serde::Deserialize)]
        struct ConnectionRow {
            platform: String,
            shop_id: String,
            org_id: String,
            user_id: String,
            status: String,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        let query = r#"
            SELECT platform, shop_id, org_id, user_id, status, created_at, updated_at
            FROM platform_connections
            WHERE platform = ? AND shop_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
        "#;

        let mut cursor = self
            .clickhouse
            .get_client()
            .query(query)
            .bind(platform)
            .bind(shop_id)
            .fetch::<ConnectionRow>()?;

        if let Some(row) = cursor.next().await? {
            self.logger.debug(
                &format!("Found platform connection: {} - {}", platform, shop_id),
                None,
            );

            Ok(Some(PlatformConnectionEntity {
                platform: row.platform,
                shop_id: row.shop_id,
                org_id: row.org_id,
                user_id: row.user_id,
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            self.logger.debug(
                &format!("Platform connection not found: {} - {}", platform, shop_id),
                None,
            );
            Ok(None)
        }
    }

    async fn update_platform_connection_status(
        &self,
        platform: &str,
        shop_id: &str,
        status: &str,
    ) -> Result<()> {
        let query = r#"
            ALTER TABLE platform_connections
            UPDATE status = ?, updated_at = ?
            WHERE platform = ? AND shop_id = ?
        "#;

        self.clickhouse
            .get_client()
            .query(query)
            .bind(status)
            .bind(Utc::now())
            .bind(platform)
            .bind(shop_id)
            .execute()
            .await?;

        self.logger.debug(
            &format!(
                "Updated platform connection status: {} - {} to {}",
                platform, shop_id, status
            ),
            None,
        );

        Ok(())
    }

    async fn count_active_connections(&self, platform: &str) -> Result<i64> {
        // TODO: Implement with proper Row struct for COUNT query
        self.logger.debug(
            &format!("Counting active connections for platform: {}", platform),
            None,
        );

        Ok(0)
    }

    async fn get_connections_by_org(&self, org_id: &str) -> Result<Vec<PlatformConnectionEntity>> {
        // TODO: Implement with proper Row struct
        self.logger
            .debug(&format!("Getting connections for org: {}", org_id), None);

        Ok(Vec::new())
    }
}
