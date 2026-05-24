//! # Credentials Repository - ระบบจัดการข้อมูลรับรองความถูกต้อง
//!
//! โมดูลนี้จัดการการเก็บ, อัปเดต, และการแคชข้อมูลรับรองความถูกต้อง
//! สำหรับการเชื่อมต่อกับแพลตฟอร์มอีคอมเมิร์ซต่างๆ
//!
//! ## คุณสมบัติหลัก:
//! - Secure credential storage และ retrieval
//! - OAuth token management (access/refresh tokens)
//! - API key และ secret management
//! - Credential rotation และ expiration tracking
//! - Multi-platform support (TikTok, Shopee, Lazada, etc.)
//!
//! ## Security Features:
//! - Encryption at rest สำหรับ sensitive data
//! - Secure credential rotation
//! - Audit logging สำหรับ credential access
//! - User และ organization scoped credentials
//!
//! ## Storage:
//! - **Strapi**: Primary credential storage
//! - **Redis**: Caching สำหรับ frequently accessed credentials
//! - **Memory**: Hot cache สำหรับ active sessions
use crate::model::error::AppResult;
use crate::model::v1::platfrom::entries::StoredCredential;
use crate::model::v1::platfrom::request::credential::RotateCredentialRequest;
use async_trait::async_trait;
use chrono::{DateTime, Utc};

/// Trait สำหรับ Repository ของข้อมูลรับรองความถูกต้อง
#[async_trait]
pub trait CredentialRepository: Send + Sync {
    async fn create(&self, credential: &StoredCredential) -> AppResult<()>;
    async fn get_by_id(&self, id: &str) -> AppResult<Option<StoredCredential>>;
    async fn get_credential_by_id(&self, id: &str) -> AppResult<Option<StoredCredential>> {
        self.get_by_id(id).await
    }
    async fn get_by_user_and_platform(
        &self,
        user_id: &str,
        platform: &str,
    ) -> AppResult<Vec<StoredCredential>>;
    async fn update(&self, credential: &StoredCredential) -> AppResult<()>;
    async fn delete(&self, id: &str) -> AppResult<()>;
    async fn list_expiring(&self, before: DateTime<Utc>) -> AppResult<Vec<StoredCredential>>;
    async fn rotate_credential(
        &self,
        request: RotateCredentialRequest,
        principal_id: &str,
    ) -> AppResult<()>;
    async fn upsert_credential(&self, credential: &StoredCredential) -> AppResult<()>;
    async fn list_credentials(&self, user_id: &str) -> AppResult<Vec<StoredCredential>>;
    async fn update_permissions(
        &self,
        credential_id: uuid::Uuid,
        permissions: Vec<String>,
    ) -> AppResult<()>;
}

/// Trait สำหรับ Cache ของข้อมูลรับรองความถูกต้อง
#[async_trait]
pub trait CredentialCache: Send + Sync {
    async fn get(&self, key: &str) -> AppResult<Option<String>>;
    async fn set(&self, key: &str, value: &str, ttl_seconds: u64) -> AppResult<()>;
    async fn delete(&self, key: &str) -> AppResult<()>;
    async fn exists(&self, key: &str) -> AppResult<bool>;
    async fn get_credential(
        &self,
        platform: &str,
        account_id: &str,
    ) -> AppResult<Option<StoredCredential>>;
    async fn set_credential(&self, credential: &StoredCredential) -> AppResult<()>;
    async fn invalidate_credential(&self, platform: &str, account_id: &str) -> AppResult<()>;
    async fn invalidate_all(&self, platform: &str) -> AppResult<()>;
    async fn get_access_token(&self, platform: &str, account_id: &str)
        -> AppResult<Option<String>>;
    async fn warm_cache(&self, credentials: Vec<StoredCredential>) -> AppResult<()>;
}

/// Mock implementation ของ CredentialRepository สำหรับการทดสอบ
pub struct MockCredentialRepository;

#[async_trait]
impl CredentialRepository for MockCredentialRepository {
    async fn create(&self, _credential: &StoredCredential) -> AppResult<()> {
        Ok(())
    }

    async fn get_by_id(&self, _id: &str) -> AppResult<Option<StoredCredential>> {
        Ok(None)
    }

    async fn get_by_user_and_platform(
        &self,
        _user_id: &str,
        _platform: &str,
    ) -> AppResult<Vec<StoredCredential>> {
        Ok(vec![])
    }

    async fn update(&self, _credential: &StoredCredential) -> AppResult<()> {
        Ok(())
    }

    async fn delete(&self, _id: &str) -> AppResult<()> {
        Ok(())
    }

    async fn list_expiring(&self, _before: DateTime<Utc>) -> AppResult<Vec<StoredCredential>> {
        Ok(vec![])
    }

    async fn rotate_credential(
        &self,
        _request: RotateCredentialRequest,
        _principal_id: &str,
    ) -> AppResult<()> {
        Ok(())
    }

    async fn upsert_credential(&self, _credential: &StoredCredential) -> AppResult<()> {
        Ok(())
    }

    async fn list_credentials(&self, _user_id: &str) -> AppResult<Vec<StoredCredential>> {
        Ok(vec![])
    }

    async fn update_permissions(
        &self,
        _credential_id: uuid::Uuid,
        _permissions: Vec<String>,
    ) -> AppResult<()> {
        Ok(())
    }
}

/// Mock implementation ของ CredentialCache สำหรับการทดสอบ
pub struct MockCredentialCache;

#[async_trait]
impl CredentialCache for MockCredentialCache {
    async fn get(&self, _key: &str) -> AppResult<Option<String>> {
        Ok(None)
    }

    async fn set(&self, _key: &str, _value: &str, _ttl_seconds: u64) -> AppResult<()> {
        Ok(())
    }

    async fn delete(&self, _key: &str) -> AppResult<()> {
        Ok(())
    }

    async fn exists(&self, _key: &str) -> AppResult<bool> {
        Ok(false)
    }

    async fn get_credential(
        &self,
        _platform: &str,
        _account_id: &str,
    ) -> AppResult<Option<StoredCredential>> {
        Ok(None)
    }

    async fn set_credential(&self, _credential: &StoredCredential) -> AppResult<()> {
        Ok(())
    }

    async fn invalidate_credential(&self, _platform: &str, _account_id: &str) -> AppResult<()> {
        Ok(())
    }

    async fn invalidate_all(&self, _platform: &str) -> AppResult<()> {
        Ok(())
    }

    async fn get_access_token(
        &self,
        _platform: &str,
        _account_id: &str,
    ) -> AppResult<Option<String>> {
        Ok(None)
    }

    async fn warm_cache(&self, _credentials: Vec<StoredCredential>) -> AppResult<()> {
        Ok(())
    }
}
