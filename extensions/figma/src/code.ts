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

interface Credential {
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
let lastSentAtMs = 0;
let pendingActivity: { entity: string; isWrite: boolean } | null = null;
let heartbeatInFlight = false;
let refreshInFlight: { refreshToken: string; promise: Promise<Credential | null> } | null = null;
let pollingGeneration = 0;

function queueActivity(entity: string, isWrite: boolean) {
  pendingActivity = { entity, isWrite: isWrite || pendingActivity?.isWrite === true };
}

function postStatus(extra: Record<string, unknown> = {}) {
  figma.ui.postMessage({ type: 'status', connected: credential !== null, ...extra });
}

async function requestForm<T>(path: string, body: URLSearchParams, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body.toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof payload.error === 'string' ? payload.error : null;
    const message = code ?? `request failed (${response.status})`;
    throw new ApiRequestError(message, response.status, code);
  }
  return payload as T;
}

function toCredential(token: TokenResponse): Credential {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(0, token.expires_in - 30) * 1000,
  };
}

async function storeCredential(next: Credential | null) {
  credential = next;
  if (next) await figma.clientStorage.setAsync(CREDENTIAL_KEY, next);
  else await figma.clientStorage.deleteAsync(CREDENTIAL_KEY);
  postStatus();
}

async function refreshCredential(current: Credential): Promise<Credential | null> {
  if (refreshInFlight?.refreshToken === current.refreshToken) return refreshInFlight.promise;

  const promise = (async () => {
    try {
      const token = await requestForm<TokenResponse>(
        '/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
          client_id: CLIENT_ID,
        })
      );
      return toCredential(token);
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

async function postHeartbeatRequest(accessToken: string, entity: string, isWrite: boolean) {
  return fetch(`${API_URL}/api/v1/heartbeats`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildHeartbeat(entity, isWrite)),
  });
}

async function sendHeartbeat(entity: string, isWrite: boolean) {
  if (heartbeatInFlight) {
    queueActivity(entity, isWrite);
    return;
  }
  heartbeatInFlight = true;
  try {
    if (!credential) {
      queueActivity(entity, isWrite);
      return;
    }
    if (credential.expiresAt <= Date.now()) {
      const current = credential;
      await refreshStoredCredential(current);
      if (!credential) {
        queueActivity(entity, isWrite);
        return;
      }
    }

    let current = credential;
    let usedAccessToken = current.accessToken;
    let response = await postHeartbeatRequest(usedAccessToken, entity, isWrite);

    if (response.status === 401 && credential?.accessToken === usedAccessToken) {
      // The server may expire/revoke an access token before our local timer does. Refresh once
      // before treating the session as disconnected.
      await refreshStoredCredential(current);
      if (!credential) {
        queueActivity(entity, isWrite);
        return;
      }
      current = credential;
      usedAccessToken = current.accessToken;
      response = await postHeartbeatRequest(usedAccessToken, entity, isWrite);
    }

    if (response.status === 401) {
      // Never let a late response from an older request erase a credential established by a
      // newer device authorization/refresh operation.
      if (credential?.accessToken === usedAccessToken) await storeCredential(null);
      queueActivity(entity, isWrite);
      return;
    }
    if (!response.ok) throw new Error(`heartbeat request failed (${response.status})`);
    lastSentAtMs = Date.now();
    postStatus({ lastSentAt: lastSentAtMs });
  } finally {
    heartbeatInFlight = false;
  }
}

function currentEntity(): string {
  return buildEntity(figma.root.name, figma.currentPage.name);
}

function recordActivity(isWrite: boolean) {
  const now = Date.now();
  const entity = currentEntity();
  if (shouldSendImmediately(isWrite, lastSentAtMs, now)) {
    void sendHeartbeat(entity, isWrite).catch((error: unknown) => {
      queueActivity(entity, isWrite);
      postStatus({ error: error instanceof Error ? error.message : 'failed to send heartbeat' });
    });
  } else {
    pendingActivity = {
      entity,
      isWrite: isWrite || pendingActivity?.isWrite === true,
    };
  }
}

async function connectDevice() {
  const generation = ++pollingGeneration;
  postStatus({ connecting: true, error: null });
  try {
    const device = await requestForm<DeviceCodeResponse>(
      '/oauth/device/code',
      new URLSearchParams({ client_id: CLIENT_ID, scope: 'write_logged_time' })
    );
    const approvalUrl = new URL(device.verification_uri);
    approvalUrl.searchParams.set('code', device.user_code);
    figma.openExternal(approvalUrl.toString());
    postStatus({
      connecting: true,
      userCode: device.user_code,
      verificationUri: approvalUrl.toString(),
    });

    const deadline = Date.now() + device.expires_in * 1000;
    let intervalMs = Math.max(5, device.interval) * 1000;
    while (generation === pollingGeneration && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      try {
        const token = await requestForm<TokenResponse>(
          '/oauth/device/token',
          new URLSearchParams({ device_code: device.device_code, client_id: CLIENT_ID })
        );
        await storeCredential(toCredential(token));
        postStatus({ connecting: false, userCode: null });
        if (pendingActivity) {
          const pending = pendingActivity;
          pendingActivity = null;
          await sendHeartbeat(pending.entity, pending.isWrite);
        }
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
      void storeCredential(null);
    }
    if (message.type === 'close') figma.closePlugin();
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

  setInterval(() => {
    if (!pendingActivity) return;
    if (Date.now() - lastSentAtMs < NON_WRITE_HEARTBEAT_INTERVAL_MS && !pendingActivity.isWrite) return;
    const pending = pendingActivity;
    pendingActivity = null;
    void sendHeartbeat(pending.entity, pending.isWrite).catch((error: unknown) => {
      queueActivity(pending.entity, pending.isWrite);
      postStatus({ error: error instanceof Error ? error.message : 'failed to send heartbeat' });
    });
  }, 1_000);

  recordActivity(false);
}

void main().catch((error: unknown) => {
  figma.notify(error instanceof Error ? error.message : 'AtoAxis failed to start', { error: true });
  figma.closePlugin();
});
