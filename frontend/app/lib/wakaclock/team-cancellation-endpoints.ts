import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { V2Envelope } from './types';

export interface TeamCancellationSelection {
  confirm: true;
  expected_binding_revision: number;
  expected_period_end: string;
  expected_source_revision: number;
  operation_id: string;
}
export interface TeamCancellationStatus {
  acceptance: 'observed';
  accepted_at: string;
  authorization_current_owner: boolean;
  dispatch_available: false;
  expected_period_end: string;
  last_error_code: null | string;
  observed_at: string;
  operation_id: string;
  provider_disposition:
    | 'changed_or_unconfirmed'
    | 'effective_at_expected_boundary'
    | 'not_observed_scheduled'
    | 'provider_scheduled'
    | null;
  provider_observed_at: null | string;
  read_only: boolean;
  reason: string;
  requested_by_current_owner: boolean;
  retry_at: string;
  revision: number;
  schema_version: 1;
  state:
    | 'changed'
    | 'effective'
    | 'owner_changed'
    | 'pending'
    | 'provider_scheduled'
    | 'recovery_required'
    | 'withdrawn';
  worker_configured: boolean | null;
}
export interface TeamCancellationView {
  checked_at: string;
  operation: null | TeamCancellationStatus;
  schema_version: 1;
  selection: {
    binding_revision: number;
    confirmation_expires_at: string;
    period_end: string;
    provider_observed_at: string;
    source_revision: number;
  } | null;
}
const path = (org: string) => `/organizations/${org}/billing/cancellation`;
export async function getTeamCancellation(org: string, operation?: string, signal?: AbortSignal) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamCancellationView>>(path(org), {
      params: operation ? { operation_id: operation } : undefined,
      signal,
    })
  );
}
export async function acceptTeamCancellation(org: string, original: TeamCancellationSelection) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamCancellationStatus>>(path(org), original)
  );
}
export async function recoverTeamCancellation(org: string, operation: string, revision: number) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamCancellationStatus>>(`${path(org)}/recover`, {
      operation_id: operation,
      expected_revision: revision,
      confirm: true,
    })
  );
}
