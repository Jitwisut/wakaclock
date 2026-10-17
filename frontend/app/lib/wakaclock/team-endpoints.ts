import { unwrapV2, wakaclockV2Client } from './client-v2';

import type {
  TeamConsent,
  TeamInsights,
  TeamMeasurementHealth,
  TeamWeeklyComparison,
  TeamWorkItem,
  WorkReceipt,
} from './team-types';
import type { V2Envelope } from './types';

export async function getTeamConsent(organizationId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamConsent>>(
      `/organizations/${organizationId}/me/consent`
    )
  );
}

export async function getTeamInsights(
  organizationId: string,
  start: string,
  end: string,
  timezone: string,
  teamId?: string
) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamInsights>>(
      `/organizations/${organizationId}/insights`,
      { params: { start, end, timezone, team_id: teamId } }
    )
  );
}

export async function getTeamWorkItems(organizationId: string, teamId?: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamWorkItem[]>>(
      `/organizations/${organizationId}/work-items`,
      { params: { team_id: teamId } }
    )
  );
}

export async function getTeamWorkReceipt(
  organizationId: string,
  repositoryId: string,
  workItemId: number,
  teamId?: string
) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<WorkReceipt>>(
      `/organizations/${organizationId}/work-items/${repositoryId}/${workItemId}/receipt`,
      { params: { team_id: teamId } }
    )
  );
}

export async function exportTeamInsights(
  organizationId: string,
  start: string,
  end: string,
  timezone: string,
  teamId?: string
) {
  const response = await wakaclockV2Client.get<string>(
    `/organizations/${organizationId}/exports/team.csv`,
    { params: { start, end, timezone, team_id: teamId }, responseType: 'text' }
  );
  return response.data;
}

export async function getTeamMeasurementHealth(organizationId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamMeasurementHealth>>(
      `/organizations/${organizationId}/measurement-health`
    )
  );
}

export async function getTeamWeeklyComparison(
  org: string,
  family: 'copilot' | 'team_cost',
  baselineWeek: string,
  followupWeek: string,
  timezone: string,
  teamId?: string
) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamWeeklyComparison>>(
      `/organizations/${org}/reports/comparison`,
      {
        params: {
          family,
          baseline_week: baselineWeek,
          followup_week: followupWeek,
          timezone,
          team_id: teamId,
        },
      }
    )
  );
}
