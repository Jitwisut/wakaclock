import { CanceledError } from 'axios';

import { getCurrentToken, getSessionObservation, notifyUnauthorized } from './session';

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Keep the dispatch generation on the request object, outside headers and logs.
const generations = new WeakMap<InternalAxiosRequestConfig, 'unconfirmed' | number>();

export function bindRequestSession(config: InternalAxiosRequestConfig) {
  const token = getCurrentToken();
  generations.set(config, getSessionObservation(token));
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

function isCurrent(config: InternalAxiosRequestConfig | undefined) {
  return !!config && generations.get(config) === getSessionObservation(getCurrentToken());
}

export function acceptSessionResponse<T>(response: AxiosResponse<T>) {
  if (!isCurrent(response.config)) throw new CanceledError('Session changed during request');
  return response;
}

export function rejectRequestSession(config: InternalAxiosRequestConfig | undefined) {
  if (isCurrent(config) && getCurrentToken()) notifyUnauthorized();
}
