use crate::{models::RuntimeSnapshot, settings::DesktopSettings};
use parking_lot::{Mutex, RwLock};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
};
use wakaclock_core::heartbeat::ActivitySegment;

/// The last snapshot the server confirmed, kept so an outage shows the real
/// last-known total instead of zero.
///
/// In memory only: after a restart there is no confirmed total until the server
/// answers again, and the UI says "unknown" rather than inventing a number.
/// `scope_key` is the origin + credential it belongs to, so a different account
/// or server never reads it.
#[derive(Debug, Clone)]
pub struct ConfirmedSnapshot {
    pub scope_key: String,
    pub confirmed_seconds: f64,
    pub intervals: Vec<ActivitySegment>,
    pub heartbeat_count: u64,
    pub fetched_at: f64,
}

#[derive(Clone)]
pub struct DesktopState {
    settings: Arc<RwLock<DesktopSettings>>,
    runtime: Arc<RwLock<RuntimeSnapshot>>,
    category_seconds: Arc<Mutex<BTreeMap<String, f64>>>,
    force_send: Arc<AtomicBool>,
    shutdown: Arc<AtomicBool>,
    shutdown_complete: Arc<AtomicBool>,
    coalesced_intents: Arc<AtomicU64>,
    confirmed: Arc<RwLock<Option<ConfirmedSnapshot>>>,
}

impl DesktopState {
    pub fn new() -> Self {
        let (settings, runtime) = match DesktopSettings::load() {
            Ok(settings) => (settings, RuntimeSnapshot::default()),
            Err(error) => {
                let settings = DesktopSettings::fail_closed();
                let runtime = RuntimeSnapshot {
                    last_error: Some(format!(
                        "Desktop settings could not be loaded; tracking is disabled: {error}"
                    )),
                    ..RuntimeSnapshot::default()
                };
                (settings, runtime)
            }
        };
        Self {
            settings: Arc::new(RwLock::new(settings)),
            runtime: Arc::new(RwLock::new(runtime)),
            category_seconds: Arc::new(Mutex::new(BTreeMap::new())),
            force_send: Arc::new(AtomicBool::new(false)),
            shutdown: Arc::new(AtomicBool::new(false)),
            shutdown_complete: Arc::new(AtomicBool::new(false)),
            coalesced_intents: Arc::new(AtomicU64::new(0)),
            confirmed: Arc::new(RwLock::new(None)),
        }
    }

    pub fn settings(&self) -> DesktopSettings {
        self.settings.read().clone()
    }

    pub fn replace_settings(&self, settings: DesktopSettings) {
        *self.settings.write() = settings;
    }

    pub fn runtime(&self) -> RuntimeSnapshot {
        self.runtime.read().clone()
    }

    pub fn update_runtime(&self, mutate: impl FnOnce(&mut RuntimeSnapshot)) {
        let mut runtime = self.runtime.write();
        mutate(&mut runtime);
    }

    pub fn record_category(&self, category: &str, seconds: f64) {
        if !seconds.is_finite() || seconds <= 0.0 {
            return;
        }
        let mut totals = self.category_seconds.lock();
        *totals.entry(category.to_string()).or_default() += seconds;
    }

    pub fn category_seconds(&self) -> BTreeMap<String, f64> {
        self.category_seconds.lock().clone()
    }

    pub fn session_seconds(&self) -> f64 {
        self.category_seconds.lock().values().copied().sum()
    }

    pub fn request_send(&self) {
        self.force_send.store(true, Ordering::Release);
    }

    pub fn take_send_request(&self) -> bool {
        self.force_send.swap(false, Ordering::AcqRel)
    }

    /// Ask the sampler to stop at its next tick so the process can flush and exit.
    pub fn request_shutdown(&self) {
        self.shutdown.store(true, Ordering::Release);
    }

    pub fn take_shutdown_request(&self) -> bool {
        self.shutdown.swap(false, Ordering::AcqRel)
    }

    /// Set once the delivery worker has persisted everything it had in flight.
    pub fn mark_shutdown_complete(&self) {
        self.shutdown_complete.store(true, Ordering::Release);
    }

    pub fn is_shutdown_complete(&self) -> bool {
        self.shutdown_complete.load(Ordering::Acquire)
    }

    /// A handoff to delivery was refused because the worker is behind. Counted
    /// for diagnostics; the sample itself is still accounted for.
    pub fn record_coalesced_intent(&self) {
        self.coalesced_intents.fetch_add(1, Ordering::Relaxed);
    }

    pub fn coalesced_intents(&self) -> u64 {
        self.coalesced_intents.load(Ordering::Relaxed)
    }

    pub fn confirmed_snapshot(&self) -> Option<ConfirmedSnapshot> {
        self.confirmed.read().clone()
    }

    pub fn store_confirmed_snapshot(&self, snapshot: ConfirmedSnapshot) {
        *self.confirmed.write() = Some(snapshot);
    }

    /// Forget a cached total that belongs to a different account or server.
    /// Only the cache is dropped — queued activity is never touched.
    pub fn invalidate_confirmed_snapshot_unless(&self, scope_key: &str) {
        let mut cached = self.confirmed.write();
        if cached
            .as_ref()
            .is_some_and(|snapshot| snapshot.scope_key != scope_key)
        {
            *cached = None;
        }
    }
}

impl Default for DesktopState {
    fn default() -> Self {
        Self::new()
    }
}
