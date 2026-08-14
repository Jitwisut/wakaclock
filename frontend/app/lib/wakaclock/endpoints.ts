import { wakaclockClient } from './client';
import { getCurrentToken } from './session';

import type {
  AiStatsResponse,
  AllTimeResponse,
  AuthResponse,
  CreatePresenceRoomResponse,
  CurrentApiKeyResponse,
  DeleteResponse,
  DurationsResponse,
  GenerateApiKeyResponse,
  HeartbeatListResponse,
  HeartbeatPayload,
  HeartbeatResponse,
  InsightsResponse,
  InsightType,
  KeystrokeStatsResponse,
  OrgResponse,
  OrgsResponse,
  PresenceActionResponse,
  ProjectMergeMutationResponse,
  ProjectMergesResponse,
  ProjectRuleMutationResponse,
  ProjectRulesResponse,
  ProjectsResponse,
  ReprocessResponse,
  RevokeApiKeyResponse,
  StatsRange,
  StatsResponse,
  StatusBarResponse,
  SummariesResponse,
  TeamResponse,
  TeamsResponse,
  UpsertProjectMergePayload,
  UpsertProjectRulePayload,
  UserResponse,
  WakaTimeImportResponse,
} from './types';

// POST /auth/register
export async function registerAccount(username: string, password: string) {
  const { data } = await wakaclockClient.post<AuthResponse>('/auth/register', {
    username,
    password,
  });
  return data;
}

// POST /auth/login
export async function loginAccount(username: string, password: string) {
  const { data } = await wakaclockClient.post<AuthResponse>('/auth/login', {
    username,
    password,
  });
  return data;
}

// GET /status_bar/today — no query params; user_id comes from the session/API key
// header attached automatically by the axios interceptor in client.ts
export async function getStatusBar() {
  const { data } = await wakaclockClient.get<StatusBarResponse>('/status_bar/today');
  return data;
}

// GET /all_time_since_today
export async function getAllTime(userId: string) {
  const { data } = await wakaclockClient.get<AllTimeResponse>('/all_time_since_today', {
    params: { user_id: userId },
  });
  return data;
}

// GET /stats/:range
export async function getStats(userId: string, range: StatsRange) {
  const { data } = await wakaclockClient.get<StatsResponse>(`/stats/${range}`, {
    params: { user_id: userId },
  });
  return data;
}

// GET /summaries?start=&end=
export async function getSummaries(userId: string, start: string, end: string) {
  const { data } = await wakaclockClient.get<SummariesResponse>('/summaries', {
    params: { user_id: userId, start, end },
  });
  return data;
}

// GET /durations?date=&user_id=
export async function getDurations(userId: string, date: string) {
  const { data } = await wakaclockClient.get<DurationsResponse>('/durations', {
    params: { user_id: userId, date },
  });
  return data;
}

// GET /projects?start=&end= — applies project_merges at read time
export async function getProjects(userId: string, start: string, end: string) {
  const { data } = await wakaclockClient.get<ProjectsResponse>('/projects', {
    params: { user_id: userId, start, end },
  });
  return data;
}

// GET /insights/:type/:range
export async function getInsights(userId: string, type: InsightType, range: StatsRange) {
  const { data } = await wakaclockClient.get<InsightsResponse>(`/insights/${type}/${range}`, {
    params: { user_id: userId },
  });
  return data;
}

// GET /users/current/ai_stats?start=&end=
export async function getAiStats(userId: string, start: string, end: string) {
  const { data } = await wakaclockClient.get<AiStatsResponse>('/users/current/ai_stats', {
    params: { user_id: userId, start, end },
  });
  return data;
}

// GET /users/current/keystroke_stats?start=&end=
export async function getKeystrokeStats(userId: string, start: string, end: string) {
  const { data } = await wakaclockClient.get<KeystrokeStatsResponse>(
    '/users/current/keystroke_stats',
    { params: { user_id: userId, start, end } }
  );
  return data;
}

// GET /users/current?user_id= — synthesized if the row doesn't exist yet
export async function getCurrentUser(userId: string) {
  const { data } = await wakaclockClient.get<UserResponse>('/users/current', {
    params: { user_id: userId },
  });
  return data;
}

// POST /users/current/api_key — requires a logged-in session; user_id comes from that
// session (Authorization header, attached automatically), not a query param. Plaintext
// key returned once, never again.
// GET /users/current/api_key — the key in retrievable form, so the dashboard can show
// it whenever it's needed rather than only right after it was created.
export async function getCurrentApiKey() {
  const { data } = await wakaclockClient.get<CurrentApiKeyResponse>('/users/current/api_key');
  return data;
}

export async function generateApiKey() {
  const { data } = await wakaclockClient.post<GenerateApiKeyResponse>('/users/current/api_key');
  return data;
}

// DELETE /users/current/api_key — same session requirement as generate.
export async function revokeApiKey() {
  const { data } = await wakaclockClient.delete<RevokeApiKeyResponse>('/users/current/api_key');
  return data;
}

// GET /heartbeats?date=&user_id=
export async function getHeartbeats(userId: string, date: string) {
  const { data } = await wakaclockClient.get<HeartbeatListResponse>('/heartbeats', {
    params: { user_id: userId, date },
  });
  return data;
}

// POST /heartbeats — single
export async function sendHeartbeat(payload: HeartbeatPayload) {
  const { data } = await wakaclockClient.post<HeartbeatResponse>('/heartbeats', payload);
  return data;
}

// POST /heartbeats.bulk — user_id is taken from the FIRST element only by the backend
export async function sendHeartbeatsBulk(payloads: HeartbeatPayload[]) {
  const { data } = await wakaclockClient.post<HeartbeatResponse>('/heartbeats.bulk', payloads);
  return data;
}

// ---------------------------------------------------------------------------
// Presence (plan.md Phase 7) — prototype, see types.ts for what that means.
// ---------------------------------------------------------------------------

// POST /presence/rooms — teamId, when given, must be a team the caller already belongs
// to; the server looks up and stores its real name, it is never sent as free text.
export async function createPresenceRoom(teamId?: string) {
  const { data } = await wakaclockClient.post<CreatePresenceRoomResponse>(
    '/presence/rooms',
    teamId ? { team_id: teamId } : undefined
  );
  return data;
}

// POST /presence/rooms/:roomId/join
export async function joinPresenceRoom(roomId: string) {
  const { data } = await wakaclockClient.post<PresenceActionResponse>(
    `/presence/rooms/${roomId}/join`
  );
  return data;
}

// POST /presence/rooms/:roomId/leave — also ends/shrinks any co-working session this
// user was part of in the room (handled server-side).
export async function leavePresenceRoom(roomId: string) {
  const { data } = await wakaclockClient.post<PresenceActionResponse>(
    `/presence/rooms/${roomId}/leave`
  );
  return data;
}

// POST /presence/rooms/:roomId/position — call on drag END only, not per pointer-move
// frame. This is what makes the canvas a genuinely shared view: every viewer's SSE
// stream reflects it, not just the browser that did the dragging.
export async function updatePresencePosition(roomId: string, x: number, y: number) {
  const { data } = await wakaclockClient.post<PresenceActionResponse>(
    `/presence/rooms/${roomId}/position`,
    { x, y }
  );
  return data;
}

// POST /presence/rooms/:roomId/sessions — reports "I am now close to this person" (plan.md
// 7.4). No session id is ever chosen by the client; the server infers whether this
// extends an existing group session or starts a new one.
export async function startOrJoinSession(roomId: string, withUserId: string) {
  const { data } = await wakaclockClient.post<PresenceActionResponse>(
    `/presence/rooms/${roomId}/sessions`,
    { with_user_id: withUserId }
  );
  return data;
}

// POST /presence/rooms/:roomId/sessions/leave — called after the 3-minute drag-apart
// grace period elapses with no reunion. Ends the caller's own session participation;
// staying in the room itself is unaffected.
export async function leaveSession(roomId: string) {
  const { data } = await wakaclockClient.post<PresenceActionResponse>(
    `/presence/rooms/${roomId}/sessions/leave`
  );
  return data;
}

/**
 * GET /presence/rooms/:roomId/stream — not called through `wakaclockClient` because
 * it's a long-lived SSE connection, not a request/response call. The browser's native
 * `EventSource` cannot set an `Authorization` header, so the session token travels as a
 * query parameter instead; the server accepts this only on this one endpoint (see
 * `auth::resolve_user_id_from_token` on the backend).
 *
 * Returns `null` if there is no current session — callers should not open a connection
 * without one.
 */
export function presenceStreamUrl(roomId: string): null | string {
  const token = getCurrentToken();
  if (!token) return null;

  const base = wakaclockClient.defaults.baseURL;
  return `${base}/presence/rooms/${roomId}/stream?token=${encodeURIComponent(token)}`;
}

// GET /project_rules?user_id= — user_id REQUIRED (400 if omitted)
export async function getProjectRules(userId: string) {
  const { data } = await wakaclockClient.get<ProjectRulesResponse>('/project_rules', {
    params: { user_id: userId },
  });
  return data;
}

// PUT /project_rules/:rule_id
export async function upsertProjectRule(ruleId: string, payload: UpsertProjectRulePayload) {
  const { data } = await wakaclockClient.put<ProjectRuleMutationResponse>(
    `/project_rules/${ruleId}`,
    payload
  );
  return data;
}

// DELETE /project_rules/:rule_id?user_id=
export async function deleteProjectRule(ruleId: string, userId: string) {
  const { data } = await wakaclockClient.delete<DeleteResponse>(`/project_rules/${ruleId}`, {
    params: { user_id: userId },
  });
  return data;
}

// GET /project_merges?user_id= — user_id REQUIRED (400 if omitted)
export async function getProjectMerges(userId: string) {
  const { data } = await wakaclockClient.get<ProjectMergesResponse>('/project_merges', {
    params: { user_id: userId },
  });
  return data;
}

// PUT /project_merges/:merge_id
export async function upsertProjectMerge(mergeId: string, payload: UpsertProjectMergePayload) {
  const { data } = await wakaclockClient.put<ProjectMergeMutationResponse>(
    `/project_merges/${mergeId}`,
    payload
  );
  return data;
}

// DELETE /project_merges/:merge_id?user_id=
export async function deleteProjectMerge(mergeId: string, userId: string) {
  const { data } = await wakaclockClient.delete<DeleteResponse>(`/project_merges/${mergeId}`, {
    params: { user_id: userId },
  });
  return data;
}

// POST /reprocess — destructive: deletes + rebuilds aggregates for [start, end]
export async function reprocess(userId: string, start: string, end: string) {
  const { data } = await wakaclockClient.post<ReprocessResponse>('/reprocess', {
    user_id: userId,
    start,
    end,
  });
  return data;
}

// POST /import/wakatime — file_path is a path on the BACKEND's filesystem, not an upload
export async function importWakaTime(userId: string, filePath: string) {
  const { data } = await wakaclockClient.post<WakaTimeImportResponse>('/import/wakatime', {
    user_id: userId,
    file_path: filePath,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Orgs & teams — minimal slice, see types.ts for what this does and does not cover.
// ---------------------------------------------------------------------------

// POST /orgs — creator becomes the org's owner
export async function createOrg(name: string) {
  const { data } = await wakaclockClient.post<OrgResponse>('/orgs', { name });
  return data;
}

// GET /orgs — every org the caller belongs to
export async function listOrgs() {
  const { data } = await wakaclockClient.get<OrgsResponse>('/orgs');
  return data;
}

// POST /orgs/:orgId/teams — org owner/admin only
export async function createTeam(orgId: string, name: string) {
  const { data } = await wakaclockClient.post<TeamResponse>(`/orgs/${orgId}/teams`, { name });
  return data;
}

// GET /orgs/:orgId/teams
export async function listTeams(orgId: string) {
  const { data } = await wakaclockClient.get<TeamsResponse>(`/orgs/${orgId}/teams`);
  return data;
}

// POST /orgs/:orgId/teams/:teamId/members — org owner/admin only
export async function addTeamMember(orgId: string, teamId: string, userId: string) {
  const { data } = await wakaclockClient.post<PresenceActionResponse>(
    `/orgs/${orgId}/teams/${teamId}/members`,
    { user_id: userId }
  );
  return data;
}
