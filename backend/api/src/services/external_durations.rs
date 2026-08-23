use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

use crate::model::external_duration::{ExternalDuration, ExternalDurationRequest};
use crate::repository::external_durations::{
    DeleteExternalDurationResult, ExternalDurationFilter, ExternalDurationRepository,
};

pub struct ExternalDurationService {
    repository: Arc<ExternalDurationRepository>,
}

impl ExternalDurationService {
    pub fn new(repository: Arc<ExternalDurationRepository>) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        request: ExternalDurationRequest,
    ) -> Result<ExternalDuration> {
        self.repository.upsert(user_id, request).await
    }

    pub async fn list(
        &self,
        user_id: Uuid,
        filter: ExternalDurationFilter,
    ) -> Result<Vec<ExternalDuration>> {
        self.repository.list(user_id, filter).await
    }

    pub async fn delete_source(
        &self,
        user_id: Uuid,
        source: &str,
    ) -> Result<DeleteExternalDurationResult> {
        self.repository.delete_source(user_id, source).await
    }
}
