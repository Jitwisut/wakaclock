//! Display-only authorship; never an actor, timing, or line-metric correction.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MatchRequest {
    pub heartbeat_id: String,
    pub base_revision: u32,
    pub agent: String,
    pub evidence_id: String,
    pub proof: String,
    pub digest: String,
    #[serde(default = "default_operation")]
    pub operation: String,
}
fn default_operation() -> String {
    "match".into()
}
impl MatchRequest {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.agent != "claude-code"
            || !matches!(self.proof.as_str(), "fingerprint" | "tool_id")
            || !matches!(self.operation.as_str(), "match" | "revoke")
            || self.base_revision > wakaclock_core::heartbeat::MAX_HEARTBEAT_REVISION
            || [&self.heartbeat_id, &self.evidence_id]
                .iter()
                .any(|v| !wakaclock_core::ai::is_safe_event_id(v))
            || self.digest.len() != 64
            || !self
                .digest
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err("invalid matched authorship request");
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct MatchedAuthorship {
    pub agent: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub digest: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct MatchResponse {
    pub status: String,
    pub digest: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wire_rejects_identity_injection_and_unbounded_or_unsupported_proof() {
        let value = serde_json::json!({"heartbeat_id":"h", "base_revision":0, "agent":"claude-code", "evidence_id":"e", "proof":"fingerprint", "digest":"a".repeat(64)});
        let request: MatchRequest = serde_json::from_value(value.clone()).unwrap();
        assert!(request.validate().is_ok());
        assert_eq!(request.operation, "match");
        for (key, bad) in [
            ("agent", serde_json::json!("cursor")),
            ("proof", serde_json::json!("time_proximity")),
            ("digest", serde_json::json!("A".repeat(64))),
            ("heartbeat_id", serde_json::json!("x".repeat(257))),
            ("operation", serde_json::json!("rebind")),
        ] {
            let mut invalid = value.clone();
            invalid[key] = bad;
            assert!(serde_json::from_value::<MatchRequest>(invalid)
                .unwrap()
                .validate()
                .is_err());
        }
        let mut injected = value;
        injected["user_id"] = serde_json::json!("other-account");
        assert!(serde_json::from_value::<MatchRequest>(injected).is_err());
    }
}
