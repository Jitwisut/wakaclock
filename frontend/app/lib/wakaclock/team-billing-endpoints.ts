import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { V2Envelope } from './types';

export interface TeamCustomerStatus {
  disposition: 'owner_changed' | 'pending' | 'recovery_required' | 'verified';
  last_error_code: null | string;
  lookup_only: boolean;
  observed_at: null | string;
  operation_id: string;
  retry_at: string;
  revision: number;
}
const path = (org: string) => `/organizations/${org}/billing/customer`;
export async function getTeamCustomer(org: string, signal?: AbortSignal) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<null | TeamCustomerStatus>>(path(org), { signal })
  );
}
export async function prepareTeamCustomer(org: string) {
  return unwrapV2(await wakaclockV2Client.post<V2Envelope<TeamCustomerStatus>>(path(org)));
}
export async function recoverTeamCustomer(org: string, operation: string, revision: number) {
  await wakaclockV2Client.post(`${path(org)}/recover`, {
    operation_id: operation,
    expected_revision: revision,
    confirm: true,
  });
}

export interface TeamPriceQuote {
  amount_minor: string;
  catalog_revision: string;
  catalog_sha256: string;
  checkout_available: false;
  currency: string;
  expires_at: string;
  id: string;
  interval: 'month';
  observed_at: string;
  package_seats: number;
  quantity: 1;
  tax_behavior: 'exclusive' | 'inclusive' | 'unspecified';
  test_checkout_confirmation_available?: boolean;
  total_due_minor: null;
}
export async function createTeamPriceQuote(org: string, requestId: string, seats: number) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamPriceQuote>>(
      `/organizations/${org}/billing/quotes`,
      {
        request_id: requestId,
        package_seats: seats,
      }
    )
  );
}
export async function getTeamPriceQuote(org: string, id: string, signal?: AbortSignal) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamPriceQuote>>(
      `/organizations/${org}/billing/quotes/${id}`,
      { signal }
    )
  );
}

export interface TeamInvoiceAssessment {
  access_granted: false;
  calculation_version: number;
  covered_until: null | string;
  livemode: boolean | null;
  observed_at: string;
  package_seats: null | number;
  reason: string;
  state: 'settled' | 'unconfirmed' | 'unpaid';
  valid_until: string;
}
export interface TeamCheckoutStatus {
  checkout_available: false;
  disposition:
    | 'awaiting_verification'
    | 'bound'
    | 'expired'
    | 'owner_changed'
    | 'pending'
    | 'recovery_required'
    | 'session_open';
  invoice_assessment?: null | TeamInvoiceAssessment;
  last_error_code: null | string;
  lookup_only: boolean;
  observed_at: null | string;
  operation_id: string;
  payment_verified: false;
  quote_id: string;
  retry_at: string;
  revision: number;
  test_checkout_destination_available?: boolean;
}
export async function getTeamCheckout(org: string, signal?: AbortSignal) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<null | TeamCheckoutStatus>>(
      `/organizations/${org}/billing/checkout`,
      { signal }
    )
  );
}
export async function recoverTeamCheckout(org: string, operation: string, revision: number) {
  await wakaclockV2Client.post(`/organizations/${org}/billing/checkout/recover`, {
    operation_id: operation,
    expected_revision: revision,
    confirm: true,
  });
}

export async function confirmTeamTestCheckout(org: string, quote: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamCheckoutStatus>>(
      `/organizations/${org}/billing/checkout`,
      { quote_id: quote, confirm: true }
    )
  );
}

export interface TeamCheckoutDestination {
  expires_at: string;
  observed_at: string;
  operation_id: string;
  url: string;
}
export async function getTeamCheckoutDestination(org: string, operation: string, revision: number) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamCheckoutDestination>>(
      `/organizations/${org}/billing/checkout/destination`,
      { operation_id: operation, expected_revision: revision, confirm: true }
    )
  );
}
