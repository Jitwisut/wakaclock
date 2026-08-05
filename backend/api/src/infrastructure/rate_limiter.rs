use std::net::IpAddr;
use std::num::NonZeroU32;
use std::sync::Arc;

use governor::{
    clock::DefaultClock, state::keyed::DefaultKeyedStateStore, Quota, RateLimiter as Governor,
};

/// Per-IP rate limiter for the auth-sensitive endpoints (`/auth/login`,
/// `/auth/register`, `/users/current/api_key`). `governor` was already a dependency and
/// unused — nothing previously stopped unlimited credential-stuffing or account
/// enumeration attempts against login/register.
pub struct AuthRateLimiter {
    inner: Governor<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>,
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
