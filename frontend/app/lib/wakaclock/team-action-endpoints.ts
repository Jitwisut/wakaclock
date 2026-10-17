import { unwrapV2, wakaclockV2Client } from './client-v2';

import type {
  TeamAction,
  TeamActionComparison,
  TeamActionEdit,
  TeamActionHistory,
  TeamActionPage,
} from './team-action-types';
import type { V2Envelope } from './types';

const path = (org: string) => `/organizations/${org}/improvement-actions`;
export async function getTeamActions(org: string, team?: string, after?: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamActionPage>>(path(org), {
      params: { team_id: team, after },
    })
  );
}
export async function saveTeamAction(
  org: string,
  id: string,
  team: string | undefined,
  edit: TeamActionEdit
) {
  return unwrapV2(
    edit.expected_revision === 0
      ? await wakaclockV2Client.post<V2Envelope<TeamAction>>(path(org), {
          id,
          team_id: team ?? null,
          edit,
        })
      : await wakaclockV2Client.put<V2Envelope<TeamAction>>(`${path(org)}/${id}`, edit, {
          params: { team_id: team },
        })
  );
}
export async function deleteTeamAction(org: string, a: TeamAction, requestId: string) {
  return unwrapV2(
    await wakaclockV2Client.delete<V2Envelope<{ deleted: true; id: string; revision: number }>>(
      `${path(org)}/${a.id}`,
      {
        params: { team_id: a.team_id ?? undefined },
        data: { request_id: requestId, expected_revision: a.revision },
      }
    )
  );
}
export async function getTeamActionHistory(
  org: string,
  id: string,
  team?: string,
  before?: number
) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamActionHistory>>(`${path(org)}/${id}/history`, {
      params: { team_id: team, before_revision: before },
    })
  );
}
export async function getTeamActionComparison(org: string, id: string, team?: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<TeamActionComparison>>(`${path(org)}/${id}/comparison`, {
      params: { team_id: team },
    })
  );
}
