use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

use crate::model::follow_up::{HumanFollowUpEventRequest, HumanFollowUpStats};
use crate::repository::follow_up::FollowUpRepository;

pub struct FollowUpService {
    repository: Arc<FollowUpRepository>,
}

impl FollowUpService {
    pub fn new(repository: Arc<FollowUpRepository>) -> Self {
        Self { repository }
    }

    pub async fn record(&self, user_id: Uuid, request: HumanFollowUpEventRequest) -> Result<()> {
        self.repository.insert(user_id, request).await
    }

    pub async fn stats(&self, user_id: Uuid, start: f64, end: f64) -> Result<HumanFollowUpStats> {
        let event_count = self.repository.count(user_id, start, end).await?;
        Ok(HumanFollowUpStats {
            event_count,
            eligible_ai_changes: None,
            human_follow_up_rate: None,
            coverage: "follow_up_events_only",
        })
    }
}
