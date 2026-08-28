use crate::{models::RuntimeSnapshot, settings::DesktopSettings};
use parking_lot::{Mutex, RwLock};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

#[derive(Clone)]
pub struct DesktopState {
    settings: Arc<RwLock<DesktopSettings>>,
    runtime: Arc<RwLock<RuntimeSnapshot>>,
    category_seconds: Arc<Mutex<BTreeMap<String, f64>>>,
    force_send: Arc<AtomicBool>,
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
}

impl Default for DesktopState {
    fn default() -> Self {
        Self::new()
    }
}
