use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub struct Logger {}

impl Logger {
    pub fn new() -> Self {
        let env_filter =
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());

        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer().json())
            .try_init()
            .ok();

        Self {}
    }
}

impl Default for Logger {
    fn default() -> Self {
        Self::new()
    }
}
