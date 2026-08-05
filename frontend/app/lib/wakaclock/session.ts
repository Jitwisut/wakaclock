/**
 * Module-level mirror of the session token, kept in sync by
 * `WakaclockUserProvider`. Exists because the axios interceptor in `client.ts` needs
 * synchronous, non-React access to "what's the current token" — Context can't be read
 * outside a component.
 */
let currentToken: null | string = null;

export function getCurrentToken(): null | string {
  return currentToken;
}

export function setCurrentToken(token: null | string): void {
  currentToken = token;
}

/**
 * Same bridge in the other direction: the interceptor needs to *end* a session when
 * the server rejects its token, but `logout` lives in React state. Without this, a
 * token that's expired or was signed with a since-rotated JWT_SECRET leaves the app
 * stuck — `userId` is still in localStorage so the login gate passes, but every
 * request 401s and there's no path back to the login form.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}
