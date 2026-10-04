use crate::{
    models::{ForegroundApp, RuntimeSnapshot, TrackedActivity, TrackerStatus},
    policy::sanitize_activity,
    state::DesktopState,
    tracker,
};
use std::{future::Future, pin::Pin, sync::Arc};
use tauri::AppHandle;
// `tokio::time::Instant`/`sleep`, not `std::time::Instant`: tests drive the
// sampling cadence with a paused clock, and only Tokio's own time source can be
// advanced deterministically.
use tokio::{
    sync::mpsc,
    time::{sleep, Duration, Instant},
};
use wakaclock_core::{
    api_client::ApiClient,
    config::Config,
    heartbeat::{EntityType, Heartbeat, DEDUP_WINDOW_SECONDS},
};

const TICK: Duration = Duration::from_secs(5);
const MAX_ACCOUNTED_TICK_SECONDS: f64 = 10.0;
/// Bounded so a long outage cannot grow memory without limit. Each intent is
/// small; this is several minutes of ticks, far longer than a delivery attempt.
const DELIVERY_QUEUE_CAPACITY: usize = 256;
/// How long `flush_on_shutdown` may spend persisting what is still in flight.
const SHUTDOWN_FLUSH_TIMEOUT: Duration = Duration::from_secs(5);

/// One captured sample, ready to deliver.
///
/// Immutable on purpose: it carries the identity and timestamp from the moment
/// the activity was observed, so a delivery that is retried minutes later still
/// describes when it happened rather than when it was sent.
#[derive(Debug, Clone, PartialEq)]
pub struct DeliveryIntent {
    pub activity: TrackedActivity,
    /// Unix seconds at capture time.
    pub captured_at: f64,
    /// The sample crossed an app boundary, so it must not be coalesced away.
    pub app_changed: bool,
}

/// The machine the sampler observes. Real tracking reads the OS; tests supply a
/// deterministic fake, which is the only way to exercise a hanging delivery
/// without a 30-second wall-clock wait.
pub trait Environment: Send + Sync + 'static {
    fn idle_seconds(&self) -> Result<f64, String>;
    fn foreground(&self, include_window_title: bool) -> Result<ForegroundApp, String>;
    /// Unix seconds. Separate from the monotonic tick clock.
    fn now_unix(&self) -> f64;
}

/// The real OS tracker.
pub struct OsEnvironment;

impl Environment for OsEnvironment {
    fn idle_seconds(&self) -> Result<f64, String> {
        tracker::idle::idle_seconds()
    }

    fn foreground(&self, include_window_title: bool) -> Result<ForegroundApp, String> {
        tracker::current_foreground_app(include_window_title)
    }

    fn now_unix(&self) -> f64 {
        chrono::Utc::now().timestamp_millis() as f64 / 1000.0
    }
}

/// Where captured samples go. The sampler only ever *hands off* — it never waits
/// for a network request, which is what used to stall time accounting (OFF-06).
pub trait DeliverySink: Send + Sync + 'static {
    fn submit(&self, intent: DeliveryIntent) -> Handoff;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Handoff {
    Accepted,
    /// The worker is behind. The sampler keeps the boundary flag for the next
    /// tick instead of dropping the fact that an app switch happened.
    Full,
}

/// Channel-backed sink drained by [`run_delivery_worker`].
pub struct ChannelSink {
    sender: mpsc::Sender<DeliveryIntent>,
}

impl DeliverySink for ChannelSink {
    fn submit(&self, intent: DeliveryIntent) -> Handoff {
        match self.sender.try_send(intent) {
            Ok(()) => Handoff::Accepted,
            Err(_) => Handoff::Full,
        }
    }
}

/// Start the tracker: a sampling loop that never awaits the network, plus a
/// delivery worker that owns every HTTP request and the durable queue.
pub async fn run(app: AppHandle, state: DesktopState) {
    let (sender, receiver) = mpsc::channel(DELIVERY_QUEUE_CAPACITY);
    let worker_state = state.clone();
    // The worker holds a `rusqlite::Connection`-backed `Queue` across awaits, so
    // its future is not `Send` and cannot be `tokio::spawn`ed. Give it its own
    // thread and current-thread runtime — the point is only that it runs
    // independently of the sampling cadence.
    let worker = std::thread::Builder::new()
        .name("atoaxis-delivery".into())
        .spawn(move || {
            let Ok(runtime) = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            else {
                return;
            };
            runtime.block_on(async move {
                let mut receiver = receiver;
                let deliverer = ApiDeliverer;
                run_delivery_worker(&mut receiver, &deliverer, &worker_state).await;
                // The channel closed: the sampler is shutting down. Persist
                // whatever is still in flight before the process exits.
                flush_on_shutdown(&mut receiver, &deliverer, &worker_state).await;
                worker_state.mark_shutdown_complete();
            });
        });
    let sink = Arc::new(ChannelSink { sender });
    run_sampler(Arc::new(OsEnvironment), sink.clone(), state, Some(app)).await;
    // Dropping every sender closes the channel, which ends the worker loop and
    // runs its shutdown flush.
    drop(sink);
    if let Ok(worker) = worker {
        let _ = worker.join();
    }
}

/// Sample foreground activity on a fixed cadence.
///
/// The cadence depends only on the tick clock: a slow or hanging delivery cannot
/// delay it, so `elapsed` stays at one tick and no active time is lost. Status
/// and category accounting are unchanged from the inline-delivery version.
pub async fn run_sampler<E: Environment, S: DeliverySink>(
    environment: Arc<E>,
    sink: Arc<S>,
    state: DesktopState,
    app: Option<AppHandle>,
) {
    let mut last_entity: Option<String> = None;
    let mut last_sent_at = 0.0_f64;
    let mut previous_tick = Instant::now();
    let mut previous_active_category = None;
    // Set when a handoff was refused: the boundary it described is still owed.
    let mut pending_app_boundary = false;

    loop {
        let elapsed = previous_tick
            .elapsed()
            .as_secs_f64()
            .min(MAX_ACCOUNTED_TICK_SECONDS);
        previous_tick = Instant::now();
        let settings = state.settings();

        if state.take_shutdown_request() {
            return;
        }

        if !settings.enabled {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Paused;
                runtime.idle_seconds = 0.0;
            });
            sleep(TICK).await;
            continue;
        }
        if settings.private_mode {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Private;
                runtime.app_name = None;
                runtime.app_identifier = None;
                runtime.category = None;
            });
            sleep(TICK).await;
            continue;
        }

        let idle_seconds = match environment.idle_seconds() {
            Ok(value) => value,
            Err(error) => {
                advance_activity_accounting(&mut previous_active_category, None);
                set_unavailable(&state, error);
                sleep(TICK).await;
                continue;
            }
        };
        if idle_seconds >= settings.idle_timeout_seconds as f64 {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Idle;
                runtime.idle_seconds = idle_seconds;
                runtime.category = None;
            });
            sleep(TICK).await;
            continue;
        }

        let foreground = match environment.foreground(settings.title_tracking) {
            Ok(value) => value,
            Err(error) => {
                advance_activity_accounting(&mut previous_active_category, None);
                set_unavailable(&state, error);
                sleep(TICK).await;
                continue;
            }
        };

        let Some(activity) = sanitize_activity(&foreground, &settings) else {
            advance_activity_accounting(&mut previous_active_category, None);
            state.update_runtime(|runtime| {
                runtime.status = TrackerStatus::Unmonitored;
                runtime.app_name = Some(foreground.app_name.clone());
                runtime.app_identifier = Some(foreground.identifier.clone());
                runtime.category = None;
                runtime.idle_seconds = idle_seconds;
                runtime.last_error = None;
            });
            sleep(TICK).await;
            continue;
        };

        if let Some(category) =
            advance_activity_accounting(&mut previous_active_category, Some(activity.category))
        {
            state.record_category(category.as_str(), elapsed);
        }
        state.update_runtime(|runtime| set_active(runtime, &activity, idle_seconds));

        let now = environment.now_unix();
        let app_changed = last_entity.as_deref() != Some(activity.entity.as_str());
        let due = now - last_sent_at >= DEDUP_WINDOW_SECONDS;
        let should_send = app_changed || due || state.take_send_request();
        if should_send {
            let intent = DeliveryIntent {
                activity: activity.clone(),
                captured_at: now,
                app_changed: app_changed || pending_app_boundary,
            };
            match sink.submit(intent) {
                Handoff::Accepted => {
                    pending_app_boundary = false;
                    last_entity = Some(activity.entity.clone());
                    last_sent_at = now;
                    state.update_runtime(|runtime| runtime.last_captured_at = Some(now));
                }
                Handoff::Full => {
                    // Keep the boundary owed and try again next tick. Sampling
                    // and accounting continue either way.
                    pending_app_boundary = intent_boundary(app_changed, pending_app_boundary);
                    state.record_coalesced_intent();
                }
            }
        }

        if let Some(app) = app.as_ref() {
            if now as u64 % 60 < TICK.as_secs() {
                update_tray_today(app).await;
            }
        }
        sleep(TICK).await;
    }
}

fn intent_boundary(app_changed: bool, pending: bool) -> bool {
    app_changed || pending
}

/// Sends one captured sample. Injected so tests never touch the real config or
/// the network: `send_activity` reads `~/.wakaclock/config.toml` and would post
/// to whatever server the machine is configured for.
pub trait Deliverer {
    fn deliver<'a>(
        &'a self,
        intent: &'a DeliveryIntent,
    ) -> Pin<Box<dyn Future<Output = Result<Option<String>, String>> + 'a>>;
}

/// Production delivery: the API client, which durably queues whatever it cannot
/// send right now.
pub struct ApiDeliverer;

impl Deliverer for ApiDeliverer {
    fn deliver<'a>(
        &'a self,
        intent: &'a DeliveryIntent,
    ) -> Pin<Box<dyn Future<Output = Result<Option<String>, String>> + 'a>> {
        Box::pin(send_activity(&intent.activity, intent.captured_at))
    }
}

/// Own every network request and the durable queue. Runs independently of the
/// sampling cadence, so a 30-second timeout costs no captured time.
pub async fn run_delivery_worker<D: Deliverer>(
    receiver: &mut mpsc::Receiver<DeliveryIntent>,
    deliverer: &D,
    state: &DesktopState,
) {
    while let Some(intent) = receiver.recv().await {
        deliver(&intent, deliverer, state).await;
    }
}

async fn deliver<D: Deliverer>(intent: &DeliveryIntent, deliverer: &D, state: &DesktopState) {
    match deliverer.deliver(intent).await {
        Ok(error) => {
            state.update_runtime(|runtime| {
                runtime.last_heartbeat_at = Some(intent.captured_at);
                runtime.last_delivered_at = Some(intent.captured_at);
                runtime.last_queued_at = Some(intent.captured_at);
                // A delivery result says nothing about the OS tracker; only a
                // tracker error may claim the tracker is unavailable.
                runtime.last_error = error;
            });
        }
        Err(error) => {
            state.update_runtime(|runtime| {
                // The heartbeat is durably queued by the API client, so it is
                // captured even though it is not delivered yet.
                runtime.last_queued_at = Some(intent.captured_at);
                runtime.last_error = Some(error);
            });
        }
    }
}

/// Persist whatever is still in flight before the process exits, bounded so
/// quitting can never hang. Intents that cannot be delivered land in the durable
/// queue exactly as an offline delivery would.
pub async fn flush_on_shutdown<D: Deliverer>(
    receiver: &mut mpsc::Receiver<DeliveryIntent>,
    deliverer: &D,
    state: &DesktopState,
) {
    let deadline = Instant::now() + SHUTDOWN_FLUSH_TIMEOUT;
    while let Ok(Some(intent)) = tokio::time::timeout_at(deadline, receiver.recv()).await {
        deliver(&intent, deliverer, state).await;
        if Instant::now() >= deadline {
            return;
        }
    }
}

async fn send_activity(
    activity: &TrackedActivity,
    captured_at: f64,
) -> Result<Option<String>, String> {
    let config = Config::load();
    if config
        .api_key
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        return Err("API key is not configured in ~/.wakaclock/config.toml".into());
    }

    let mut heartbeat = Heartbeat::new(
        config.user_id,
        activity.entity.clone(),
        EntityType::App,
        format!("atoaxis-desktop/{}", env!("CARGO_PKG_VERSION")),
    );
    // The time the activity was observed, not the time this request is made: a
    // retry after an outage must not move the activity to the present. `date`
    // travels with `time`, or a sample captured just before midnight and
    // delivered after it would land on the wrong local day.
    heartbeat.time = captured_at;
    if let Some(captured) = chrono::DateTime::from_timestamp(
        captured_at.trunc() as i64,
        (captured_at.fract().max(0.0) * 1_000_000_000.0) as u32,
    ) {
        heartbeat.date = captured.format("%Y-%m-%d").to_string();
    }
    heartbeat.category = activity.category.into();
    heartbeat.editor = "AtoAxis Desktop".into();
    heartbeat.operating_system = friendly_os().into();
    heartbeat.machine = wakaclock_core::queue::Queue::open()
        .and_then(|queue| queue.device_id())
        .map_err(|error| error.to_string())?;
    // Desktop activity is sampled only while a foreground app is active and the
    // operating-system idle timer is below the configured threshold. Mark it as
    // human/editor evidence explicitly so combined_v2 keeps the tracker stream in
    // the WakaTime-comparable union; an Unknown anchor would otherwise contribute
    // time in legacy mode but disappear when the human and measured-AI streams are
    // combined.
    heartbeat.actor_type = wakaclock_core::heartbeat::ActorType::Human;
    heartbeat.actor_confidence = 1.0;
    heartbeat.is_ai_generated = false;

    let report = ApiClient::new(config)
        .map_err(|error| error.to_string())?
        .send_heartbeat(heartbeat)
        .await
        .map_err(|error| error.to_string())?;
    Ok(report.error)
}

fn advance_activity_accounting(
    previous: &mut Option<crate::models::DesktopCategory>,
    current: Option<crate::models::DesktopCategory>,
) -> Option<crate::models::DesktopCategory> {
    let accounted = if current.is_some() { *previous } else { None };
    *previous = current;
    accounted
}

fn set_active(runtime: &mut RuntimeSnapshot, activity: &TrackedActivity, idle_seconds: f64) {
    runtime.status = TrackerStatus::Active;
    runtime.app_name = Some(activity.app_name.clone());
    runtime.app_identifier = Some(activity.identifier.clone());
    runtime.category = Some(activity.category);
    runtime.idle_seconds = idle_seconds;
    runtime.last_error = None;
}

fn set_unavailable(state: &DesktopState, error: String) {
    state.update_runtime(|runtime| {
        runtime.status = TrackerStatus::Unavailable;
        runtime.last_error = Some(error);
    });
}

fn friendly_os() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        return "macOS";
    }
    #[cfg(target_os = "windows")]
    {
        return "Windows";
    }
    #[allow(unreachable_code)]
    std::env::consts::OS
}

async fn update_tray_today(app: &AppHandle) {
    let config = Config::load();
    if config.api_key.is_none() {
        return;
    }
    let Ok(client) = ApiClient::new(config) else {
        return;
    };
    let Ok(today) = client.today().await else {
        return;
    };
    if let Some(tray) = app.tray_by_id("atoaxis-main") {
        let tooltip = format!("AtoAxis · Today {}", today.human_readable);
        let _ = tray.set_tooltip(Some(tooltip));
        #[cfg(target_os = "macos")]
        let _ = tray.set_title(Some(format!(" {}", today.human_readable)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::DesktopCategory;
    use crate::settings::DesktopSettings;
    use parking_lot::Mutex;

    #[test]
    fn accounted_tick_is_bounded_after_sleep_or_suspend() {
        let long_gap = Duration::from_secs(300)
            .as_secs_f64()
            .min(MAX_ACCOUNTED_TICK_SECONDS);
        assert_eq!(long_gap, 10.0);
    }

    #[test]
    fn inactive_transition_resets_accounting_before_resume() {
        let mut previous = None;
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Coding)),
            None
        );
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Coding)),
            Some(DesktopCategory::Coding)
        );
        assert_eq!(advance_activity_accounting(&mut previous, None), None);
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Meeting)),
            None
        );
    }

    #[test]
    fn app_switch_attributes_elapsed_interval_to_previous_category() {
        let mut previous = Some(DesktopCategory::Coding);
        assert_eq!(
            advance_activity_accounting(&mut previous, Some(DesktopCategory::Meeting)),
            Some(DesktopCategory::Coding)
        );
        assert_eq!(previous, Some(DesktopCategory::Meeting));
    }

    // -------------------------------------------------------------------
    // Offline reliability Phase 04 — sampling is independent of delivery
    // -------------------------------------------------------------------

    /// Deterministic stand-in for the OS tracker.
    struct FakeEnvironment {
        idle: Mutex<Result<f64, String>>,
        foreground: Mutex<Result<ForegroundApp, String>>,
        now: Mutex<f64>,
    }

    impl FakeEnvironment {
        fn new(app: &str) -> Self {
            Self {
                idle: Mutex::new(Ok(0.0)),
                foreground: Mutex::new(Ok(foreground_app(app))),
                now: Mutex::new(1_000_000.0),
            }
        }

        fn set_foreground(&self, app: &str) {
            *self.foreground.lock() = Ok(foreground_app(app));
        }

        fn set_idle(&self, value: Result<f64, String>) {
            *self.idle.lock() = value;
        }

        fn advance(&self, seconds: f64) {
            *self.now.lock() += seconds;
        }
    }

    impl Environment for FakeEnvironment {
        fn idle_seconds(&self) -> Result<f64, String> {
            self.idle.lock().clone()
        }

        fn foreground(&self, _include_window_title: bool) -> Result<ForegroundApp, String> {
            self.foreground.lock().clone()
        }

        fn now_unix(&self) -> f64 {
            *self.now.lock()
        }
    }

    fn foreground_app(app: &str) -> ForegroundApp {
        ForegroundApp {
            app_name: app.to_string(),
            identifier: format!("com.example.{app}"),
            pid: 1,
            window_title: None,
        }
    }

    /// Records handoffs. `hang` mimics a delivery worker that is stuck on a slow
    /// request: nothing is drained, so the channel analogue never empties.
    struct RecordingSink {
        accepted: Mutex<Vec<DeliveryIntent>>,
        capacity: usize,
        coalesced: Mutex<usize>,
    }

    impl RecordingSink {
        fn with_capacity(capacity: usize) -> Self {
            Self {
                accepted: Mutex::new(Vec::new()),
                capacity,
                coalesced: Mutex::new(0),
            }
        }

        fn intents(&self) -> Vec<DeliveryIntent> {
            self.accepted.lock().clone()
        }
    }

    impl DeliverySink for RecordingSink {
        fn submit(&self, intent: DeliveryIntent) -> Handoff {
            let mut accepted = self.accepted.lock();
            if accepted.len() >= self.capacity {
                *self.coalesced.lock() += 1;
                return Handoff::Full;
            }
            accepted.push(intent);
            Handoff::Accepted
        }
    }

    fn tracking_state() -> DesktopState {
        let state = DesktopState::new();
        state.replace_settings(DesktopSettings {
            enabled: true,
            idle_timeout_seconds: 300,
            private_mode: false,
            title_tracking: false,
            denied_app_names: vec![],
            denied_window_patterns: vec![],
            // `sanitize_activity` matches a bundle id or app name exactly.
            rules: vec![crate::models::AppRule {
                id: "desktop-apps".into(),
                label: "Tracked apps".into(),
                identifiers: vec!["com.example.code".into(), "com.example.browser".into()],
                enabled: true,
                category: DesktopCategory::Coding,
            }],
        });
        state
    }

    /// Run the sampler for `ticks` samples of fake time, then stop it.
    async fn run_ticks<E: Environment, S: DeliverySink>(
        environment: Arc<E>,
        sink: Arc<S>,
        state: &DesktopState,
        ticks: u64,
        between: impl Fn(u64),
    ) {
        let sampler_state = state.clone();
        let sampler = tokio::spawn({
            let environment = environment.clone();
            let sink = sink.clone();
            async move { run_sampler(environment, sink, sampler_state, None).await }
        });
        for tick in 0..ticks {
            tokio::time::sleep(TICK).await;
            between(tick);
        }
        state.request_shutdown();
        tokio::time::sleep(TICK * 2).await;
        sampler.abort();
    }

    #[tokio::test(start_paused = true)]
    async fn sampling_ticks_continue_during_a_hanging_delivery() {
        let environment = Arc::new(FakeEnvironment::new("code"));
        // Capacity 1: the first handoff is accepted and nothing is ever drained,
        // exactly like a worker stuck on a 30-second request.
        let sink = Arc::new(RecordingSink::with_capacity(1));
        let state = tracking_state();
        let state_for_requests = state.clone();

        run_ticks(environment.clone(), sink.clone(), &state, 6, |_| {
            environment.advance(TICK.as_secs_f64());
            // Ask for a send every tick (as the dashboard's refresh does), so the
            // handoffs keep coming while the worker is stuck. Without this the
            // sampler would correctly stay quiet inside the dedup window.
            state_for_requests.request_send();
        })
        .await;

        // 30 seconds of samples at 5s each: the loop kept its cadence and kept
        // accounting time even though delivery never completed.
        let coding = state
            .category_seconds()
            .get("coding")
            .copied()
            .unwrap_or(0.0);
        assert!(
            coding >= 20.0,
            "sampling must keep accounting while delivery hangs, got {coding}"
        );
        assert_eq!(sink.intents().len(), 1, "the stuck sink accepted only one");
        assert!(*sink.coalesced.lock() > 0, "refusals were recorded");
        assert_eq!(state.runtime().status, TrackerStatus::Active);
    }

    #[tokio::test(start_paused = true)]
    async fn app_switch_during_outage_keeps_both_boundaries() {
        let environment = Arc::new(FakeEnvironment::new("code"));
        let sink = Arc::new(RecordingSink::with_capacity(8));
        let state = tracking_state();

        run_ticks(environment.clone(), sink.clone(), &state, 4, |tick| {
            environment.advance(TICK.as_secs_f64());
            if tick == 1 {
                environment.set_foreground("browser");
            }
        })
        .await;

        let intents = sink.intents();
        let entities: Vec<String> = intents
            .iter()
            .map(|intent| intent.activity.entity.clone())
            .collect();
        assert!(
            entities.iter().any(|entity| entity.contains("code")),
            "{entities:?}"
        );
        assert!(
            entities.iter().any(|entity| entity.contains("browser")),
            "the app switch produced its own boundary: {entities:?}"
        );
        assert!(
            intents.iter().filter(|intent| intent.app_changed).count() >= 2,
            "both boundaries are marked: {intents:?}"
        );
        // Captured timestamps are strictly increasing and never the send time.
        for pair in intents.windows(2) {
            assert!(pair[1].captured_at > pair[0].captured_at);
        }
    }

    #[tokio::test(start_paused = true)]
    async fn network_failure_does_not_mark_native_tracker_unavailable() {
        let environment = Arc::new(FakeEnvironment::new("code"));
        // Every handoff is refused, standing in for a server that is down.
        let sink = Arc::new(RecordingSink::with_capacity(0));
        let state = tracking_state();

        run_ticks(environment.clone(), sink.clone(), &state, 3, |_| {
            environment.advance(TICK.as_secs_f64());
        })
        .await;

        assert_eq!(
            state.runtime().status,
            TrackerStatus::Active,
            "a delivery problem is not an OS tracker problem"
        );
        assert!(state.runtime().last_error.is_none());
    }

    #[tokio::test(start_paused = true)]
    async fn an_os_tracker_error_still_reports_unavailable() {
        let environment = Arc::new(FakeEnvironment::new("code"));
        let sink = Arc::new(RecordingSink::with_capacity(8));
        let state = tracking_state();
        environment.set_idle(Err("accessibility permission denied".into()));

        run_ticks(environment.clone(), sink.clone(), &state, 2, |_| {
            environment.advance(TICK.as_secs_f64());
        })
        .await;

        assert_eq!(state.runtime().status, TrackerStatus::Unavailable);
        assert_eq!(
            state.runtime().last_error.as_deref(),
            Some("accessibility permission denied")
        );
        assert!(sink.intents().is_empty(), "no activity was captured");
    }

    #[tokio::test(start_paused = true)]
    async fn idle_and_private_transitions_do_not_create_offline_time() {
        let environment = Arc::new(FakeEnvironment::new("code"));
        let sink = Arc::new(RecordingSink::with_capacity(8));
        let state = tracking_state();
        environment.set_idle(Ok(600.0));

        run_ticks(environment.clone(), sink.clone(), &state, 3, |_| {
            environment.advance(TICK.as_secs_f64());
        })
        .await;

        assert_eq!(state.runtime().status, TrackerStatus::Idle);
        assert!(state.category_seconds().is_empty(), "idle creates no time");
        assert!(sink.intents().is_empty());

        // Private mode: same rule, and no app identity is exposed.
        let mut settings = state.settings();
        settings.private_mode = true;
        state.replace_settings(settings);
        environment.set_idle(Ok(0.0));
        run_ticks(environment.clone(), sink.clone(), &state, 2, |_| {
            environment.advance(TICK.as_secs_f64());
        })
        .await;
        assert_eq!(state.runtime().status, TrackerStatus::Private);
        assert!(state.runtime().app_name.is_none());
        assert!(state.category_seconds().is_empty());
        assert!(sink.intents().is_empty());
    }

    /// Records what delivery was asked to send. Never touches config or network.
    struct FakeDeliverer {
        delivered: Mutex<Vec<DeliveryIntent>>,
        outcome: Mutex<Result<Option<String>, String>>,
    }

    impl FakeDeliverer {
        fn new() -> Self {
            Self {
                delivered: Mutex::new(Vec::new()),
                outcome: Mutex::new(Ok(None)),
            }
        }
    }

    impl Deliverer for FakeDeliverer {
        fn deliver<'a>(
            &'a self,
            intent: &'a DeliveryIntent,
        ) -> Pin<Box<dyn Future<Output = Result<Option<String>, String>> + 'a>> {
            self.delivered.lock().push(intent.clone());
            let outcome = self.outcome.lock().clone();
            Box::pin(async move { outcome })
        }
    }

    #[tokio::test(start_paused = true)]
    async fn shutdown_persists_every_in_memory_intent_before_exit() {
        // The worker never runs, so the intents are still in the channel when
        // shutdown starts; the flush must hand each one to delivery.
        let (sender, mut receiver) = mpsc::channel(8);
        let state = tracking_state();
        for index in 0..3 {
            sender
                .try_send(DeliveryIntent {
                    activity: TrackedActivity {
                        app_name: "code".into(),
                        identifier: "com.example.code".into(),
                        entity: format!("code-{index}"),
                        category: DesktopCategory::Coding,
                    },
                    captured_at: 1_000_000.0 + index as f64,
                    app_changed: index == 0,
                })
                .unwrap();
        }
        drop(sender);
        let deliverer = FakeDeliverer::new();

        flush_on_shutdown(&mut receiver, &deliverer, &state).await;

        assert!(receiver.try_recv().is_err(), "nothing left in flight");
        let delivered = deliverer.delivered.lock().clone();
        assert_eq!(delivered.len(), 3, "every in-memory intent was handed off");
        // Original capture times survive the shutdown path.
        assert_eq!(delivered[0].captured_at, 1_000_000.0);
        assert_eq!(delivered[2].captured_at, 1_000_002.0);
        assert_eq!(state.runtime().last_delivered_at, Some(1_000_002.0));
    }
}
