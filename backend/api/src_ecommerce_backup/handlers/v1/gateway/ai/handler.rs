use axum::{routing::post, Router};
use std::sync::Arc;

use crate::{
    client::ai::ai::{chat_products, chat_products_stream, completion, embedding, sync_products},
    AppState,
};

/// AI handler responsible for exposing embedding, completion, chat, and
/// synchronisation endpoints under the gateway namespace.
pub struct AiHandler {
    state: Arc<AppState>,
}

impl AiHandler {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    pub fn build(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/embedding", post(embedding))
            .route("/completion", post(completion))
            .route("/chat/products", post(chat_products))
            .route("/chat/products/stream", post(chat_products_stream))
            .route("/sync/products", post(sync_products))
            .with_state(self.state.clone())
    }
}
