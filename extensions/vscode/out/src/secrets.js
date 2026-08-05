"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoredApiKey = getStoredApiKey;
exports.setStoredApiKey = setStoredApiKey;
exports.clearStoredApiKey = clearStoredApiKey;
// A generated API key is a secret, not a preference — it must never land in
// settings.json (plain text, synced, visible in dotfiles). VS Code's
// SecretStorage is backed by the OS keychain instead.
const API_KEY_SECRET_KEY = "wakaclock.apiKey";
function getStoredApiKey(secrets) {
    return secrets.get(API_KEY_SECRET_KEY);
}
function setStoredApiKey(secrets, key) {
    return secrets.store(API_KEY_SECRET_KEY, key);
}
function clearStoredApiKey(secrets) {
    return secrets.delete(API_KEY_SECRET_KEY);
}
//# sourceMappingURL=secrets.js.map