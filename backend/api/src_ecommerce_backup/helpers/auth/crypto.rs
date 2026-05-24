/// โมดูลสำหรับ Cryptography และ Token Encryption
///
/// โมดูลนี้จัดการการเข้ารหัส/ถอดรหัสข้อมูลที่ละเอียดอ่อน
/// เช่น access tokens, API keys และข้อมูล credentials
///
/// คุณสมบัติ:
/// - AES-256-GCM encryption สำหรับความปลอดภัยสูง
/// - Token encryption/decryption
/// - Secure key derivation
/// - Base64 encoding/decoding
/// - Random nonce generation
use crate::model::error::{AppError, AppResult};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;

pub struct TokenEncryption {
    cipher: Aes256Gcm,
}

impl TokenEncryption {
    pub fn new(key: &[u8; 32]) -> Self {
        Self {
            cipher: Aes256Gcm::new(key.into()),
        }
    }

    pub fn from_base64(key_str: &str) -> AppResult<Self> {
        let key_bytes = BASE64
            .decode(key_str)
            .map_err(|e| AppError::Configuration(format!("Invalid base64 key: {}", e)))?;

        if key_bytes.len() != 32 {
            return Err(AppError::Configuration(
                "Encryption key must be 32 bytes".to_string(),
            ));
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(Self::new(&key))
    }

    pub fn encrypt(&self, plaintext: &str) -> AppResult<String> {
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| AppError::InternalError(format!("Encryption failed: {}", e)))?;

        // Combine nonce and ciphertext
        let mut result = Vec::with_capacity(12 + ciphertext.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);

        Ok(BASE64.encode(result))
    }

    pub fn decrypt(&self, ciphertext: &str) -> AppResult<String> {
        let data = BASE64
            .decode(ciphertext)
            .map_err(|e| AppError::InternalError(format!("Invalid base64 ciphertext: {}", e)))?;

        if data.len() < 12 {
            return Err(AppError::InternalError("Ciphertext too short".to_string()));
        }

        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| AppError::InternalError(format!("Decryption failed: {}", e)))?;

        String::from_utf8(plaintext)
            .map_err(|e| AppError::InternalError(format!("Invalid UTF-8 in decrypted data: {}", e)))
    }
}
