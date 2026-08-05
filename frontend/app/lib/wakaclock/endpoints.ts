import { wakaclockClient } from './client';

import type {
  AiStatsResponse,
  AllTimeResponse,
  AuthResponse,
  DeleteResponse,
  DurationsResponse,
  GenerateApiKeyResponse,
  HeartbeatListResponse,
  HeartbeatPayload,
  HeartbeatResponse,
  InsightsResponse,
  InsightType,
  KeystrokeStatsResponse,
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
