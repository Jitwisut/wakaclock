import { unwrapV2, wakaclockV2Client } from './client-v2';

import type {
  CreateGoalPayload,
  CreateLeaderboardPayload,
  Goal,
  GoalProgress,
  Leaderboard,
  LeaderboardMember,
  PresenceHistoryData,
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
 * base path and in a different response shape. Everything here is Postgres-backed and is
 * unavailable when the server runs in ClickHouse-only mode — see `useCapabilities`.
 */

// GET /capabilities
export async function getCapabilities() {
  return unwrapV2(await wakaclockV2Client.get<V2Envelope<V2Capabilities>>('/capabilities'));
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
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<PresenceV2Room[]>>('/me/presence/rooms')
  );
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
    await wakaclockV2Client.post<V2Envelope<PresenceV2Snapshot>>(
      `/presence/rooms/${roomId}/join`,
      {
        ...(inviteToken ? { invite_token: inviteToken } : {}),
        ...(clientId ? { client_id: clientId } : {}),
      }
    )
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
    await wakaclockV2Client.get<V2Envelope<PresenceV2Invite[]>>(
      `/presence/rooms/${roomId}/invites`
    )
  );
}

export async function revokePresenceInviteV2(roomId: string, inviteId: string) {
  await wakaclockV2Client.delete(`/presence/rooms/${roomId}/invites/${inviteId}`);
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
    await wakaclockV2Client.get<V2Envelope<PresenceHistoryData>>(
      `/me/coworking-sessions${suffix}`
    )
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
