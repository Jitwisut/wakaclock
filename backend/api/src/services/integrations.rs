use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::contracts::{CredentialVault, JobKind};
use crate::infrastructure::postgres::PostgresClient;
use crate::model::integration::{
    CreateIntegrationRequest, IntegrationConnection, IntegrationProvider,
};
use crate::services::jobs::JobService;

const PROVIDERS: &[IntegrationProvider] = &[
    IntegrationProvider {
        id: "google_calendar",
        display_name: "Google Calendar",
        auth: "oauth2",
        supports_webhooks: false,
    },
    IntegrationProvider {
        id: "microsoft_calendar",
        display_name: "Microsoft Outlook Calendar",
        auth: "oauth2",
        supports_webhooks: false,
    },
    IntegrationProvider {
        id: "microsoft_teams",
        display_name: "Microsoft Teams",
        auth: "oauth2",
        supports_webhooks: true,
    },
    IntegrationProvider {
        id: "zoom",
        display_name: "Zoom",
        auth: "oauth2",
        supports_webhooks: true,
    },
    IntegrationProvider {
        id: "slack",
        display_name: "Slack",
        auth: "oauth2",
        supports_webhooks: true,
    },
    IntegrationProvider {
        id: "github",
        display_name: "GitHub",
        auth: "oauth2",
        supports_webhooks: true,
    },
    IntegrationProvider {
        id: "gitlab",
        display_name: "GitLab",
        auth: "oauth2",
        supports_webhooks: true,
    },
    IntegrationProvider {
        id: "bitbucket",
        display_name: "Bitbucket",
        auth: "oauth2",
        supports_webhooks: true,
    },
    IntegrationProvider {
        id: "paymo",
        display_name: "Paymo",
        auth: "oauth2",
        supports_webhooks: false,
    },
    IntegrationProvider {
        id: "zube",
        display_name: "Zube",
        auth: "oauth2",
        supports_webhooks: false,
    },
    IntegrationProvider {
        id: "generic_webhook",
        display_name: "Generic webhook",
        auth: "signed_webhook",
        supports_webhooks: true,
    },
];

pub struct IntegrationService {
    postgres: Option<Arc<PostgresClient>>,
    credential_vault: Option<Arc<dyn CredentialVault>>,
}

impl IntegrationService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self {
            postgres,
            credential_vault: None,
        }
    }

    pub fn with_credential_vault(
        mut self,
        credential_vault: Option<Arc<dyn CredentialVault>>,
    ) -> Self {
        self.credential_vault = credential_vault;
        self
    }

    pub fn providers() -> &'static [IntegrationProvider] {
        PROVIDERS
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        provider: &str,
        request: CreateIntegrationRequest,
    ) -> Result<IntegrationConnection> {
        super::require_background_processor()?;
        let provider = provider_def(provider)?;
        let display_name = request.display_name.trim();
        if display_name.is_empty() || display_name.len() > 160 {
            return Err(anyhow!("display_name must contain 1-160 characters"));
        }
        let encrypted = BASE64
            .decode(request.encrypted_credentials.trim())
            .context("encrypted_credentials must be base64")?;
        if encrypted.len() < 16 || encrypted.len() > 128 * 1024 {
            return Err(anyhow!("encrypted_credentials has an invalid size"));
        }
        let vault = self
            .credential_vault
            .as_ref()
            .context("integration credential vault is not configured")?;
        // A base64 string is not evidence that a credential is encrypted. Verify the
        // authenticated envelope before it reaches PostgreSQL, then re-seal it so the
        // stored bytes always use the server's current vault version and tenant AAD.
        let plaintext = vault
            .open(user_id, &encrypted)
            .await
            .map_err(|_| anyhow!("encrypted_credentials failed vault validation"))?;
        if plaintext.is_empty() || plaintext.len() > 128 * 1024 {
            return Err(anyhow!(
                "encrypted_credentials has an invalid plaintext size"
            ));
        }
        let sealed_payload = vault
            .seal(user_id, &plaintext)
            .await
            .map_err(|_| anyhow!("failed to seal integration credentials"))?;
        if let Some(organization_id) = request.organization_id {
            self.require_org_admin(user_id, organization_id).await?;
        }
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let scopes = request.scopes;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_one(
                "INSERT INTO integration_connections
                    (id, organization_id, user_id, provider, display_name, status, scopes)
                 VALUES ($1, $2, $3, $4, $5, 'connected', $6)
                 RETURNING id, provider, display_name, status, scopes,
                           last_synced_at, created_at, disconnected_at",
                &[
                    &id,
                    &request.organization_id,
                    &user_id,
                    &provider.id,
                    &display_name,
                    &scopes,
                ],
            )
            .await
            .context("failed to create integration connection")?;
        tx.execute(
            "INSERT INTO integration_credentials
                (connection_id, encrypted_payload, key_version)
             VALUES ($1, $2, 'credential-vault-v1')",
            &[&id, &sealed_payload],
        )
        .await
        .context("failed to store encrypted integration credentials")?;
        tx.commit().await.context("commit integration connection")?;
        connection_from_row(row)
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<IntegrationConnection>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT c.id, c.provider, c.display_name, c.status, c.scopes,
                        c.last_synced_at, c.created_at, c.disconnected_at
                 FROM integration_connections c
                 LEFT JOIN organization_members m
                   ON m.organization_id = c.organization_id
                  AND m.user_id = $1 AND m.deactivated_at IS NULL
                 WHERE c.user_id = $1 OR m.user_id IS NOT NULL
                 ORDER BY c.created_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list integration connections")?;
        rows.into_iter().map(connection_from_row).collect()
    }

    pub async fn status(&self, user_id: Uuid, id: Uuid) -> Result<Option<IntegrationConnection>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT c.id, c.provider, c.display_name, c.status, c.scopes,
                        c.last_synced_at, c.created_at, c.disconnected_at
                 FROM integration_connections c
                 LEFT JOIN organization_members m
                   ON m.organization_id = c.organization_id
                  AND m.user_id = $1 AND m.deactivated_at IS NULL
                 WHERE c.id = $2 AND (c.user_id = $1 OR m.user_id IS NOT NULL)",
                &[&user_id, &id],
            )
            .await
            .context("failed to load integration connection")?;
        row.map(connection_from_row).transpose()
    }

    pub async fn request_sync(&self, user_id: Uuid, id: Uuid) -> Result<bool> {
        super::require_background_processor()?;
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let current = tx
            .query_opt(
                "SELECT c.status, c.sync_generation
                   FROM integration_connections c
                  WHERE c.id = $2 AND c.disconnected_at IS NULL
                    AND (c.user_id = $1 OR EXISTS (
                        SELECT 1 FROM organization_members m
                         WHERE m.organization_id = c.organization_id
                           AND m.user_id = $1 AND m.role IN ('owner', 'admin')
                           AND m.deactivated_at IS NULL
                    ))
                  FOR UPDATE",
                &[&user_id, &id],
            )
            .await
            .context("failed to load integration connection for sync")?;
        let Some(current) = current else {
            tx.rollback().await?;
            return Ok(false);
        };

        let status: String = current.get("status");
        if status == "syncing" {
            // A retry while a sync job is still queued/running must reuse the
            // existing request. Do not trust `integration_connections.status`
            // alone: a worker can be dead-lettered after the status was changed
            // to syncing. The generation in the durable job payload lets this
            // path distinguish an active retry from a stale syncing row.
            let generation: i64 = current.get("sync_generation");
            let connection_id = id.to_string();
            let generation_text = generation.to_string();
            let active_job = tx
                .query_opt(
                    "SELECT status
                       FROM async_jobs
                      WHERE kind = $1
                        AND params->>'connection_id' = $2
                        AND params->>'sync_generation' = $3
                      ORDER BY requested_at DESC
                      LIMIT 1",
                    &[
                        &JobKind::IntegrationSync.routing_key(),
                        &connection_id,
                        &generation_text,
                    ],
                )
                .await
                .context("inspect existing integration sync job")?;
            if active_job
                .map(|row| row.get::<_, String>("status"))
                .is_some_and(|status| matches!(status.as_str(), "queued" | "running"))
            {
                tx.commit()
                    .await
                    .context("commit existing integration sync request")?;
                return Ok(true);
            }
        }

        let generation: i64 = tx
            .query_one(
                "UPDATE integration_connections
                    SET status = 'syncing', sync_generation = sync_generation + 1
                  WHERE id = $1
                RETURNING sync_generation",
                &[&id],
            )
            .await
            .context("failed to mark integration sync as queued")?
            .get("sync_generation");
        let idempotency_key = format!("integration-sync:v1:{id}:{generation}");
        JobService::create_in_transaction(
            &tx,
            Some(user_id),
            JobKind::IntegrationSync,
            serde_json::json!({
                "schema_version": 1,
                "connection_id": id,
                "sync_generation": generation,
            }),
            Some(&idempotency_key),
        )
        .await
        .context("failed to enqueue integration sync job")?;
        tx.commit()
            .await
            .context("commit integration sync request")?;
        Ok(true)
    }

    pub async fn disconnect(&self, user_id: Uuid, id: Uuid) -> Result<Option<String>> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "UPDATE integration_connections c
                    SET status = 'disconnected', disconnected_at = now()
                  WHERE c.id = $2 AND c.disconnected_at IS NULL
                    AND (c.user_id = $1 OR EXISTS (
                        SELECT 1 FROM organization_members m
                         WHERE m.organization_id = c.organization_id
                           AND m.user_id = $1 AND m.role IN ('owner', 'admin')
                           AND m.deactivated_at IS NULL
                    ))
                 RETURNING provider",
                &[&user_id, &id],
            )
            .await
            .context("failed to disconnect integration")?;
        if let Some(row) = row {
            let connection_id = id.to_string();
            tx.execute(
                "UPDATE async_jobs
                    SET status = 'cancelled', finished_at = now(),
                        lease_owner = NULL, lease_expires_at = NULL
                  WHERE kind = $1
                    AND params->>'connection_id' = $2
                    AND status IN ('queued', 'running')",
                &[&JobKind::IntegrationSync.routing_key(), &connection_id],
            )
            .await
            .context("cancel pending integration sync jobs")?;
            tx.execute(
                "DELETE FROM integration_credentials WHERE connection_id = $1",
                &[&id],
            )
            .await
            .context("failed to remove integration credentials")?;
            tx.commit().await.context("commit integration disconnect")?;
            Ok(Some(row.get("provider")))
        } else {
            tx.rollback().await?;
            Ok(None)
        }
    }

    /// Mark a sync successful only when the worker still owns the connection's
    /// generation. A replayed or stale job must not make a newer sync appear complete.
    pub async fn mark_sync_succeeded(
        &self,
        connection_id: Uuid,
        sync_generation: i64,
    ) -> Result<bool> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let changed = tx
            .execute(
                "UPDATE integration_connections
                    SET status = 'connected', last_synced_at = now()
                  WHERE id = $1 AND sync_generation = $2
                    AND status = 'syncing' AND disconnected_at IS NULL",
                &[&connection_id, &sync_generation],
            )
            .await
            .context("mark integration sync successful")?;
        if changed == 0 {
            tx.rollback().await?;
            return Ok(false);
        }
        tx.execute(
            "INSERT INTO integration_sync_states
                (connection_id, last_success_at, last_error, retry_count)
             VALUES ($1, now(), NULL, 0)
             ON CONFLICT (connection_id) DO UPDATE SET
                last_success_at = EXCLUDED.last_success_at,
                last_error = NULL,
                retry_count = 0,
                updated_at = now()",
            &[&connection_id],
        )
        .await
        .context("record integration sync success")?;
        tx.commit()
            .await
            .context("commit integration sync success")?;
        Ok(true)
    }

    /// Record a bounded failure for the current generation. The error code is
    /// intentionally the only failure detail persisted so provider responses or
    /// credentials cannot leak into connection status.
    pub async fn mark_sync_failed(
        &self,
        connection_id: Uuid,
        sync_generation: i64,
        error_code: &str,
    ) -> Result<bool> {
        validate_sync_error_code(error_code)?;
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let changed = tx
            .execute(
                "UPDATE integration_connections
                    SET status = 'error'
                  WHERE id = $1 AND sync_generation = $2
                    AND status = 'syncing' AND disconnected_at IS NULL",
                &[&connection_id, &sync_generation],
            )
            .await
            .context("mark integration sync failed")?;
        if changed == 0 {
            tx.rollback().await?;
            return Ok(false);
        }
        tx.execute(
            "INSERT INTO integration_sync_states
                (connection_id, last_error, retry_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (connection_id) DO UPDATE SET
                last_error = EXCLUDED.last_error,
                retry_count = integration_sync_states.retry_count + 1,
                updated_at = now()",
            &[&connection_id, &error_code],
        )
        .await
        .context("record integration sync failure")?;
        tx.commit()
            .await
            .context("commit integration sync failure")?;
        Ok(true)
    }
}

fn validate_sync_error_code(error_code: &str) -> Result<()> {
    if error_code.is_empty()
        || error_code.len() > 64
        || !error_code.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'_' | b'-' | b'.')
        })
    {
        anyhow::bail!("integration sync error code is invalid");
    }
    Ok(())
}

impl IntegrationService {
    async fn require_org_admin(&self, user_id: Uuid, organization_id: Uuid) -> Result<()> {
        let postgres = self.required()?;
        let allowed = postgres
            .client()
            .query_opt(
                "SELECT 1 FROM organization_members
                 WHERE organization_id = $1 AND user_id = $2
                   AND role IN ('owner', 'admin') AND deactivated_at IS NULL",
                &[&organization_id, &user_id],
            )
            .await
            .context("failed to resolve organization integration permission")?
            .is_some();
        if allowed {
            Ok(())
        } else {
            Err(anyhow!("organization admin permission is required"))
        }
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn provider_def(id: &str) -> Result<&'static IntegrationProvider> {
    PROVIDERS
        .iter()
        .find(|provider| provider.id == id)
        .ok_or_else(|| anyhow!("unsupported integration provider"))
}

fn connection_from_row(row: Row) -> Result<IntegrationConnection> {
    Ok(IntegrationConnection {
        id: row.try_get("id")?,
        provider: row.try_get("provider")?,
        display_name: row.try_get("display_name")?,
        status: row.try_get("status")?,
        scopes: row.try_get("scopes")?,
        last_synced_at: row.try_get::<_, Option<DateTime<Utc>>>("last_synced_at")?,
        created_at: row.try_get("created_at")?,
        disconnected_at: row.try_get("disconnected_at")?,
    })
}
