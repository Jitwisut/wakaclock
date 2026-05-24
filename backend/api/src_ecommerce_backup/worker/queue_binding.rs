use std::env;

/// Describes how a consumer should bind to RabbitMQ streams/exchanges.
#[derive(Clone, Debug)]
pub struct QueueBinding {
    pub stream: String,
    pub consumer: String,
    pub routing_key: String,
}

impl QueueBinding {
    pub fn new(stream: &str, consumer: &str, routing_key: &str) -> Self {
        Self {
            stream: stream.to_string(),
            consumer: consumer.to_string(),
            routing_key: routing_key.to_string(),
        }
    }
}

/// Resolve a binding from environment variables while falling back to defaults.
///
/// The `env_prefix` should be a string such as `CONSUMER_PRODUCT_EMBEDDING`.
/// The resolver will read:
/// - `{PREFIX}_STREAM`
/// - `{PREFIX}_CONSUMER`
/// - `{PREFIX}_ROUTING_KEY`
pub fn resolve_binding(env_prefix: &str, defaults: QueueBinding) -> QueueBinding {
    let stream_key = format!("{}_STREAM", env_prefix);
    let consumer_key = format!("{}_CONSUMER", env_prefix);
    let routing_key = format!("{}_ROUTING_KEY", env_prefix);

    QueueBinding {
        stream: env::var(&stream_key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(defaults.stream),
        consumer: env::var(&consumer_key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(defaults.consumer),
        routing_key: env::var(&routing_key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(defaults.routing_key),
    }
}
