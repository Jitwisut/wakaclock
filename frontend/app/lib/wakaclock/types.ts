/**
 * Mirrors serde structs in backend/api/src/model/*.rs.
 * IDs, timestamps: see field-level comments where the shape is non-obvious.
 */

export type EntityType = 'app' | 'domain' | 'file' | 'url';

export type Category =
  | 'building'
  | 'coding'
  | 'communicating'
  | 'debugging'
  | 'designing'
  | 'meeting'
  | 'modeling';

export type StatsRange = 'all_time' | 'last_30_days' | 'last_7_days' | 'today';

export const STATS_RANGES: StatsRange[] = ['today', 'last_7_days', 'last_30_days', 'all_time'];

export type InsightType = 'branches' | 'editors' | 'languages' | 'operating_systems' | 'projects';

export const INSIGHT_TYPES: InsightType[] = [
  'languages',
  'projects',
  'editors',
  'operating_systems',
  'branches',
];

// ---------------------------------------------------------------------------
// GET /status_bar/today
// ---------------------------------------------------------------------------
export interface StatusBarResponse {
  heartbeat_count: number;
  human_readable: string;
  total_seconds: number;
}

// ---------------------------------------------------------------------------
// GET /all_time_since_today
// ---------------------------------------------------------------------------
export interface AllTimeData {
  days_with_activity: number;
  hours: number;
  since: null | string;
  text: string;
  total_seconds: number;
}

export interface AllTimeResponse {
  data: AllTimeData;
}

// ---------------------------------------------------------------------------
// GET /stats/:range
// ---------------------------------------------------------------------------
export interface StatsBreakdownItem {
  heartbeats: number;
  hours: number;
  name: string;
  text: string;
  total_seconds: number;
}

export interface BestDay {
  date: string;
  text: string;
  total_seconds: number;
}

export interface StatsData {
  best_day: BestDay | null;
  daily_average_seconds: number;
  daily_average_text: string;
  days_included: number;
  days_with_activity: number;
  editors: StatsBreakdownItem[];
  hours: number;
  languages: StatsBreakdownItem[];
  operating_systems: StatsBreakdownItem[];
  projects: StatsBreakdownItem[];
  text: string;
  total_seconds: number;
}

export interface StatsResponse {
  data: StatsData;
  end: string;
  range: string;
  start: string;
}

// ---------------------------------------------------------------------------
// GET /summaries
// ---------------------------------------------------------------------------
export interface SummaryItem {
  heartbeats: number;
  hours: number;
  name: string;
  text: string;
  total_seconds: number;
}

export interface SummaryGrandTotal {
  heartbeats: number;
  hours: number;
  text: string;
  total_seconds: number;
}

export interface SummaryDay {
  date: string;
  editors: SummaryItem[];
  grand_total: SummaryGrandTotal;
  languages: SummaryItem[];
  operating_systems: SummaryItem[];
  projects: SummaryItem[];
}

export interface SummariesResponse {
  days: SummaryDay[];
  end: string;
  start: string;
}

// ---------------------------------------------------------------------------
// GET /durations — start/end are epoch seconds (f64)
// ---------------------------------------------------------------------------
export interface DurationBlock {
  category: string;
  duration_seconds: number;
  end: number;
  entity: string;
  heartbeat_count: number;
  language: null | string;
  project: null | string;
  start: number;
}

export interface DurationsResponse {
  data: DurationBlock[];
  date: string;
  total: number;
}

// ---------------------------------------------------------------------------
// GET /projects — the only read endpoint that applies project_merges
// ---------------------------------------------------------------------------
export interface ProjectItem {
  heartbeats: number;
  hours: number;
  name: string;
  text: string;
  total_seconds: number;
}

export interface ProjectsResponse {
  data: ProjectItem[];
  end: string;
  start: string;
}

// ---------------------------------------------------------------------------
// GET /insights/:type/:range
// ---------------------------------------------------------------------------
export interface InsightItem {
  days: number;
  heartbeats: number;
  hours: number;
  name: string;
  text: string;
  total_seconds: number;
}

export interface InsightsResponse {
  data: InsightItem[];
  end: string;
  range: string;
  start: string;
  type: string;
}

// ---------------------------------------------------------------------------
// GET /users/current/ai_stats
// ---------------------------------------------------------------------------
export interface AiAgentItem {
  agent: string;
  ai_lines_added: number;
  ai_lines_deleted: number;
  heartbeat_count: number;
}

export interface AiDailyItem {
  ai_lines_added: number;
  ai_lines_deleted: number;
  date: string;
  heartbeat_count: number;
  human_chars_added: number;
  human_keystrokes: number;
}

export interface AiStatsData {
  agents: AiAgentItem[];
  ai_heartbeat_percentage: number;
  daily: AiDailyItem[];
  total_ai_lines_added: number;
  total_ai_lines_deleted: number;
  total_heartbeats: number;
  total_human_chars_added: number;
  total_human_keystrokes: number;
}

export interface AiStatsResponse {
  data: AiStatsData;
  end: string;
  start: string;
}

// ---------------------------------------------------------------------------
// GET /users/current/keystroke_stats
// ---------------------------------------------------------------------------
export interface KeystrokeProjectItem {
  chars_added: number;
  chars_deleted: number;
  keystrokes: number;
  name: string;
}

export interface KeystrokeDailyItem {
  chars_added: number;
  chars_deleted: number;
  date: string;
  keystrokes: number;
}

export interface KeystrokeStatsData {
  daily: KeystrokeDailyItem[];
  days_with_activity: number;
  projects: KeystrokeProjectItem[];
  total_chars_added: number;
  total_chars_deleted: number;
  total_keystrokes: number;
}

export interface KeystrokeStatsResponse {
  data: KeystrokeStatsData;
  end: string;
  start: string;
}

// ---------------------------------------------------------------------------
// GET /users/current — synthesized when no row exists (email = "")
// ---------------------------------------------------------------------------
export interface UserData {
  email: string;
  id: string;
  is_active: boolean;
  subscription_period_end: null | number;
  /** Free-form — the backend doesn't enforce a fixed set of values. 'active' and
   * 'trialing' (with an unexpired trial_ends_at) are the only ones that grant access. */
  subscription_status: string;
  /** Unix seconds. Only meaningful while subscription_status === 'trialing'. */
  trial_ends_at: number;
  username: string;
}

export interface UserResponse {
  data: UserData;
}

// ---------------------------------------------------------------------------
// POST /auth/register, POST /auth/login — token is a short-lived (24h) session JWT
// ---------------------------------------------------------------------------
export interface AuthData {
  token: string;
  user_id: string;
  username: string;
}

export interface AuthResponse {
  data: AuthData;
}

// ---------------------------------------------------------------------------
// POST/DELETE /users/current/api_key — requires a logged-in session (Authorization:
// Bearer <session token>); user_id comes from that session, not from a query param.
// Plaintext key is returned exactly once, at generation time — only its hash is
// persisted server-side.
// ---------------------------------------------------------------------------
export interface GenerateApiKeyData {
  api_key: string;
  user_id: string;
}

export interface GenerateApiKeyResponse {
  data: GenerateApiKeyData;
}

export interface RevokeApiKeyResponse {
  status: string;
}

// ---------------------------------------------------------------------------
// GET /heartbeats, POST /heartbeats, POST /heartbeats.bulk
// ---------------------------------------------------------------------------
export interface HeartbeatItem {
  active_seconds: null | number;
  ast_confidence: null | number;
  ast_language: null | string;
  branch: null | string;
  category: string;
  cursor_position: null | number;
  dependencies: string[];
  editor: string;
  entity: string;
  entity_type: string;
  is_write: boolean;
  language: null | string;
  line_number: null | number;
  lines: null | number;
  machine: string;
  operating_system: string;
  project: null | string;
  time: number;
}

export interface HeartbeatListResponse {
  data: HeartbeatItem[];
  date: string;
  total: number;
}

export interface HeartbeatPayload {
  active_seconds?: number;
  ai_agent?: string;
  ai_lines_added?: number;
  ai_lines_deleted?: number;
  ast_confidence?: number;
  ast_language?: string;
  branch?: string;
  category?: Category;
  chars_added?: number;
  chars_deleted?: number;
  created_at?: string;
  cursor_position?: number;
  dependencies?: string[];
  editor?: string;
  entity: string;
  entity_type: EntityType;
  is_ai_generated?: boolean;
  is_write?: boolean;
  keystrokes?: number;
  language?: string;
  line_number?: number;
  lines?: number;
  machine?: string;
  operating_system?: string;
  project?: string;
  time: number;
  user_agent?: string;
  user_id?: string;
}

export interface HeartbeatResponse {
  heartbeats_inserted: number;
  status: string;
}

// ---------------------------------------------------------------------------
// project_rules — user_id is REQUIRED (not Option) on list/delete;
// timestamps are epoch seconds (u32), not ISO strings
// ---------------------------------------------------------------------------
export interface ProjectRuleItem {
  created_at: number;
  is_active: boolean;
  pattern: string;
  priority: number;
  project_name: string;
  rule_id: string;
  updated_at: number;
  user_id: string;
}

export interface ProjectRulesResponse {
  data: ProjectRuleItem[];
}

export interface UpsertProjectRulePayload {
  is_active?: boolean;
  pattern: string;
  priority: number;
  project_name: string;
  user_id: string;
}

export interface ProjectRuleMutationResponse {
  data: ProjectRuleItem;
  status: string;
}

// ---------------------------------------------------------------------------
// project_merges — user_id REQUIRED; only /projects applies these at read time
// ---------------------------------------------------------------------------
export interface ProjectMergeItem {
  created_at: number;
  merge_id: string;
  source_project: string;
  target_project: string;
  updated_at: number;
  user_id: string;
}

export interface ProjectMergesResponse {
  data: ProjectMergeItem[];
}

export interface UpsertProjectMergePayload {
  source_project: string;
  target_project: string;
  user_id: string;
}

export interface ProjectMergeMutationResponse {
  data: ProjectMergeItem;
  status: string;
}

export interface DeleteResponse {
  status: string;
}

// ---------------------------------------------------------------------------
// POST /reprocess — destructive: deletes + rebuilds aggregates for the range
// ---------------------------------------------------------------------------
export interface ReprocessRequest {
  end: string;
  start: string;
  user_id: string;
}

export interface ReprocessData {
  end: string;
  reprocessed_heartbeats: number;
  start: string;
  user_id: string;
}

export interface ReprocessResponse {
  data: ReprocessData;
  status: string;
}

// ---------------------------------------------------------------------------
// POST /import/wakatime — file_path is a SERVER-SIDE filesystem path, not an upload
// ---------------------------------------------------------------------------
export interface WakaTimeImportRequest {
  file_path: string;
  user_id: string;
}

export interface WakaTimeImportData {
  file_path: string;
  imported_heartbeats: number;
  skipped_heartbeats: number;
  user_id: string;
}

export interface WakaTimeImportResponse {
  data: WakaTimeImportData;
  status: string;
}

// ---------------------------------------------------------------------------
// Error shape — every handler returns this on failure
// ---------------------------------------------------------------------------
export interface ApiErrorBody {
  error: string;
}
