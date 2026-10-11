//! Read-only canonical identity evidence. Missing data is unconfirmed (including
//! expired/deleted data); a successful HTTP ingress ACK alone cannot produce found.
use super::*;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Request {
    records: Vec<Identity>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Identity {
    heartbeat_id: String,
    revision: u32,
}
impl Request {
    fn validate(&self) -> bool {
        !self.records.is_empty()
            && self.records.len() <= 100
            && self.records.iter().all(|r| {
                !r.heartbeat_id.is_empty()
                    && r.heartbeat_id.len() <= 256
                    && r.heartbeat_id
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || "_.:-".contains(c))
            })
    }
}
pub(super) async fn lookup(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_stats").await?;
    if !request.validate() {
        return Err(ApiError::bad_request(
            "readback requires 1–100 bounded heartbeat identities",
        ));
    }
    let identities = request
        .records
        .into_iter()
        .map(|record| (record.heartbeat_id, record.revision))
        .collect::<Vec<_>>();
    let results = state
        .heartbeat_service
        .readback_identities(user_id, &identities)
        .await;
    Ok(Json(envelope(
        json!({"schema_version":1,"results":results}),
        "UTC",
        None,
    )))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn readback_cannot_select_another_account_or_unbounded_ids() {
        assert!(
            serde_json::from_value::<Request>(json!({"user_id":"foreign","records":[]})).is_err()
        );
        assert!(!Request {
            records: Vec::new()
        }
        .validate());
        assert!(!Request {
            records: (0..101)
                .map(|_| Identity {
                    heartbeat_id: "safe".into(),
                    revision: 0
                })
                .collect()
        }
        .validate());
        assert!(!Request {
            records: vec![Identity {
                heartbeat_id: "/private/path".into(),
                revision: 0
            }]
        }
        .validate());
        assert!(Request {
            records: vec![Identity {
                heartbeat_id: "opaque-id".into(),
                revision: 2
            }]
        }
        .validate());
    }
}
