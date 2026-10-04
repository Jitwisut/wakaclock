import type { PresenceHeatmapData } from '@/lib/presence/presence-heatmap';

import { unwrapV2, wakaclockV2Client } from './client-v2';

import type {
  AcceptedOrganizationInvite,
  DeliveryStatusResponse,
  MeasurementQuality,
  MeasurementRepairCandidate,
  MeasurementRepairJob,
  OperationEvidencePage,
  Organization,
  OrganizationAnalytics,
  OrganizationAnalyticsSharing,
  OrganizationInviteRole,
  OrganizationMember,
  OrganizationSeatType,
  OrganizationTeam,
  OrganizationTeamMember,
  OrganizationUserInvite,
  TeamRole,
  WakaTimeImportChunkPreview,
  WakaTimeImportJob,
} from './measurement-types';
import type {
  CreateGoalPayload,
  CreateLeaderboardPayload,
  Goal,
  GoalProgress,
  Leaderboard,
  LeaderboardMember,
  PresenceHistoryData,
  PresenceStatusMessage,
  PresenceSummaryData,
  PresenceV2Invite,
  PresenceV2Room,
  PresenceV2RoomData,
  PresenceV2Snapshot,
  PresenceV2Ticket,
  V2Capabilities,
  V2Envelope,
} from './types';

/**
 * API v2 endpoints, kept separate from `endpoints.ts` because they answer on a different
 * base path and in a different response shape. Endpoints declare their own runtime
 * dependencies through `/capabilities`; import jobs and organization state need PostgreSQL.
 */

// GET /capabilities
export async function getCapabilities() {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<V2Capabilities>>('/capabilities'));
}

export async function getMeasurementQuality(
  start: string,
  end: string,
  timezone: string,
  projectId?: string
) {
  const params = new URLSearchParams({ start, end, timezone });
  if (projectId) params.set('project_id', projectId);
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<MeasurementQuality>>(
      `/me/measurement-quality?${params.toString()}`
    )
  );
}

export async function getOperationEvidence(
  start: string,
  end: string,
  timezone: string,
  options: { cursor?: string; limit?: number; projectId?: string } = {}
) {
  const params = new URLSearchParams({ start, end, timezone });
  if (options.projectId) params.set('project_id', options.projectId);
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit) params.set('limit', String(options.limit));
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OperationEvidencePage>>(
      `/me/ai/operation-evidence?${params.toString()}`
    )
  );
}

export async function getDeliveryStatus() {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<DeliveryStatusResponse>>('/me/delivery-status')
  );
}

export async function startMeasurementRepair(input: {
  candidates: MeasurementRepairCandidate[];
  end: string;
  repairId: string;
  start: string;
  timezone: string;
}) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<MeasurementRepairJob>>('/me/measurement-repairs', {
      repair_id: input.repairId,
      start: input.start,
      end: input.end,
      timezone: input.timezone,
      candidates: input.candidates,
    })
  );
}

export async function listMeasurementRepairs() {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<MeasurementRepairJob[]>>('/me/measurement-repairs')
  );
}

export async function applyMeasurementRepair(repairId: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<MeasurementRepairJob>>(
      `/me/measurement-repairs/${repairId}/apply`
    )
  );
}

export async function rollbackMeasurementRepair(repairId: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<MeasurementRepairJob>>(
      `/me/measurement-repairs/${repairId}/rollback`
    )
  );
}

export async function listOrganizations() {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<Organization[]>>('/organizations'));
}

export async function createOrganization(name: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<Organization>>('/organizations', { name })
  );
}

export async function getOrganizationAnalytics(
  organizationId: string,
  start: string,
  end: string,
  timezone: string
) {
  const params = new URLSearchParams({ start, end, timezone });
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationAnalytics>>(
      `/organizations/${organizationId}/analytics?${params.toString()}`
    )
  );
}

export async function getOrganizationSharing(organizationId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationAnalyticsSharing>>(
      `/organizations/${organizationId}/me/sharing`
    )
  );
}

export async function updateOrganizationSharing(
  organizationId: string,
  sharing: OrganizationAnalyticsSharing
) {
  return unwrapV2(
    await wakaclockV2Client.put<V2Envelope<OrganizationAnalyticsSharing>>(
      `/organizations/${organizationId}/me/sharing`,
      sharing
    )
  );
}

// GET /organizations/:id/teams
export async function listOrganizationTeams(organizationId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationTeam[]>>(
      `/organizations/${organizationId}/teams`
    )
  );
}

// POST /organizations/:id/teams — admins only; the creator becomes the team lead.
export async function createOrganizationTeam(organizationId: string, name: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<OrganizationTeam>>(
      `/organizations/${organizationId}/teams`,
      { name }
    )
  );
}

// GET /organizations/:id/members — admins only.
export async function listOrganizationMembers(organizationId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationMember[]>>(
      `/organizations/${organizationId}/members`
    )
  );
}

// POST /organizations/:id/invites — admins invite an existing account by username.
export async function inviteOrganizationMember(
  organizationId: string,
  username: string,
  role: OrganizationInviteRole,
  seatType: OrganizationSeatType
) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<OrganizationUserInvite>>(
      `/organizations/${organizationId}/invites`,
      { role, seat_type: seatType, username }
    )
  );
}

// GET /organizations/:id/invites — open invites; admins only.
export async function listOrganizationInvites(organizationId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationUserInvite[]>>(
      `/organizations/${organizationId}/invites`
    )
  );
}

// DELETE /organizations/:id/invites/:inviteId
export async function revokeOrganizationInvite(organizationId: string, inviteId: string) {
  await wakaclockV2Client.delete(`/organizations/${organizationId}/invites/${inviteId}`);
}

// GET /me/organization-invites — invites waiting for you.
export async function listMyOrganizationInvites() {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationUserInvite[]>>('/me/organization-invites')
  );
}

// POST /me/organization-invites/:inviteId/accept — joins the organization.
export async function acceptOrganizationInvite(inviteId: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<AcceptedOrganizationInvite>>(
      `/me/organization-invites/${inviteId}/accept`
    )
  );
}

// POST /me/organization-invites/:inviteId/decline
export async function declineOrganizationInvite(inviteId: string) {
  await wakaclockV2Client.post(`/me/organization-invites/${inviteId}/decline`);
}

// GET /organizations/:id/teams/:teamId/members
export async function listTeamMembers(organizationId: string, teamId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OrganizationTeamMember[]>>(
      `/organizations/${organizationId}/teams/${teamId}/members`
    )
  );
}

// POST /organizations/:id/teams/:teamId/members — also changes an existing member's role.
export async function addTeamMember(
  organizationId: string,
  teamId: string,
  userId: string,
  role: TeamRole
) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<OrganizationTeamMember>>(
      `/organizations/${organizationId}/teams/${teamId}/members`,
      { role, user_id: userId }
    )
  );
}

// DELETE /organizations/:id/teams/:teamId/members/:userId
export async function removeTeamMember(organizationId: string, teamId: string, userId: string) {
  await wakaclockV2Client.delete(
    `/organizations/${organizationId}/teams/${teamId}/members/${userId}`
  );
}

export async function startWakaTimeImport(importId: string, totalChunks: number) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<WakaTimeImportJob>>(
      '/imports/wakatime',
      { import_id: importId, total_chunks: totalChunks },
      { timeout: 60_000 }
    )
  );
}

export async function getWakaTimeImport(importId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<WakaTimeImportJob>>(`/imports/wakatime/${importId}`)
  );
}

export async function previewWakaTimeImportChunk(
  importId: string,
  index: number,
  dumpJson: string
) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<WakaTimeImportChunkPreview>>(
      `/imports/wakatime/${importId}/chunks/${index}/preview`,
      { dump_json: dumpJson },
      { timeout: 60_000 }
    )
  );
}

export async function uploadWakaTimeImportChunk(
  importId: string,
  index: number,
  dumpJson: string,
  confirmLegacyAmbiguity = false
) {
  return unwrapV2(
    await wakaclockV2Client.put<V2Envelope<WakaTimeImportJob>>(
      `/imports/wakatime/${importId}/chunks/${index}`,
      { dump_json: dumpJson, confirm_legacy_ambiguity: confirmLegacyAmbiguity },
      { timeout: 60_000 }
    )
  );
}

export async function completeWakaTimeImport(importId: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<WakaTimeImportJob>>(
      `/imports/wakatime/${importId}/complete`,
      undefined,
      { timeout: 60_000 }
    )
  );
}

// GET /me/goals
export async function listGoals() {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<Goal[]>>('/me/goals'));
}

// POST /me/goals
export async function createGoal(payload: CreateGoalPayload) {
  return unwrapV2(await wakaclockV2Client.post<V2Envelope<Goal>>('/me/goals', payload));
}

// PATCH /me/goals/:goal_id
export async function updateGoal(goalId: string, payload: Partial<CreateGoalPayload>) {
  return unwrapV2(await wakaclockV2Client.patch<V2Envelope<Goal>>(`/me/goals/${goalId}`, payload));
}

// DELETE /me/goals/:goal_id
export async function deleteGoal(goalId: string) {
  await wakaclockV2Client.delete(`/me/goals/${goalId}`);
}

// GET /me/goals/:goal_id/progress
export async function getGoalProgress(goalId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GoalProgress>>(`/me/goals/${goalId}/progress`)
  );
}

// GET /leaderboards
export async function listLeaderboards() {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<Leaderboard[]>>('/leaderboards'));
}

// POST /leaderboards
export async function createLeaderboard(payload: CreateLeaderboardPayload) {
  return unwrapV2(await wakaclockV2Client.post<V2Envelope<Leaderboard>>('/leaderboards', payload));
}

// GET /leaderboards/:leaderboard_id/members
export async function listLeaderboardMembers(leaderboardId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<LeaderboardMember[]>>(
      `/leaderboards/${leaderboardId}/members`
    )
  );
}

// POST /leaderboards/:leaderboard_id/members
export async function addLeaderboardMember(leaderboardId: string, userId: string) {
  await wakaclockV2Client.post(`/leaderboards/${leaderboardId}/members`, { user_id: userId });
}

// DELETE /leaderboards/:leaderboard_id/members/:member_user_id
export async function removeLeaderboardMember(leaderboardId: string, memberUserId: string) {
  await wakaclockV2Client.delete(`/leaderboards/${leaderboardId}/members/${memberUserId}`);
}

// ---------------------------------------------------------------------------
// Presence v2 — all normal responses use the v2 envelope. The SSE stream is the
// one deliberate exception because EventSource consumes a long-lived raw stream.
// ---------------------------------------------------------------------------

export async function listPresenceRooms() {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<PresenceV2Room[]>>('/me/presence/rooms'));
}

export async function createPresenceRoomV2(name: string, expiresInSeconds = 86_400) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<PresenceV2RoomData>>('/presence/rooms', {
      name,
      expires_in_seconds: expiresInSeconds,
    })
  );
}

export async function getPresenceRoomV2(roomId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<PresenceV2RoomData>>(`/presence/rooms/${roomId}`)
  );
}

export async function resolvePresenceInviteV2(token: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<PresenceV2RoomData>>('/presence/invites/resolve', {
      token,
    })
  );
}

export async function joinPresenceRoomV2(
  roomId: string,
  inviteToken?: string,
  clientId?: null | string
) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<PresenceV2Snapshot>>(`/presence/rooms/${roomId}/join`, {
      ...(inviteToken ? { invite_token: inviteToken } : {}),
      ...(clientId ? { client_id: clientId } : {}),
    })
  );
}

export async function leavePresenceRoomV2(roomId: string) {
  await wakaclockV2Client.post(`/presence/rooms/${roomId}/leave`);
}

export async function endPresenceRoomV2(roomId: string) {
  await wakaclockV2Client.post(`/presence/rooms/${roomId}/end`);
}

export async function updatePresenceMemberV2(
  roomId: string,
  payload: {
    client_id?: null | string;
    client_seq: number;
    position: { x: number; y: number };
    zone_id: null | string;
  }
) {
  return unwrapV2(
    await wakaclockV2Client.put<V2Envelope<PresenceV2Snapshot>>(
      `/presence/rooms/${roomId}/me`,
      payload
    )
  );
}

export async function createPresenceStreamTicketV2(roomId: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<PresenceV2Ticket>>(
      `/presence/rooms/${roomId}/stream-ticket`
    )
  );
}

export function presenceStreamUrlV2(roomId: string, ticket: string) {
  return `${wakaclockV2Client.defaults.baseURL}/presence/rooms/${roomId}/stream?ticket=${encodeURIComponent(ticket)}`;
}

export async function createPresenceInviteV2(roomId: string, expiresInSeconds = 86_400) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<PresenceV2Invite>>(
      `/presence/rooms/${roomId}/invites`,
      { expires_in_seconds: expiresInSeconds }
    )
  );
}

export async function listPresenceInvitesV2(roomId: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<PresenceV2Invite[]>>(`/presence/rooms/${roomId}/invites`)
  );
}

export async function revokePresenceInviteV2(roomId: string, inviteId: string) {
  await wakaclockV2Client.delete(`/presence/rooms/${roomId}/invites/${inviteId}`);
}

// GET /me/presence/status — your own status message, or null.
export async function getMyPresenceStatusV2() {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<null | PresenceStatusMessage>>('/me/presence/status')
  );
}

// PUT /me/presence/status — shown only in rooms you are in; always expires.
export async function setMyPresenceStatusV2(
  text: string,
  emoji: null | string,
  expiresInSeconds: number
) {
  return unwrapV2(
    await wakaclockV2Client.put<V2Envelope<null | PresenceStatusMessage>>('/me/presence/status', {
      emoji,
      expires_in_seconds: expiresInSeconds,
      text,
    })
  );
}

// DELETE /me/presence/status
export async function clearMyPresenceStatusV2() {
  await wakaclockV2Client.delete('/me/presence/status');
}

// GET /organizations/:id/presence/heatmap?from=&to=&timezone= — aggregate only.
export async function getOrganizationPresenceHeatmapV2(
  organizationId: string,
  params: { from: string; timezone: string; to: string }
) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<PresenceHeatmapData>>(
      `/organizations/${organizationId}/presence/heatmap`,
      { params }
    )
  );
}

// GET /me/presence/focus — your focus block, or null.
export async function getMyPresenceFocusV2() {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<{ until: number } | null>>('/me/presence/focus')
  );
}

// PUT /me/presence/focus — roommates see "focusing until …"; ends by itself.
export async function startMyPresenceFocusV2(durationSeconds: number) {
  return unwrapV2(
    await wakaclockV2Client.put<V2Envelope<{ until: number } | null>>('/me/presence/focus', {
      duration_seconds: durationSeconds,
    })
  );
}

// DELETE /me/presence/focus
export async function endMyPresenceFocusV2() {
  await wakaclockV2Client.delete('/me/presence/focus');
}

export async function listCoworkingHistoryV2(params?: {
  cursor?: string;
  from?: string;
  limit?: number;
  timezone?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.timezone) search.set('timezone', params.timezone);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<PresenceHistoryData>>(`/me/coworking-sessions${suffix}`)
  );
}

export async function getPresenceSummaryV2(
  organizationId: string,
  params?: { from?: string; teamId?: string; timezone?: string; to?: string }
) {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.teamId) search.set('team_id', params.teamId);
  if (params?.timezone) search.set('timezone', params.timezone);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<PresenceSummaryData>>(
      `/organizations/${organizationId}/presence/summary${suffix}`
    )
  );
}
