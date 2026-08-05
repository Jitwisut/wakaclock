import axios from 'axios';

import { env } from '@/lib/env';

import { getCurrentToken, notifyUnauthorized } from './session';

import type { ApiErrorBody } from './types';
import type { AxiosError } from 'axios';

export class WakaclockError extends Error {
  status: null | number;

  constructor(message: string, status: null | number) {
    super(message);
    this.name = 'WakaclockError';
    this.status = status;
  }

  /** GET /admin/* style 404-as-disabled doesn't apply here, but 404 on a real
   *  resource (e.g. a deleted rule) should render as "not found", not a red error. */
  get isNotFound() {
    return this.status === 404;
  }
}

export const wakaclockClient = axios.create({
  baseURL: `${env.NEXT_PUBLIC_WAKACLOCK_API_URL}/api/v1`,
  timeout: 15_000,
});

// A logged-in session's Bearer token always overrides whatever `?user_id=` an
// individual endpoint call still passes — the backend's resolve_user_id() does the same
// override on its side, so this keeps the two in agreement.
wakaclockClient.interceptors.request.use((config) => {
  const token = getCurrentToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

wakaclockClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? null;
    const message =
      error.response?.data?.error ??
      (error.code === 'ECONNABORTED'
        ? 'Request timed out — is the backend running?'
        : error.message);

    // A 401 on any normal endpoint means the stored session token is no longer good —
    // expired, or signed with a JWT_SECRET the server has since rotated. Drop the
    // session so the login form comes back, instead of leaving every panel showing
    // "authentication required" with no way to recover.
    //
    // /auth/* is excluded: a 401 there is just wrong credentials on a login attempt,
    // and there's no session to end.
    const isAuthEndpoint = error.config?.url?.startsWith('/auth/') ?? false;
    if (status === 401 && !isAuthEndpoint) {
      notifyUnauthorized();
    }

    return Promise.reject(new WakaclockError(message, status));
  }
);
