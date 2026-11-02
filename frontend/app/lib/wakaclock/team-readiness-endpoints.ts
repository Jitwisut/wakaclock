import { unwrapV2, wakaclockV2Client } from './client-v2';
import { getCurrentToken } from './session';

import type { V2Envelope } from './types';

export interface TeamEvidenceRecord {
  build: null | string;
  build_matches_current: boolean | null;
  certified: false;
  checked_at: string;
  evidence_ref: string;
  gate: string;
  metadata_status: 'recorded' | 'unconfirmed';
  reason: string;
  recorded_passed: boolean;
}
export interface TeamReadiness {
  build: null | string;
  checkout_available: false;
  evaluated_at: string;
  evidence_details?: {
    external: TeamEvidenceRecord[];
    external_certification: 'unconfirmed';
    local: TeamEvidenceRecord[];
    schema_version: number;
    unsupported_scope_present: boolean;
  };
  production_ready: false;
}

/** The shared interceptor owns Authorization. This read rejects an account
 * change before dispatch and before accepting a late response. */
export async function getTeamReadiness(org: string, expectedSession: string, signal?: AbortSignal) {
  const requireSession = () => {
    if (!expectedSession || getCurrentToken() !== expectedSession) {
      throw new Error('Readiness session changed; reopen the evidence review.');
    }
  };
  requireSession();
  const response = await wakaclockV2Client.get<V2Envelope<TeamReadiness>>(
    `/organizations/${encodeURIComponent(org)}/launch-readiness`,
    {
      signal,
      transformRequest: [
        (data, headers) => {
          requireSession();
          if (headers.get('Authorization') !== `Bearer ${expectedSession}`) {
            throw new Error('Readiness session is unconfirmed; reload.');
          }
          return data;
        },
      ],
    }
  );
  requireSession();
  return unwrapV2(response);
}
