import { unwrapV2, wakaclockV2Client } from './client-v2';
import type { V2Envelope } from './types';

export interface TeamTrialStatus {
  disposition:
    | 'not_started'
    | 'active'
    | 'expired'
    | 'subscription_managed'
    | 'recovery_required'
    | 'unconfirmed';
  package_seats: number | null;
  developer_seats: number;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  entitlement_revision: number | null;
  observed_at: string;
  can_start: boolean;
  recovery: { transition_id: string; expected_revision: number } | null;
  reason: string | null;
  analytics_status: string;
  analytics_reason: string;
  trial_days: number;
  packages: number[];
  payment_card_required: false;
  personal_capture_affected: false;
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
