import { HeartbeatQueue, newDeliveryId, type QueuedHeartbeat } from './queue';
import {
  buildEntity,
  buildHeartbeat,
  hasLocalDocumentChange,
  NON_WRITE_HEARTBEAT_INTERVAL_MS,
  shouldSendImmediately,
} from './protocol';

const CLIENT_ID = 'atoaxis_figma';
const API_URL = __ATOAXIS_API_URL__;
const CREDENTIAL_KEY = 'atoaxis-oauth-credential-v1';
// Explicit host signature prevents lib.dom from hiding sandbox API mismatches.
const hostFetch = fetch as unknown as (url: string, init?: FetchOptions) => Promise<FetchResponse>;

interface Credential {
  queueScope: string;
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

interface DeviceCodeResponse {
  device_code: string;
  expires_in: number;
  interval: number;
  user_code: string;
  verification_uri: string;
}

type UiMessage = { type: 'connect' } | { type: 'disconnect' } | { type: 'close' };

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

let credential: Credential | null = null;
let credentialWrites: Promise<void> = Promise.resolve();
let captureWrites: Promise<void> = Promise.resolve();
let lastSentAtMs = 0;
const queueWarnings = new Set<string>();
const queue = new HeartbeatQueue(figma.clientStorage, Date.now, (message) => {
  postStatus({ error: message });
  if (!queueWarnings.has(message)) {
    queueWarnings.add(message);
    figma.notify(message, { error: true, timeout: 10_000 });
  }
});
let refreshInFlight: { refreshToken: string; promise: Promise<Credential | null> } | null = null;
let pollingGeneration = 0;

function postStatus(extra: Record<string, unknown> = {}) {
  figma.ui.postMessage({ type: 'status', connected: credential !== null, ...extra });
}

async function requestForm<T>(path: string, body: Record<string, string>, accessToken?: string): Promise<T> {
  const response = await hostFetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: Object.entries(body).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof payload.error === 'string' ? payload.error : null;
    const message = code ?? `request failed (${response.status})`;
    throw new ApiRequestError(message, response.status, code);
  }
  return payload as T;
}

function toCredential(token: TokenResponse, queueScope = newDeliveryId()): Credential {
  return {
    queueScope,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(0, token.expires_in - 30) * 1000,
  };
}

async function storeCredential(next: Credential | null) {
  credential = next;
  const write = credentialWrites.catch(() => undefined).then(async () => {
    if (next) await figma.clientStorage.setAsync(CREDENTIAL_KEY, next);
    else await figma.clientStorage.deleteAsync(CREDENTIAL_KEY);
  });
  credentialWrites = write;
  await write;
  postStatus();
}

async function refreshCredential(current: Credential): Promise<Credential | null> {
  if (refreshInFlight?.refreshToken === current.refreshToken) return refreshInFlight.promise;

  const promise = (async () => {
    try {
      const token = await requestForm<TokenResponse>(
        '/oauth/token',
        {
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
          client_id: CLIENT_ID,
        }
      );
      return toCredential(token, current.queueScope);
    } catch (error) {
      // A rejected/rotated refresh token is terminal. Network failures and 5xx responses are
      // recoverable, so keep the stored refresh token and retry on later activity instead of
      // forcing the user through device authorization again.
      if (error instanceof ApiRequestError && error.status === 400 && error.code === 'invalid_grant') {
        return null;
      }
      throw error;
    }
  })();
  refreshInFlight = { refreshToken: current.refreshToken, promise };
  try {
    return await promise;
  } finally {
    if (refreshInFlight?.promise === promise) refreshInFlight = null;
  }
}

async function refreshStoredCredential(current: Credential): Promise<Credential | null> {
  const refreshed = await refreshCredential(current);
  if (credential?.refreshToken !== current.refreshToken) return credential;
  await storeCredential(refreshed);
  return credential;
}

async function loadCredential() {
  const stored = (await figma.clientStorage.getAsync(CREDENTIAL_KEY)) as Credential | undefined;
  if (!stored?.accessToken || !stored.refreshToken) return;
  if (!stored.queueScope) {
    stored.queueScope = newDeliveryId();
    await storeCredential(stored);
  }
  if (stored.expiresAt > Date.now()) {
    credential = stored;
    return;
  }
  credential = stored;
  try {
    await refreshStoredCredential(stored);
  } catch (error) {
    postStatus({
      error: error instanceof Error ? error.message : 'temporarily unable to refresh AtoAxis session',
    });
  }
}

async function postHeartbeatRequest(accessToken: string, payload: QueuedHeartbeat) {
  return hostFetch(`${API_URL}/api/v1/heartbeats`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function isStoredScope(scope: string): Promise<boolean> {
  const stored = await figma.clientStorage.getAsync(CREDENTIAL_KEY) as Credential | undefined;
  return stored?.queueScope === scope;
}

async function flushQueue() {
  const scope = credential?.queueScope;
  if (!scope) return;
  await queue.flush(scope, async (payload) => {
    if (!credential || credential.queueScope !== scope || !await isStoredScope(scope)) return { status: 401 };
    if (credential.expiresAt <= Date.now()) await refreshStoredCredential(credential);
    if (!credential || credential.queueScope !== scope || !await isStoredScope(scope)) return { status: 401 };
    let current = credential;
    let response = await postHeartbeatRequest(current.accessToken, payload);
    if (response.status === 401 && credential?.accessToken === current.accessToken) {
      await refreshStoredCredential(current);
      if (!credential || credential.queueScope !== scope || !await isStoredScope(scope)) return { status: 401 };
      current = credential;
      response = await postHeartbeatRequest(current.accessToken, payload);
    }
    if (response.status === 401 && credential?.accessToken === current.accessToken) {
      await storeCredential(null);
    }
    if (response.ok && credential?.queueScope === scope) {
      lastSentAtMs = Date.now();
      postStatus({ lastSentAt: lastSentAtMs });
    }
    return { status: response.status, retryAfter: Object.entries(response.headersObject).find(([name]) => name.toLowerCase() === 'retry-after')?.[1] };
  });
}

function reportError(error: unknown) {
  postStatus({ error: error instanceof Error ? error.message : 'Unable to persist or deliver activity' });
}

function currentEntity(): string {
  return buildEntity(figma.root.name, figma.currentPage.name);
}

function recordActivity(isWrite: boolean) {
  // Never bind disconnected activity to whichever account connects next.
  const scope = credential?.queueScope;
  if (!scope) return;
  const now = Date.now();
  const payload = { ...buildHeartbeat(currentEntity(), isWrite, now), heartbeat_id: newDeliveryId() };
  const dueAt = shouldSendImmediately(isWrite, lastSentAtMs, now)
    ? now : lastSentAtMs + NON_WRITE_HEARTBEAT_INTERVAL_MS;
  captureWrites = captureWrites.catch(() => undefined).then(async () => {
    await credentialWrites;
    if (!await isStoredScope(scope)) return;
    await queue.enqueue(scope, payload, dueAt);
  });
  void captureWrites.then(flushQueue).catch(reportError);
}

function approvalLink(uri: string, code: string): string {
  // The main sandbox has no URL API. Accept only an absolute HTTPS URL with a
  // conventional hostname, no credentials, whitespace, controls or backslashes.
  if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:[/?#]|$)/i.test(uri) || /[\s\u0000-\u001f\u007f\\]/.test(uri)) {
    throw new Error('Invalid device approval URL');
  }
  const hashAt = uri.indexOf('#');
  const fragment = hashAt < 0 ? '' : uri.slice(hashAt);
  const base = hashAt < 0 ? uri : uri.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  const path = queryAt < 0 ? base : base.slice(0, queryAt);
  const params = queryAt < 0 ? [] : base.slice(queryAt + 1).split('&').filter((param) =>
    param && decodeURIComponent(param.split('=')[0]) !== 'code');
  params.push(`code=${encodeURIComponent(code)}`);
  return `${path}?${params.join('&')}${fragment}`;
}

async function connectDevice() {
  const generation = ++pollingGeneration;
  postStatus({ connecting: true, error: null });
  try {
    const device = await requestForm<DeviceCodeResponse>(
      '/oauth/device/code',
      { client_id: CLIENT_ID, scope: 'write_logged_time' }
    );
    const approvalUrl = approvalLink(device.verification_uri, device.user_code);
    figma.openExternal(approvalUrl);
    postStatus({
      connecting: true,
      userCode: device.user_code,
      verificationUri: approvalUrl,
    });

    const deadline = Date.now() + device.expires_in * 1000;
    let intervalMs = Math.max(5, device.interval) * 1000;
    while (generation === pollingGeneration && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      try {
        const token = await requestForm<TokenResponse>(
          '/oauth/device/token',
          { device_code: device.device_code, client_id: CLIENT_ID }
        );
        if (generation !== pollingGeneration) return;
        await storeCredential(toCredential(token));
        lastSentAtMs = 0;
        postStatus({ connecting: false, userCode: null });
        void flushQueue().catch(reportError);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'authorization_pending') continue;
        if (message === 'slow_down') {
          intervalMs += 5_000;
          continue;
        }
        throw error;
      }
    }
    if (generation === pollingGeneration) throw new Error('Device authorization expired');
  } catch (error) {
    if (generation === pollingGeneration) {
      postStatus({
        connecting: false,
        error: error instanceof Error ? error.message : 'Device authorization failed',
      });
    }
  }
}

async function main() {
  figma.showUI(__html__, { width: 360, height: 300, themeColors: true });
  await loadCredential();
  postStatus();

  figma.ui.onmessage = (message: UiMessage) => {
    if (message.type === 'connect') void connectDevice();
    if (message.type === 'disconnect') {
      pollingGeneration += 1;
      void storeCredential(null).catch(reportError);
    }
    if (message.type === 'close') {
      pollingGeneration += 1;
      void Promise.all([captureWrites, queue.settled(), credentialWrites])
        .then(() => figma.closePlugin()).catch(reportError);
    }
  };

  figma.on('selectionchange', () => recordActivity(false));
  figma.on('currentpagechange', () => recordActivity(false));

  // Figma requires a full-page load before documentchange is available with dynamic-page
  // manifests. We inspect only the LOCAL/REMOTE origin bit; node/content data never crosses
  // the heartbeat boundary.
  await figma.loadAllPagesAsync();
  figma.on('documentchange', (event) => {
    if (hasLocalDocumentChange(event.documentChanges.map((change) => change.origin))) {
      recordActivity(true);
    }
  });

  setInterval(() => { void flushQueue().catch(reportError); }, 1_000);
  void flushQueue().catch(reportError);

  recordActivity(false);
}

void main().catch((error: unknown) => {
  figma.notify(error instanceof Error ? error.message : 'AtoAxis failed to start', { error: true });
  figma.closePlugin();
});
