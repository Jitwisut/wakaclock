import { unwrapV2, wakaclockV2Client } from './client-v2';

import type {
  CreateGoalPayload,
  CreateLeaderboardPayload,
  Goal,
  GoalProgress,
  Leaderboard,
  LeaderboardMember,
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
