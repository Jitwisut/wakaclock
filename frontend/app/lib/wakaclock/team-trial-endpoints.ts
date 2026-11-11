import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { V2Envelope } from './types';

export interface TeamTrialStatus {
  analytics_reason: string;
  analytics_status: string;
  can_start: boolean;
  developer_seats: number;
  disposition:
    | 'active'
    | 'expired'
    | 'not_started'
    | 'recovery_required'
    | 'subscription_managed'
    | 'unconfirmed';
  entitlement_revision: null | number;
  observed_at: string;
  package_seats: null | number;
  packages: number[];
  payment_card_required: false;
  personal_capture_affected: false;
  reason: null | string;
  recovery: { expected_revision: number; transition_id: string } | null;
  trial_days: number;
  trial_ends_at: null | string;
  trial_started_at: null | string;
}
const path = (org: string) => `/organizations/${org}/billing/trial`;
export async function getTeamTrial(org: string, signal?: AbortSignal) {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<TeamTrialStatus>>(path(org), { signal }));
}
export async function startTeamTrial(org: string, packageSeats: number) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamTrialStatus>>(path(org), {
      package_seats: packageSeats,
      confirm: true,
    })
  );
}
export async function recoverTeamTrial(org: string, transition: string, revision: number) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<TeamTrialStatus>>(`${path(org)}/recover`, {
      transition_id: transition,
      expected_revision: revision,
      confirm: true,
    })
  );
}
