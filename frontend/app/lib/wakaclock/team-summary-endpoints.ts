import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { TeamSummaryQuery, TeamWeeklySummary } from './team-summary-types';
import type { V2Envelope } from './types';

const path = (org: string) => `/organizations/${org}/reports/weekly-summary`;
export async function getTeamWeeklySummary(org: string, params: TeamSummaryQuery) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamWeeklySummary>>(path(org), { params })
  );
}
/** Full matching action export. Server rejects cursors and cancels on a changed projection. */
export async function exportTeamWeeklySummary(
  org: string,
  params: Omit<TeamSummaryQuery, 'actions_after'>,
  signal: AbortSignal
) {
  const response = await wakaclockV2Client.get<string>(`${path(org)}/export`, {
    params,
    signal,
    responseType: 'text',
  });
  return response.data;
}
