import axios from 'axios';

import { env } from '@/lib/env';

import { WakaclockError } from './client';
import { getCurrentToken, notifyUnauthorized } from './session';

import type { ApiErrorBody, V2Envelope } from './types';
import type { AxiosError, AxiosResponse } from 'axios';

/**
 * API v2 lives on its own base path and wraps every response in an envelope, but it is
 * the same server and the same session — so it deliberately reuses `getCurrentToken` and
 * `notifyUnauthorized` rather than growing a second notion of "who is signed in". Two
 * auth states that can disagree is the bug this avoids.
 */
export const wakaclockV2Client = axios.create({
  baseURL: `${env.NEXT_PUBLIC_WAKACLOCK_API_URL}/api/v2`,
  timeout: 15_000,
});

wakaclockV2Client.interceptors.request.use((config) => {
  const token = getCurrentToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

wakaclockV2Client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? null;
    const payload = error.response?.data?.error;
    const message =
      (typeof payload === 'string' ? payload : payload?.message) ??
      (error.code === 'ECONNABORTED'
        ? 'Request timed out — is the backend running?'
        : error.message);

    if (status === 401) {
      notifyUnauthorized();
    }

    return Promise.reject(new WakaclockError(message, status));
  }
);

/**
 * Unwrap `{ data, meta }` in one place.
 *
 * The envelope's `meta` carries request id, freshness and coverage — useful for
 * debugging, not for rendering — so callers get the payload and nothing else. Letting
 * each endpoint reach into `.data.data` is how half of them end up forgetting to.
 */
export function unwrapV2<T>(response: AxiosResponse<V2Envelope<T>>): T {
  return response.data.data;
}
