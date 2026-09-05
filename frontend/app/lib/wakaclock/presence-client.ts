const PRESENCE_CLIENT_ID_KEY = 'wakaclock.presence.v2.clientId';

/**
 * One movement controller id per browser tab. sessionStorage survives a reload but is
 * isolated between tabs, which lets the backend reject delayed movement from an older tab
 * without treating two tabs as the same sequence source.
 */
export function getPresenceClientId(): null | string {
  if (typeof window === 'undefined') return null;
  const existing = window.sessionStorage.getItem(PRESENCE_CLIENT_ID_KEY);
  if (existing) return existing;
  const id = window.crypto.randomUUID();
  window.sessionStorage.setItem(PRESENCE_CLIENT_ID_KEY, id);
  return id;
}

export function getBrowserTimezone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
