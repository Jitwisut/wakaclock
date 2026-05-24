//! Transport layer clients for talking to external services over HTTP.
//!
//! This module holds reusable HTTP clients that the Axum layer can use to
//! communicate with other internal services (e.g. the gateway service) while
//! keeping business logic out of the transport boundary.

pub mod gateway_http;
