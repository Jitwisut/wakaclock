import { unwrapV2, wakaclockV2Client } from './client-v2';
import type { V2Envelope } from './types';

export interface TeamPortalDestination {
  request_id: string;
  url: string;
  observed_at: string;
  display_until: string;
  provider_expires_at: null;
  purposes: Array<'customer_update' | 'invoice_history' | 'payment_method_update'>;
  payment_or_access_confirmed: false;
}
export async function getTeamPortalDestination(org: string, requestId: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamPortalDestination>>(
      `/organizations/${org}/billing/portal`,
      { request_id: requestId, confirm: true }
    )
  );
}

/** Match the documented path-token and secret-query forms, never other hosts,
 * embedded credentials, extra query parameters or client-selected redirects. */
export function isTeamPortalUrl(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length > 8192 || !/^[\x21-\x7e]+$/.test(raw)) return false;
  try {
    const url = new URL(raw);
    if (url.origin !== 'https://billing.stripe.com' || url.username || url.password || url.hash)
      return false;
    let token: string;
    if (url.pathname === '/p/session') {
      const entries = Array.from(url.searchParams.entries());
      if (entries.length !== 1 || entries[0][0] !== 'secret') return false;
      token = entries[0][1];
    } else if (url.pathname.startsWith('/p/session/')) {
      if (url.search) return false;
      token = url.pathname.slice('/p/session/'.length);
    } else return false;
    return /^[a-zA-Z0-9_]+$/.test(token);
  } catch {
    return false;
  }
}
