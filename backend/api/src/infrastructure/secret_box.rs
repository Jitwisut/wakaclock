//! Symmetric envelope for credentials the product must be able to show again.
//!
//! Today this seals the dashboard API key so `GET /users/current/api_key` can
//! return it after the tab was closed, instead of the plaintext-in-ClickHouse
//! column the 2026-09-09 hardening pass removed. The bytes at rest are
//! AES-256-GCM ciphertext under a single master key from `ATOAXIS_KMS_KEY_ID`;
//! reading the `api_keys` row or a database backup no longer yields a usable
//! credential.
//!
//! Each `seal`/`open` is bound to caller-supplied associated data (the owning
//! `user_id`), so a ciphertext copied into another user's row fails
//! authentication rather than decrypting.
//!
//! This is the local-vault seed the F11 integration-credential sealing will
//! build on. It is deliberately a single process-wide key: it is not a
//! substitute for a real KMS in a deployment that needs per-tenant key
//! isolation or centrally audited decrypt calls.

use anyhow::{anyhow, bail, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM, NONCE_LEN};
use ring::rand::{SecureRandom, SystemRandom};

/// Recorded in `api_keys.secret_key_version` so a future key rotation can tell
/// which master key sealed a given row.
pub const KEY_VERSION: &str = "local-aesgcm-v1";

/// First byte of every envelope. Lets `open` reject anything not produced here
/// before it touches the AEAD.
const ENVELOPE_V1: u8 = 1;

pub struct SecretBox {
    key: LessSafeKey,
    rng: SystemRandom,
}

impl SecretBox {
    /// Build from the raw env value of `ATOAXIS_KMS_KEY_ID`: 32 bytes, base64
    /// (standard padded). Returns an error rather than silently accepting a
    /// short key.
    pub fn from_env_value(raw: &str) -> Result<Self> {
        let bytes = BASE64
            .decode(raw.trim())
            .context("ATOAXIS_KMS_KEY_ID must be base64 (standard, padded)")?;
        if bytes.len() != 32 {
            bail!(
                "ATOAXIS_KMS_KEY_ID must decode to 32 bytes for AES-256, got {}",
                bytes.len()
            );
        }
        let key = UnboundKey::new(&AES_256_GCM, &bytes)
            .map_err(|_| anyhow!("ATOAXIS_KMS_KEY_ID is not a valid AES-256 key"))?;
        Ok(Self {
            key: LessSafeKey::new(key),
            rng: SystemRandom::new(),
        })
    }

    /// `ENVELOPE_V1 || nonce(12) || ciphertext||tag`. `aad` is authenticated but
    /// not stored; `open` must be given the same bytes.
    pub fn seal(&self, aad: &[u8], plaintext: &[u8]) -> Result<Vec<u8>> {
        let mut nonce_bytes = [0u8; NONCE_LEN];
        self.rng
            .fill(&mut nonce_bytes)
            .map_err(|_| anyhow!("secure RNG unavailable while sealing a credential"))?;

        let mut in_out = plaintext.to_vec();
        self.key
            .seal_in_place_append_tag(
                Nonce::assume_unique_for_key(nonce_bytes),
                Aad::from(aad),
                &mut in_out,
            )
            .map_err(|_| anyhow!("failed to seal credential"))?;

        let mut out = Vec::with_capacity(1 + NONCE_LEN + in_out.len());
        out.push(ENVELOPE_V1);
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&in_out);
        Ok(out)
    }

    /// Inverse of [`seal`]. Fails if the envelope version is unknown, the bytes
    /// are truncated, the master key differs, or `aad` does not match what was
    /// sealed.
    pub fn open(&self, aad: &[u8], sealed: &[u8]) -> Result<Vec<u8>> {
        if sealed.first() != Some(&ENVELOPE_V1) {
            bail!("unrecognised credential envelope version");
        }
        if sealed.len() < 1 + NONCE_LEN + AES_256_GCM.tag_len() {
            bail!("credential envelope is truncated");
        }
        let nonce_bytes: [u8; NONCE_LEN] = sealed[1..1 + NONCE_LEN]
            .try_into()
            .expect("slice length checked above");
        let mut in_out = sealed[1 + NONCE_LEN..].to_vec();
        let plaintext = self
            .key
            .open_in_place(
                Nonce::assume_unique_for_key(nonce_bytes),
                Aad::from(aad),
                &mut in_out,
            )
            .map_err(|_| anyhow!("credential envelope failed authentication"))?;
        Ok(plaintext.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_box() -> SecretBox {
        // 32 zero bytes, base64. Test-only key.
        SecretBox::from_env_value(&BASE64.encode([0u8; 32])).unwrap()
    }

    #[test]
    fn rejects_a_master_key_that_is_not_32_bytes() {
        assert!(SecretBox::from_env_value(&BASE64.encode([0u8; 16])).is_err());
        assert!(SecretBox::from_env_value("not-base64!!").is_err());
    }

    #[test]
    fn seals_and_opens_round_trip() {
        let sb = test_box();
        let aad = b"user-uuid-bytes";
        let sealed = sb.seal(aad, b"wcl_secret_value").unwrap();
        assert_ne!(&sealed[1 + NONCE_LEN..], b"wcl_secret_value");
        assert_eq!(sb.open(aad, &sealed).unwrap(), b"wcl_secret_value");
    }

    #[test]
    fn a_ciphertext_moved_to_another_owner_does_not_open() {
        let sb = test_box();
        let sealed = sb.seal(b"owner-a", b"wcl_secret_value").unwrap();
        assert!(sb.open(b"owner-b", &sealed).is_err());
    }

    #[test]
    fn a_tampered_envelope_does_not_open() {
        let sb = test_box();
        let mut sealed = sb.seal(b"owner", b"wcl_secret_value").unwrap();
        let last = sealed.len() - 1;
        sealed[last] ^= 0x01;
        assert!(sb.open(b"owner", &sealed).is_err());
    }

    #[test]
    fn each_seal_uses_a_fresh_nonce() {
        let sb = test_box();
        let a = sb.seal(b"owner", b"same-input").unwrap();
        let b = sb.seal(b"owner", b"same-input").unwrap();
        assert_ne!(
            a, b,
            "nonce reuse would make two seals of one value identical"
        );
    }
}
