import { env } from '@/lib/env';

import { wakaclockClient } from './client';

export function normalizeDeviceCode(value: string): string {
  const compact = value.trim().toUpperCase().replaceAll(/[\s-]+/g, '');
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return compact;
}

// POST /oauth/device/approve — this deliberately reuses the authenticated product client so
// the normal session interceptor supplies the dashboard JWT. The one-request baseURL override
// escapes `/api/v1` without creating a second axios/auth stack.
export async function approveOAuthDevice(userCode: string) {
  const body = new URLSearchParams({ user_code: normalizeDeviceCode(userCode) });
  await wakaclockClient.post('/oauth/device/approve', body, {
    baseURL: env.NEXT_PUBLIC_WAKACLOCK_API_URL,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}
