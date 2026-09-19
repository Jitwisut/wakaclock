//! Offline-reliability Phase 00 — in-process delivery contracts.
//!
//! Everything here is pure (classification over messages/errors) or goes through
//! `Queue::open_at` on a disposable path. Nothing in this file resolves the home
//! directory: `ApiClient` send/flush/today and `Config::load` read and write
//! `~/.wakaclock`, so those paths are exercised only from child processes in
//! `wakaclock-cli/tests/offline_lifecycle.rs`.
//!
//! Tests marked `#[ignore = "OFF-.. baseline: ..."]` assert the target contract and
//! fail on the pre-fix code. Run them with `WAKACLOCK_OFFLINE_BASELINE=1 cargo test -p
//! wakaclock-core --test offline_delivery -- --include-ignored`; the phase that fixes the bug removes the
//! attribute. Never weaken the assertion to make one pass.

use rusqlite::Connection;
use std::path::{Path, PathBuf};
use wakaclock_core::{
    api_client::{
        classify_delivery_failure, is_retryable_delivery_error, retry_after_seconds, ApiClient,
        DeliveryFailureKind,
    },
    config::Config,
    error::AppError,
    queue::{Queue, QueueScope},
};

/// Baseline tests are expected to fail until their phase lands. CI's ClickHouse
/// job runs `cargo test --workspace -- --ignored`, so `#[ignore]` alone would put
/// them in that sweep; they only execute when this variable is also set.
fn offline_baseline_enabled() -> bool {
    if std::env::var_os("WAKACLOCK_OFFLINE_BASELINE").is_some() {
        return true;
    }
    eprintln!("skipped: set WAKACLOCK_OFFLINE_BASELINE=1 to run offline baseline tests");
    false
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Disposable directory for one test. Removed on drop, including on panic.
struct TempDir(PathBuf);

impl TempDir {
    fn new(name: &str) -> Self {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "wakaclock-offline-delivery-{name}-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }

    fn queue_path(&self) -> PathBuf {
        self.0.join("queue.db")
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Metadata-only view of one queue row. Payload bytes are deliberately not
/// returned so assertions cannot depend on (or print) captured content.
#[derive(Debug, Clone, PartialEq, Eq)]
struct QueueRowMeta {
    heartbeat_id: Option<String>,
    destination: String,
    owner_scope: String,
    retry_count: i64,
    leased: bool,
}

fn queue_rows(path: &Path) -> Vec<QueueRowMeta> {
    let connection = Connection::open(path).unwrap();
    let mut statement = connection
        .prepare(
            "SELECT heartbeat_id, destination, owner_scope, retry_count, lease_owner
             FROM heartbeat_queue ORDER BY id",
        )
        .unwrap();
    statement
        .query_map([], |row| {
            Ok(QueueRowMeta {
                heartbeat_id: row.get(0)?,
                destination: row.get(1)?,
                owner_scope: row.get(2)?,
                retry_count: row.get(3)?,
                leased: row.get::<_, Option<String>>(4)?.is_some(),
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}

fn config(server_url: &str, api_key: &str) -> Config {
    Config {
        user_id: uuid::Uuid::nil(),
        server_url: server_url.to_string(),
        api_key: Some(api_key.to_string()),
    }
}

fn scope_for(server_url: &str, api_key: &str) -> QueueScope {
    ApiClient::new(config(server_url, api_key))
        .unwrap()
        .queue_scope()
}

fn payload(heartbeat_id: &str, time: f64) -> serde_json::Value {
    serde_json::json!({
        "heartbeat_id": heartbeat_id,
        "entity": format!("/fixture/{heartbeat_id}.rs"),
        "type": "file",
        "category": "coding",
        "time": time,
        "active_seconds": 30.0,
    })
}

fn http_status(status: u16, retry_after: Option<u64>) -> AppError {
    AppError::HttpStatusRetry {
        status,
        message: "fixture".to_string(),
        retry_after_seconds: retry_after,
    }
}

// The exact `Display` shapes the CLI persists into `last-delivery-failure.json`
// for a transport error with no HTTP response. The URL is part of reqwest's
// message, so a port or host that happens to contain "402"/"401" must not change
// the classification.
const CONNECT_REFUSED_ON_PORT_40213: &str =
    "HTTP error: error sending request for url (http://127.0.0.1:40213/api/v1/heartbeats)";
const CONNECT_REFUSED_ON_PORT_54017: &str =
    "HTTP error: error sending request for url (http://127.0.0.1:54017/api/v1/heartbeats)";
const CONNECT_REFUSED_PLAIN: &str =
    "HTTP error: error sending request for url (http://127.0.0.1:9/api/v1/heartbeats)";

// ---------------------------------------------------------------------------
// OFF-01 — transport failure vs entitlement failure
// ---------------------------------------------------------------------------

#[test]
#[ignore = "OFF-01 baseline: a transport error whose URL contains \"402\" is classified as payment_402"]
fn network_failure_is_not_reported_as_subscription_required() {
    if !offline_baseline_enabled() {
        return;
    }
    let kind = classify_delivery_failure(CONNECT_REFUSED_ON_PORT_40213);
    assert_ne!(
        kind,
        DeliveryFailureKind::Payment402,
        "a connection failure must never be classified as an entitlement failure"
    );
    assert_eq!(kind, DeliveryFailureKind::Network);
}

#[test]
#[ignore = "OFF-01 baseline: a transport error whose URL contains \"401\" is classified as auth_401"]
fn network_failure_is_not_reported_as_auth_rejected() {
    if !offline_baseline_enabled() {
        return;
    }
    let kind = classify_delivery_failure(CONNECT_REFUSED_ON_PORT_54017);
    assert_ne!(kind, DeliveryFailureKind::Auth401);
    assert_eq!(kind, DeliveryFailureKind::Network);
}

#[test]
#[ignore = "OFF-01 baseline: reqwest's \"error sending request\" transport message is classified as other"]
fn transport_error_without_a_response_is_classified_as_network() {
    if !offline_baseline_enabled() {
        return;
    }
    assert_eq!(
        classify_delivery_failure(CONNECT_REFUSED_PLAIN),
        DeliveryFailureKind::Network
    );
}

#[test]
fn http_402_body_is_classified_as_subscription_required() {
    // Guard: the real entitlement refusal must keep its own kind.
    assert_eq!(
        classify_delivery_failure(
            "HTTP status 402: {\"error\":\"trial expired or subscription inactive\"}"
        ),
        DeliveryFailureKind::Payment402
    );
}

#[test]
fn http_401_rejection_is_classified_as_auth_rejected() {
    // Guard: `reject_unauthorized` wording.
    assert_eq!(
        classify_delivery_failure(
            "Authentication failed: API key was rejected by the server. If you regenerated your API key on the dashboard, the old one stopped working"
        ),
        DeliveryFailureKind::Auth401
    );
}

// ---------------------------------------------------------------------------
// Retry classification (guards: the offline fix must not change these)
// ---------------------------------------------------------------------------

#[test]
fn http_429_and_503_are_retryable_and_401_422_are_not() {
    assert!(is_retryable_delivery_error(&http_status(429, Some(120))));
    assert!(is_retryable_delivery_error(&http_status(503, None)));
    assert!(is_retryable_delivery_error(&http_status(408, None)));
    // A 401 is paused as a credential failure by the flush path, never retried as
    // if it were a network blip.
    assert!(!is_retryable_delivery_error(&http_status(401, None)));
    assert!(!is_retryable_delivery_error(&AppError::Auth(
        "API key was rejected by the server".into()
    )));
    assert!(!is_retryable_delivery_error(&http_status(422, None)));
}

#[test]
fn retry_after_is_taken_from_the_response_not_the_clock() {
    assert_eq!(retry_after_seconds(&http_status(429, Some(120))), Some(120));
    assert_eq!(retry_after_seconds(&http_status(503, None)), None);
}

// ---------------------------------------------------------------------------
// Queue ownership (guards for Phase 02; exercised on a disposable queue)
// ---------------------------------------------------------------------------

#[test]
fn different_account_key_cannot_claim_existing_rows() {
    let dir = TempDir::new("different-account");
    let queue = Queue::open_at(&dir.queue_path()).unwrap();
    let origin = "http://127.0.0.1:8080";
    let owner_a = scope_for(origin, "fixture-key-account-a");
    let owner_b = scope_for(origin, "fixture-key-account-b");
    assert_ne!(owner_a, owner_b);

    queue
        .push_scoped(&payload("hb-a-1", 1_000.0), &owner_a)
        .unwrap();
    queue
        .push_scoped(&payload("hb-a-2", 1_060.0), &owner_a)
        .unwrap();

    let claimed = queue.claim_batch_scoped(&owner_b, "lease-b").unwrap();
    assert!(
        claimed.is_empty(),
        "another key's scope must not lease rows"
    );
    assert_eq!(queue.len_scoped(&owner_b).unwrap(), 0);

    let rows = queue_rows(&dir.queue_path());
    assert_eq!(
        rows.len(),
        2,
        "rows must never be deleted by a foreign scope"
    );
    assert!(rows
        .iter()
        .all(|row| row.owner_scope == owner_a.owner && !row.leased));
}

#[test]
fn different_origin_cannot_claim_existing_rows() {
    let dir = TempDir::new("different-origin");
    let queue = Queue::open_at(&dir.queue_path()).unwrap();
    let old_origin = scope_for("http://127.0.0.1:8080", "fixture-key-account-a");
    let new_origin = scope_for("http://127.0.0.1:9090", "fixture-key-account-a");
    assert_eq!(old_origin.owner, new_origin.owner);
    assert_ne!(old_origin.destination, new_origin.destination);

    queue
        .push_scoped(&payload("hb-origin-1", 1_000.0), &old_origin)
        .unwrap();

    assert!(queue
        .claim_batch_scoped(&new_origin, "lease-new")
        .unwrap()
        .is_empty());
    let rows = queue_rows(&dir.queue_path());
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].destination, "http://127.0.0.1:8080");
    assert!(!rows[0].leased);
}

#[test]
fn queue_scope_normalizes_a_trailing_slash_in_the_origin() {
    assert_eq!(
        scope_for("http://127.0.0.1:8080/", "fixture-key"),
        scope_for("http://127.0.0.1:8080", "fixture-key")
    );
}

#[test]
fn scoped_depth_and_seconds_exclude_other_scopes() {
    let dir = TempDir::new("scoped-depth");
    let queue = Queue::open_at(&dir.queue_path()).unwrap();
    let origin = "http://127.0.0.1:8080";
    let mine = scope_for(origin, "fixture-key-mine");
    let other = scope_for(origin, "fixture-key-other");
    let now = chrono::Utc::now().timestamp() as f64;

    queue
        .push_scoped(&payload("hb-mine-1", now - 120.0), &mine)
        .unwrap();
    queue
        .push_scoped(&payload("hb-mine-2", now - 60.0), &mine)
        .unwrap();
    queue
        .push_scoped(&payload("hb-other-1", now - 30.0), &other)
        .unwrap();

    assert_eq!(queue.len().unwrap(), 3);
    assert_eq!(queue.len_scoped(&mine).unwrap(), 2);
    let mine_segments = queue
        .queued_segments_for_day_scoped(Some("UTC"), &mine)
        .unwrap();
    let other_segments = queue
        .queued_segments_for_day_scoped(Some("UTC"), &other)
        .unwrap();
    // Near 00:00 UTC the fixture rows can fall on the previous day; the scoping
    // assertion is what matters, not the calendar boundary.
    assert!(mine_segments.len() <= 2);
    assert!(other_segments.len() <= 1);
}

#[test]
fn a_leased_row_is_not_claimed_twice_and_retry_keeps_identity() {
    let dir = TempDir::new("lease");
    let queue = Queue::open_at(&dir.queue_path()).unwrap();
    let scope = scope_for("http://127.0.0.1:8080", "fixture-key");
    queue
        .push_scoped(&payload("hb-lease-1", 1_000.0), &scope)
        .unwrap();

    let first = queue.claim_batch_scoped(&scope, "lease-1").unwrap();
    assert_eq!(first.len(), 1);
    assert!(queue
        .claim_batch_scoped(&scope, "lease-2")
        .unwrap()
        .is_empty());

    queue.mark_retry_after(first[0].0, Some(120)).unwrap();
    let rows = queue_rows(&dir.queue_path());
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].heartbeat_id.as_deref(), Some("hb-lease-1"));
    assert_eq!(rows[0].retry_count, 1);
    assert!(!rows[0].leased);
    // Retry-After is honoured: the row is not eligible again immediately.
    assert!(queue
        .claim_batch_scoped(&scope, "lease-3")
        .unwrap()
        .is_empty());
}
