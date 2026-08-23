import * as vscode from "vscode";

// A generated API key is a secret, not a preference — it must never land in
// settings.json (plain text, synced, visible in dotfiles). VS Code's
// SecretStorage is backed by the OS keychain instead.
const API_KEY_SECRET_KEY = "wakaclock.apiKey";
const PENDING_API_KEY_SECRET_KEY = "wakaclock.pendingApiKey";

export function getStoredApiKey(
    secrets: vscode.SecretStorage,
): Thenable<string | undefined> {
    return secrets.get(API_KEY_SECRET_KEY);
}

export function setStoredApiKey(
    secrets: vscode.SecretStorage,
    key: string,
): Thenable<void> {
    return secrets.store(API_KEY_SECRET_KEY, key);
}

export function clearStoredApiKey(secrets: vscode.SecretStorage): Thenable<void> {
    return secrets.delete(API_KEY_SECRET_KEY);
}

/** Candidate key retained while a server is offline; it never replaces a verified key. */
export function getPendingApiKey(
    secrets: vscode.SecretStorage,
): Thenable<string | undefined> {
    return secrets.get(PENDING_API_KEY_SECRET_KEY);
}

export function setPendingApiKey(
    secrets: vscode.SecretStorage,
    key: string,
): Thenable<void> {
    return secrets.store(PENDING_API_KEY_SECRET_KEY, key);
}

export function clearPendingApiKey(secrets: vscode.SecretStorage): Thenable<void> {
    return secrets.delete(PENDING_API_KEY_SECRET_KEY);
}
