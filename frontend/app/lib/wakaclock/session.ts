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
