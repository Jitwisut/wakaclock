use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Called by whatever payment system is wired up outside this server — this API
/// intentionally has no opinion on which processor that is. Identifies the account by
/// `username` rather than `user_id`, since a payment system's checkout flow is far more
/// likely to know the former than an internal uuid.
#[derive(Debug, Deserialize)]
pub struct UpdateSubscriptionRequest {
    pub username: String,
    /// Free-form on purpose — the server doesn't enforce a fixed set of values, since
    /// what a payment system calls its states isn't this server's concern. Only
    /// `"active"` and `"trialing"` (with an unexpired `trial_ends_at`) grant access;
    /// everything else — `"past_due"`, `"canceled"`, or any other string — does not.
    pub status: String,
    /// Unix seconds. Pass `null` to clear it (e.g. on cancellation).
    pub period_end: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct UpdateSubscriptionResponse {
    pub status: String,
    pub user_id: Uuid,
}
