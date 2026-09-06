use std::net::IpAddr;
use std::num::NonZeroU32;
use std::sync::Arc;

use governor::{
    clock::DefaultClock, state::keyed::DefaultKeyedStateStore, Quota, RateLimiter as Governor,
};
use uuid::Uuid;

/// Per-IP rate limiter for the auth-sensitive endpoints (`/auth/login`,
/// `/auth/register`, `/users/current/api_key`). `governor` was already a dependency and
/// unused — nothing previously stopped unlimited credential-stuffing or account
/// enumeration attempts against login/register.
pub struct AuthRateLimiter {
    inner: Governor<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>,
}

/// Per-account limiter for expensive analytics/reprocess reads and rebuilds.
///
/// This is intentionally separate from [`AuthRateLimiter`]. Authentication endpoints are
/// keyed by the network peer and need a very small burst; analytics requests are authenticated
/// work and must remain bounded even when one account fans out over several browser tabs or
/// API-key clients. Keeping the key at the verified user id also avoids trusting a client
/// supplied `user_id` query parameter.
pub struct AnalyticsRateLimiter {
    inner: Governor<Uuid, DefaultKeyedStateStore<Uuid>, DefaultClock>,
}

/// Movement/zone updates are intentionally much cheaper than analytics, but a browser
/// can still generate unbounded drag events. This limiter keeps the public contract at
/// ten accepted updates per second per authenticated user.
pub struct PresenceRateLimiter {
    inner: Governor<Uuid, DefaultKeyedStateStore<Uuid>, DefaultClock>,
}

/// Per-user/device limiter for diagnostics snapshots. Diagnostics are metadata-only,
/// but an authenticated client can still exhaust the API with a tight upload loop.
/// Keeping the device in the key lets a user's legitimate machines report independently.
pub struct AiDiagnosticsRateLimiter {
    inner: Governor<(Uuid, String), DefaultKeyedStateStore<(Uuid, String)>, DefaultClock>,
}

impl AiDiagnosticsRateLimiter {
    /// Twelve reports per minute with a small startup burst. The CLI normally uploads
    /// only on an explicit doctor command, so this leaves room for retries without
    /// allowing an accidental polling loop to become unbounded.
    pub fn new() -> Arc<Self> {
        let quota = Quota::per_minute(NonZeroU32::new(12).expect("12 is non-zero"))
            .allow_burst(NonZeroU32::new(3).expect("3 is non-zero"));
        Arc::new(Self {
            inner: Governor::keyed(quota),
        })
    }

    pub fn check(&self, user_id: Uuid, device_id: &str) -> Result<(), ()> {
        self.inner
            .check_key(&(user_id, device_id.to_string()))
            .map_err(|_| ())
    }
}

impl PresenceRateLimiter {
    pub fn new() -> Arc<Self> {
        let quota = Quota::per_second(NonZeroU32::new(10).expect("10 is non-zero"))
            .allow_burst(NonZeroU32::new(10).expect("10 is non-zero"));
        Arc::new(Self {
            inner: Governor::keyed(quota),
        })
    }

    pub fn check(&self, user_id: Uuid) -> Result<(), ()> {
        self.inner.check_key(&user_id).map_err(|_| ())
    }
}

impl AnalyticsRateLimiter {
    /// 30 expensive operations per minute, with a burst of 10 for a dashboard's initial
    /// parallel requests. A normal dashboard refresh stays well below this; pathological
    /// project/file/reprocess loops are throttled with a stable 429 instead of exhausting
    /// ClickHouse.
    pub fn new() -> Arc<Self> {
        let quota = Quota::per_minute(NonZeroU32::new(30).expect("30 is non-zero"))
            .allow_burst(NonZeroU32::new(10).expect("10 is non-zero"));
        Arc::new(Self {
            inner: Governor::keyed(quota),
        })
    }

    pub fn check(&self, user_id: Uuid) -> Result<(), ()> {
        self.inner.check_key(&user_id).map_err(|_| ())
    }
}

impl AuthRateLimiter {
    /// 5 attempts per minute per IP, with a small burst allowance — generous enough for
    /// a real user who mistypes a password twice, tight enough to make brute-forcing
    /// impractical.
    pub fn new() -> Arc<Self> {
        let quota = Quota::per_minute(NonZeroU32::new(5).expect("5 is non-zero"))
            .allow_burst(NonZeroU32::new(5).expect("5 is non-zero"));
        Arc::new(Self {
            inner: Governor::keyed(quota),
        })
    }

    /// `Ok(())` if this IP is still within quota, `Err(())` if it should be rejected
    /// with a 429. The wait-time detail from `governor`'s `NotUntil` isn't surfaced —
    /// callers don't need it to return a flat "try again later".
    pub fn check(&self, ip: IpAddr) -> Result<(), ()> {
        self.inner.check_key(&ip).map_err(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::{AiDiagnosticsRateLimiter, AnalyticsRateLimiter};
    use uuid::Uuid;

    #[test]
    fn analytics_limit_is_scoped_to_an_account_and_has_a_bounded_burst() {
        let limiter = AnalyticsRateLimiter::new();
        let user = Uuid::new_v4();
        for _ in 0..10 {
            assert!(limiter.check(user).is_ok());
        }
        assert!(limiter.check(user).is_err());

        // A different authenticated account must not be penalized by the first account's
        // expensive-query burst.
        assert!(limiter.check(Uuid::new_v4()).is_ok());
    }

    #[test]
    fn diagnostics_limit_is_scoped_to_user_and_device() {
        let limiter = AiDiagnosticsRateLimiter::new();
        let user = Uuid::new_v4();
        for _ in 0..3 {
            assert!(limiter.check(user, "device-a").is_ok());
        }
        assert!(limiter.check(user, "device-a").is_err());
        assert!(limiter.check(user, "device-b").is_ok());
        assert!(limiter.check(Uuid::new_v4(), "device-a").is_ok());
    }
}
