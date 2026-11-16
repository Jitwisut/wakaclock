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
    state: parking_lot::Mutex<DiagnosticsLimiterState>,
}

struct DiagnosticsLimiterState {
    accounts: Governor<Uuid, DefaultKeyedStateStore<Uuid>, DefaultClock>,
    devices: Governor<(Uuid, String), DefaultKeyedStateStore<(Uuid, String)>, DefaultClock>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RateLimitExceeded;

impl AiDiagnosticsRateLimiter {
    /// Device budget remains twelve/minute, burst three. Account budget prevents
    /// callers bypassing it by rotating client-controlled device identifiers.
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            state: parking_lot::Mutex::new(DiagnosticsLimiterState {
                accounts: Governor::keyed(
                    Quota::per_minute(NonZeroU32::new(60).unwrap())
                        .allow_burst(NonZeroU32::new(10).unwrap()),
                ),
                devices: Governor::keyed(
                    Quota::per_minute(NonZeroU32::new(12).unwrap())
                        .allow_burst(NonZeroU32::new(3).unwrap()),
                ),
            }),
        })
    }

    pub fn check(&self, user_id: Uuid, device_id: &str) -> Result<(), RateLimitExceeded> {
        // Admission and cleanup share a lock: concurrent new IDs cannot overshoot.
        let state = self.state.lock();
        state.accounts.retain_recent();
        state.devices.retain_recent();
        if state.accounts.len() >= 10_000 || state.devices.len() >= 10_000 {
            return Err(RateLimitExceeded);
        }
        state
            .accounts
            .check_key(&user_id)
            .map_err(|_| RateLimitExceeded)?;
        state
            .devices
            .check_key(&(user_id, device_id.to_owned()))
            .map_err(|_| RateLimitExceeded)
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

    pub fn check(&self, user_id: Uuid) -> Result<(), RateLimitExceeded> {
        self.inner
            .check_key(&user_id)
            .map_err(|_| RateLimitExceeded)
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

    pub fn check(&self, user_id: Uuid) -> Result<(), RateLimitExceeded> {
        self.inner
            .check_key(&user_id)
            .map_err(|_| RateLimitExceeded)
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
    pub fn check(&self, ip: IpAddr) -> Result<(), RateLimitExceeded> {
        self.inner.check_key(&ip).map_err(|_| RateLimitExceeded)
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
    fn diagnostics_key_capacity_rejects_without_growing_or_resetting_buckets() {
        let limiter = AiDiagnosticsRateLimiter::new();
        let user = Uuid::new_v4();
        {
            let state = limiter.state.lock();
            for index in 0..10_000 {
                state
                    .devices
                    .check_key(&(user, format!("device-{index}")))
                    .unwrap();
            }
        }
        assert!(limiter.check(Uuid::new_v4(), "overflow").is_err());
        let state = limiter.state.lock();
        assert_eq!(state.devices.len(), 10_000);
        assert_eq!(state.accounts.len(), 0);
    }

    #[test]
    fn diagnostics_rotating_devices_exhaust_account_budget() {
        let limiter = AiDiagnosticsRateLimiter::new();
        let user = Uuid::new_v4();
        for index in 0..10 {
            assert!(limiter.check(user, &format!("device-{index}")).is_ok());
        }
        assert!(limiter.check(user, "another-device").is_err());
        assert!(limiter.check(Uuid::new_v4(), "another-device").is_ok());
        assert_eq!(limiter.state.lock().devices.len(), 11);
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

/// Independent OAuth issuance budgets; never consumes the password-login quota.
/// In-memory keys are bounded even when callers invent client IDs/IP addresses.
pub struct OAuthDeviceRateLimiter {
    ips: Governor<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>,
    clients: Governor<String, DefaultKeyedStateStore<String>, DefaultClock>,
}
impl OAuthDeviceRateLimiter {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            ips: Governor::keyed(
                Quota::per_minute(NonZeroU32::new(20).unwrap())
                    .allow_burst(NonZeroU32::new(10).unwrap()),
            ),
            clients: Governor::keyed(
                Quota::per_minute(NonZeroU32::new(60).unwrap())
                    .allow_burst(NonZeroU32::new(30).unwrap()),
            ),
        })
    }
    pub fn check(&self, ip: IpAddr, client_id: &str) -> Result<(), RateLimitExceeded> {
        self.ips.retain_recent();
        self.clients.retain_recent();
        if self.ips.len() >= 10_000 || self.clients.len() >= 10_000 {
            return Err(RateLimitExceeded);
        }
        self.ips.check_key(&ip).map_err(|_| RateLimitExceeded)?;
        self.clients
            .check_key(&client_id.to_owned())
            .map_err(|_| RateLimitExceeded)
    }
}

#[cfg(test)]
mod oauth_tests {
    use super::*;
    #[test]
    fn device_issuance_limits_both_dimensions() {
        let limiter = OAuthDeviceRateLimiter::new();
        let ip = "127.0.0.1".parse().unwrap();
        for n in 0..10 {
            assert!(limiter.check(ip, &format!("client-{n}")).is_ok());
        }
        assert!(limiter.check(ip, "another-client").is_err());
        for n in 1..=30 {
            assert!(limiter
                .check(format!("10.0.0.{n}").parse().unwrap(), "shared-client")
                .is_ok());
        }
        assert!(limiter
            .check("10.0.1.1".parse().unwrap(), "shared-client")
            .is_err());
        assert!(limiter
            .check("10.0.1.2".parse().unwrap(), "independent-client")
            .is_ok());
    }
}

/// Public signup has its own process-local quota, independent of login/logout.
/// Serialize cleanup/admission so concurrent new IPs cannot exceed the key cap.
pub struct EarlyAccessRateLimiter {
    inner: parking_lot::Mutex<Governor<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>>,
    max_keys: usize,
}

impl EarlyAccessRateLimiter {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: parking_lot::Mutex::new(Governor::keyed(
                Quota::per_minute(NonZeroU32::new(5).unwrap())
                    .allow_burst(NonZeroU32::new(5).unwrap()),
            )),
            max_keys: 10_000,
        })
    }

    pub fn check(&self, ip: IpAddr) -> Result<(), RateLimitExceeded> {
        let inner = self.inner.lock();
        inner.retain_recent();
        if inner.len() >= self.max_keys {
            return Err(RateLimitExceeded);
        }
        inner.check_key(&ip).map_err(|_| RateLimitExceeded)
    }
}

#[cfg(test)]
mod early_access_tests {
    use super::*;

    #[test]
    fn signup_does_not_consume_login_or_other_client_budget() {
        let signup = EarlyAccessRateLimiter::new();
        let auth = AuthRateLimiter::new();
        let ip = "192.0.2.1".parse().unwrap();
        for _ in 0..5 {
            assert!(signup.check(ip).is_ok());
        }
        assert!(signup.check(ip).is_err());
        assert!(signup.check("192.0.2.2".parse().unwrap()).is_ok());
        for _ in 0..5 {
            assert!(auth.check(ip).is_ok());
        }
    }

    #[test]
    fn concurrent_new_ips_cannot_grow_state_past_capacity() {
        let limiter = Arc::new(EarlyAccessRateLimiter {
            inner: parking_lot::Mutex::new(Governor::keyed(Quota::per_minute(
                NonZeroU32::new(5).unwrap(),
            ))),
            max_keys: 8,
        });
        let threads: Vec<_> = (1..=32)
            .map(|n| {
                let limiter = limiter.clone();
                std::thread::spawn(move || limiter.check(IpAddr::from([192, 0, 2, n])).is_ok())
            })
            .collect();
        let accepted: usize = threads
            .into_iter()
            .map(|t| usize::from(t.join().unwrap()))
            .sum();
        assert_eq!(accepted, 8);
        assert_eq!(limiter.inner.lock().len(), 8);
    }
}
