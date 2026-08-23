"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoredApiKey = getStoredApiKey;
exports.setStoredApiKey = setStoredApiKey;
exports.clearStoredApiKey = clearStoredApiKey;
exports.getPendingApiKey = getPendingApiKey;
exports.setPendingApiKey = setPendingApiKey;
exports.clearPendingApiKey = clearPendingApiKey;
// A generated API key is a secret, not a preference — it must never land in
// settings.json (plain text, synced, visible in dotfiles). VS Code's
// SecretStorage is backed by the OS keychain instead.
const API_KEY_SECRET_KEY = "wakaclock.apiKey";
const PENDING_API_KEY_SECRET_KEY = "wakaclock.pendingApiKey";
function getStoredApiKey(secrets) {
    return secrets.get(API_KEY_SECRET_KEY);
}
function setStoredApiKey(secrets, key) {
    return secrets.store(API_KEY_SECRET_KEY, key);
}
function clearStoredApiKey(secrets) {
    return secrets.delete(API_KEY_SECRET_KEY);
}
/** Candidate key retained while a server is offline; it never replaces a verified key. */
function getPendingApiKey(secrets) {
    return secrets.get(PENDING_API_KEY_SECRET_KEY);
}
function setPendingApiKey(secrets, key) {
    return secrets.store(PENDING_API_KEY_SECRET_KEY, key);
}
function clearPendingApiKey(secrets) {
    return secrets.delete(PENDING_API_KEY_SECRET_KEY);
}
//# sourceMappingURL=secrets.js.map