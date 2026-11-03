use super::*;
use crate::services::team_stripe::WebhookFailure;
use axum::body::Bytes;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CancellationQuery {
    operation_id: Option<Uuid>,
}
fn cancellation_error(error: anyhow::Error) -> ApiError {
    if error
        .downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("billing owner required");
    }
    match error.downcast_ref::<crate::services::team_insights::TeamError>() {
        Some(crate::services::team_insights::TeamError::Invalid(reason)) => {
            ApiError::bad_request(*reason)
        }
        Some(crate::services::team_insights::TeamError::ProjectionChanged) => {
            ApiError::conflict("subscription or authority changed; reload the original operation")
        }
        Some(crate::services::team_insights::TeamError::Disabled) => {
            ApiError::not_found("subscription cancellation unavailable")
        }
        _ => ApiError::service_unavailable(
            "cancellation unconfirmed; inspect the original operation before retrying",
        ),
    }
}
pub async fn cancellation_view(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(input): Query<CancellationQuery>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team cancellation unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if input.operation_id.is_some_and(|id| id.is_nil()) {
        return Err(ApiError::bad_request(
            "original operation identity required",
        ));
    }
    let result = state
        .billing_service
        .team_cancellation_view(actor, org, input.operation_id)
        .await
        .map_err(cancellation_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}
pub async fn accept_cancellation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<crate::services::team_subscription_cancellation::CancellationSelection>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team cancellation unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = state
        .billing_service
        .accept_team_cancellation(actor, org, input)
        .await
        .map_err(cancellation_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}
pub async fn recover_cancellation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<crate::services::team_subscription_cancellation::RecoverCancellation>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team cancellation unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = state
        .billing_service
        .recover_team_cancellation(actor, org, input)
        .await
        .map_err(cancellation_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}

pub async fn portal_destination(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<crate::services::team_stripe_portal::PortalRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team portal unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = state
        .billing_service
        .stripe_portal_destination(actor, org, input)
        .await
        .map_err(|error| {
            if error
                .downcast_ref::<crate::services::authorization::AuthorizationDenied>()
                .is_some()
            {
                return ApiError::forbidden("billing owner required");
            }
            match error.downcast_ref::<crate::services::team_insights::TeamError>() {
                Some(crate::services::team_insights::TeamError::Invalid(reason)) => {
                    ApiError::bad_request(*reason)
                }
                Some(crate::services::team_insights::TeamError::ProjectionChanged) => {
                    ApiError::conflict("billing or portal policy changed; reload")
                }
                Some(crate::services::team_insights::TeamError::Disabled) => {
                    ApiError::not_found("billing portal unavailable")
                }
                _ => ApiError::service_unavailable(
                    "portal unavailable or unconfirmed; request a fresh check",
                ),
            }
        })?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}

fn trial_error(error: anyhow::Error) -> ApiError {
    if error
        .downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("billing owner required");
    }
    match error.downcast_ref::<crate::services::team_insights::TeamError>() {
        Some(crate::services::team_insights::TeamError::Invalid(reason)) => {
            ApiError::bad_request(*reason)
        }
        Some(crate::services::team_insights::TeamError::ProjectionChanged) => {
            ApiError::conflict("trial or organization changed; reload")
        }
        Some(crate::services::team_insights::TeamError::Disabled) => {
            ApiError::not_found("self-service trial unavailable")
        }
        _ => ApiError::service_unavailable("trial unconfirmed; reload status before retrying"),
    }
}

pub async fn trial_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team trial unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = state
        .billing_service
        .team_trial_status(actor, org)
        .await
        .map_err(trial_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}
pub async fn trial_start(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<crate::services::team_trial::StartTrial>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team trial unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = state
        .billing_service
        .start_team_trial(actor, org, input)
        .await
        .map_err(trial_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}
pub async fn trial_recover(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<crate::services::team_trial::RecoverTrial>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team trial unavailable"));
    }
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = state
        .billing_service
        .recover_team_trial(actor, org, input)
        .await
        .map_err(trial_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}

/// Stripe signs the exact bytes. This provider route does not accept user/org identity.
pub async fn webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team receiver disabled"));
    }
    let signature = headers
        .get("stripe-signature")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    state
        .billing_service
        .stripe_webhook(&body, signature)
        .await
        .map_err(|error| match error {
            WebhookFailure::Disabled => ApiError::not_found(error.to_string()),
            WebhookFailure::InvalidSignature => ApiError::forbidden(error.to_string()),
            WebhookFailure::InvalidMetadata => ApiError::bad_request(error.to_string()),
            WebhookFailure::Unavailable | WebhookFailure::NotDurable => {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok(StatusCode::ACCEPTED)
}

async fn customer_request(
    s: Arc<AppState>,
    headers: HeaderMap,
    org: Uuid,
    create: bool,
) -> Result<impl IntoResponse, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe customer setup disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = s
        .billing_service
        .stripe_customer(actor, org, create)
        .await
        .map_err(|e| {
            if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
                .is_some()
            {
                ApiError::forbidden("billing owner required")
            } else {
                ApiError::service_unavailable("customer setup unavailable")
            }
        })?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}
pub async fn customer_status(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    customer_request(s, headers, org, false).await
}
pub async fn customer_prepare(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    customer_request(s, headers, org, true).await
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CustomerRecovery {
    pub operation_id: Uuid,
    pub expected_revision: i64,
    pub confirm: bool,
}
pub async fn customer_recover(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<CustomerRecovery>,
) -> Result<StatusCode, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe customer setup disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    s.billing_service
        .recover_stripe_customer(
            actor,
            org,
            input.operation_id,
            input.expected_revision,
            input.confirm,
        )
        .await
        .map_err(|e| {
            if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
                .is_some()
            {
                return ApiError::forbidden("billing owner required");
            }
            match e.downcast_ref::<crate::services::team_insights::TeamError>() {
                Some(crate::services::team_insights::TeamError::ProjectionChanged) => {
                    ApiError::conflict("customer operation changed; reload")
                }
                Some(crate::services::team_insights::TeamError::NotFound) => {
                    ApiError::not_found("customer operation unavailable")
                }
                Some(crate::services::team_insights::TeamError::Invalid(reason)) => {
                    ApiError::bad_request(*reason)
                }
                _ => ApiError::service_unavailable("customer recovery unavailable"),
            }
        })?;
    Ok(StatusCode::ACCEPTED)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QuoteRequest {
    pub request_id: Uuid,
    pub package_seats: u16,
}
fn quote_error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("billing owner required");
    }
    match e.downcast_ref::<crate::services::team_insights::TeamError>() {
        Some(crate::services::team_insights::TeamError::ProjectionChanged) => {
            ApiError::conflict("billing data changed; reload")
        }
        Some(crate::services::team_insights::TeamError::NotFound) => {
            ApiError::not_found("quote unavailable or expired")
        }
        Some(crate::services::team_insights::TeamError::Invalid(reason)) => {
            ApiError::bad_request(*reason)
        }
        _ => ApiError::service_unavailable("approved package price unavailable"),
    }
}
pub async fn quote_create(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<QuoteRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe pricing disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let quote = s
        .billing_service
        .stripe_quote(actor, org, input.request_id, Some(input.package_seats))
        .await
        .map_err(quote_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(quote, "UTC", None)),
    ))
}
pub async fn quote_get(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe pricing disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let quote = s
        .billing_service
        .stripe_quote(actor, org, id, None)
        .await
        .map_err(quote_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(quote, "UTC", None)),
    ))
}

fn checkout_error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("billing owner required");
    }
    match e.downcast_ref::<crate::services::team_insights::TeamError>() {
        Some(crate::services::team_insights::TeamError::ProjectionChanged) => {
            ApiError::conflict("checkout changed; reload")
        }
        Some(crate::services::team_insights::TeamError::NotFound) => {
            ApiError::not_found("checkout unavailable")
        }
        Some(crate::services::team_insights::TeamError::Invalid(reason)) => {
            ApiError::bad_request(*reason)
        }
        _ => ApiError::service_unavailable("checkout diagnostics unavailable"),
    }
}
pub async fn checkout_status(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe checkout diagnostics disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = s
        .billing_service
        .stripe_checkout_status(actor, org)
        .await
        .map_err(checkout_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}
pub async fn checkout_recover(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<CustomerRecovery>,
) -> Result<StatusCode, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe checkout recovery disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    s.billing_service
        .recover_stripe_checkout(
            actor,
            org,
            input.operation_id,
            input.expected_revision,
            input.confirm,
        )
        .await
        .map_err(checkout_error)?;
    Ok(StatusCode::ACCEPTED)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CheckoutConfirmation {
    pub quote_id: Uuid,
    pub confirm: bool,
}
pub async fn checkout_prepare(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<CheckoutConfirmation>,
) -> Result<impl IntoResponse, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe checkout disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let result = s
        .billing_service
        .prepare_stripe_checkout(actor, org, input.quote_id, input.confirm)
        .await
        .map_err(checkout_error)?;
    Ok((
        StatusCode::ACCEPTED,
        [("cache-control", "private, no-store")],
        Json(envelope(result, "UTC", None)),
    ))
}

pub async fn checkout_destination(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<CustomerRecovery>,
) -> Result<impl IntoResponse, ApiError> {
    if !s.config.team_enabled || !crate::services::team_stripe::enabled() {
        return Err(ApiError::not_found("Stripe checkout disabled"));
    }
    let actor = auth::require_session_user(&s, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if !input.confirm {
        return Err(ApiError::bad_request("confirm opening test checkout"));
    }
    let destination = s
        .billing_service
        .stripe_checkout_destination(actor, org, input.operation_id, input.expected_revision)
        .await
        .map_err(checkout_error)?;
    Ok((
        [("cache-control", "private, no-store")],
        Json(envelope(destination, "UTC", None)),
    ))
}
