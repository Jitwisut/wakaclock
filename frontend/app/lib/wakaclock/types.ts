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

export type ActorType = 'ai_inferred' | 'ai_verified' | 'human' | 'unknown';

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
/**
 * How much of a reported total the server can show a reason for.
 *
 * `proven_seconds` is time a client actually measured; `inferred_seconds` is the
 * pause-filling the server's idle bridge adds on top to stay WakaTime-compatible, and
 * on real data it is the larger of the two. `attended + agent + other` is a second
 * partition of the same total. Both sum to the surface's `total_seconds`.
 */
export interface EvidenceSplit {
  agent_seconds: number;
  ai_coding_seconds: number;
  ai_session_seconds: number;
  attended_seconds: number;
  inferred_seconds: number;
  other_seconds: number;
  proven_seconds: number;
}

export interface StatusBarResponse {
  agent_health?: unknown;
  buffered_seconds?: number;
  confirmed_seconds?: number;
  covered_intervals?: Array<{
    end: number;
    segment_id: string;
    source: string;
    start: number;
  }>;
  discarded_seconds?: number;
  evidence?: EvidenceSplit;
  heartbeat_count: number;
  human_readable: string;
  last_heartbeat_at?: null | number;
  last_increment_seconds?: number;
  last_increment_source?: string;
  queued_seconds?: number;
  timezone?: string;
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
  categories?: StatsBreakdownItem[];
  daily_average_seconds: number;
  daily_average_text: string;
  days_included: number;
  days_with_activity: number;
  editors: StatsBreakdownItem[];
  evidence?: EvidenceSplit;
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
  evidence?: EvidenceSplit;
  heartbeats: number;
  hours: number;
  text: string;
  total_seconds: number;
}

export interface SummaryDay {
  categories?: SummaryItem[];
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
  actor_type: ActorType;
  agent: string;
  ai_lines_added: number;
  ai_lines_deleted: number;
  heartbeat_count: number;
  human_lines_added: number;
  human_lines_deleted: number;
  model?: null | string;
  provider?: null | string;
  unattributed_lines_added: number;
  unattributed_lines_deleted: number;
  unknown_lines_added: number;
  unknown_lines_deleted: number;
}

export interface AiDailyItem {
  ai_inferred_lines_added: number;
  ai_inferred_lines_deleted: number;
  ai_lines_added: number;
  ai_lines_deleted: number;
  ai_verified_lines_added: number;
  ai_verified_lines_deleted: number;
  date: string;
  heartbeat_count: number;
  human_chars_added: number;
  human_keystrokes: number;
  human_lines_added: number;
  human_lines_deleted: number;
  unattributed_lines_added: number;
  unattributed_lines_deleted: number;
  unknown_lines_added: number;
  unknown_lines_deleted: number;
}

export interface AiStatsData {
  agents: AiAgentItem[];
  ai_heartbeat_percentage: number;
  ai_inferred_heartbeat_percentage: number;
  ai_verified_heartbeat_percentage: number;
  daily: AiDailyItem[];
  human_heartbeat_percentage: number;
  total_ai_inferred_lines_added: number;
  total_ai_inferred_lines_deleted: number;
  total_ai_lines_added: number;
  total_ai_lines_deleted: number;
  total_ai_verified_lines_added: number;
  total_ai_verified_lines_deleted: number;
  total_heartbeats: number;
  total_human_chars_added: number;
  total_human_keystrokes: number;
  total_human_lines_added: number;
  total_human_lines_deleted: number;
  total_unattributed_lines_added: number;
  total_unattributed_lines_deleted: number;
  total_unknown_lines_added: number;
  total_unknown_lines_deleted: number;
  unattributed_heartbeat_percentage: number;
  unknown_heartbeat_percentage: number;
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
// The hash is used for authentication and the owning session can read the current
// plaintext key back through GET /users/current/api_key.
// ---------------------------------------------------------------------------
export interface GenerateApiKeyData {
  api_key: string;
  user_id: string;
}

/** `api_key` is null only when no retrievable key exists yet. */
// ---------------------------------------------------------------------------
// GET /dashboard/analytics — every value carries the metric it counts and the unit
// it is measured in, because the cards mix seconds, lines and currency.
// ---------------------------------------------------------------------------
export type AnalyticsMetric =
  | 'active_duration'
  | 'ai_lines_changed'
  | 'estimated_cost'
  | 'human_lines_changed'
  | 'prompt_count'
  | 'session_count'
  | 'token_count'
  | 'unattributed_lines_changed';

export type AnalyticsUnit = 'lines' | 'micro_usd' | 'prompts' | 'seconds' | 'sessions' | 'tokens';

export interface BreakdownItem {
  metric: AnalyticsMetric;
  name: string;
  percentage: number;
  text: string;
  unit: AnalyticsUnit;
  value: number;
}

export interface Breakdown {
  items: BreakdownItem[];
  metric: AnalyticsMetric;
  total: number;
  unit: AnalyticsUnit;
}

export interface PeriodComparison {
  current_seconds: number;
  direction: 'decrease' | 'increase' | 'new_activity' | 'unchanged';
  /** null when a percentage would be meaningless (zero to positive). */
  percent: null | number;
  previous_seconds: number;
}

export interface DashboardAnalyticsResponse {
  breakdowns: {
    editors: Breakdown;
    languages: Breakdown;
    machines: Breakdown;
    models: Breakdown;
    operating_systems: Breakdown;
    weekdays: Breakdown;
  };
  coverage: {
    attributed_changes: number;
    attribution_data_coverage_percent: null | number;
    attribution_percent: null | number;
    attribution_relevant_rows: number;
    attribution_status: 'complete' | 'no_activity' | 'partial';
    cost_percent: null | number;
    incomplete_attribution_rows: number;
    token_percent: null | number;
    unattributed_changes: number;
  };
  daily_attribution: Array<{
    ai_added: number;
    ai_deleted: number;
    ai_inferred_added?: number;
    ai_inferred_deleted?: number;
    ai_verified_added?: number;
    ai_verified_deleted?: number;
    date: string;
    human_added: number;
    human_deleted: number;
    unattributed_added: null | number;
    unattributed_deleted: null | number;
    unit: 'lines';
    unknown_added?: number;
    unknown_deleted?: number;
  }>;
  data_version: number;
  generated_at: string;
  range: { days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  summary: {
    active_day_average_seconds: number;
    calendar_day_average_seconds: number;
    most_active_day: { date: string; text: string; total_seconds: number } | null;
    previous_period: PeriodComparison;
    today_seconds: number;
    today_text: string;
  };
  usage: {
    estimated_spend: {
      amount_microusd: null | number;
      coverage_percent: null | number;
      currency: 'USD';
    };
    prompts: null | number;
    sessions: null | number;
    tokens: {
      cache_read: null | number;
      cache_write: null | number;
      coverage_percent: null | number;
      input: null | number;
      output: null | number;
      total: null | number;
    };
  };
}

// ---------------------------------------------------------------------------
// Phase 9 project analytics — stable project-id routes. The UI integration lands in
// PR 9.10; keeping these contracts beside the dashboard client prevents it guessing
// about absent coverage or parsing formatted strings.
// ---------------------------------------------------------------------------
export interface ProjectAnalyticsCard {
  ai: {
    changes: number;
    lines_added: number;
    lines_deleted: number;
    percentage: null | number;
  };
  ai_inferred: ProjectAnalyticsCard['ai'];
  ai_verified: ProjectAnalyticsCard['ai'];
  attribution_coverage_percent: null | number;
  estimated_spend: {
    amount_microusd: null | number;
    coverage_percent: null | number;
    currency: 'USD';
  };
  human: {
    changes: number;
    lines_added: number;
    lines_deleted: number;
    percentage: null | number;
  };
  last_activity_at: null | string;
  name: string;
  project_id: string;
  prompts: null | number;
  repository: null | string;
  sessions: null | number;
  tokens: {
    cache_read: null | number;
    cache_write: null | number;
    coverage_percent: null | number;
    input: null | number;
    output: null | number;
    total: null | number;
  };
  total_seconds: number;
  unattributed: {
    changes: number;
    lines_added: number;
    lines_deleted: number;
    percentage_of_observed: null | number;
  };
  unknown: ProjectAnalyticsCard['unattributed'];
}

export interface ProjectAnalyticsListResponse {
  data_version: number;
  generated_at: string;
  items: ProjectAnalyticsCard[];
  next_cursor: null | string;
  range: { days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  totals: { project_count: number; total_seconds: number };
}

export interface ProjectAnalyticsDetailResponse {
  ai: {
    ai_inferred_lines: number;
    ai_lines: number;
    ai_percentage: null | number;
    ai_verified_lines: number;
    attribution_coverage_percent: null | number;
    estimated_spend: ProjectAnalyticsCard['estimated_spend'];
    human_lines: number;
    prompts: null | number;
    prompts_per_session: null | number;
    sessions: null | number;
    tokens: ProjectAnalyticsCard['tokens'];
    unattributed_lines: null | number;
    unknown_lines: null | number;
  };
  branches: Array<{
    ai_changes: number;
    ai_inferred_changes: number;
    ai_verified_changes: number;
    branch: string;
    heartbeat_count: number;
    human_changes: number;
    total_seconds: number;
    unattributed_changes: null | number;
    unknown_changes: null | number;
  }>;
  daily_activity: Array<{
    ai_added: number;
    ai_deleted: number;
    ai_inferred_added: number;
    ai_inferred_deleted: number;
    ai_verified_added: number;
    ai_verified_deleted: number;
    date: string;
    human_added: number;
    human_deleted: number;
    total_seconds: number;
    unattributed_added: null | number;
    unattributed_deleted: null | number;
    unknown_added: null | number;
    unknown_deleted: null | number;
  }>;
  data_version: number;
  editors: Array<{ name: string; percentage: number; total_seconds: number }>;
  generated_at: string;
  languages: Array<{ name: string; percentage: number; total_seconds: number }>;
  project: { name: string; project_id: string; repository: null | string };
  range: { branch: string; days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  summary: {
    active_days: number;
    all_projects_seconds: number;
    last_activity_at: null | string;
    project_seconds: number;
  };
  top_files: ProjectFileItem[];
}

export interface ProjectFileItem {
  ai_changes: number;
  ai_inferred_changes: number;
  ai_verified_changes: number;
  display_name: string;
  entity_key: string;
  human_changes: number;
  language: string;
  path: string;
  percentage_of_project: number;
  total_seconds: number;
  unattributed_changes: null | number;
  unknown_changes: null | number;
}

export interface ProjectFilesResponse {
  attribution_coverage_percent: null | number;
  data_version: number;
  generated_at: string;
  items: ProjectFileItem[];
  metric: 'active_duration';
  next_cursor: null | string;
  other_seconds: number;
  project_total_seconds: number;
  range: { branch: string; days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  unit: 'seconds';
}

export interface ProjectBranchesResponse {
  attribution_coverage_percent: null | number;
  data_version: number;
  generated_at: string;
  items: ProjectAnalyticsDetailResponse['branches'];
  next_cursor: null | string;
  other_seconds: number;
  range: { branch: string; days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
}

export interface ProjectDailyResponse {
  attribution_coverage_percent: null | number;
  data_version: number;
  generated_at: string;
  items: ProjectAnalyticsDetailResponse['daily_activity'];
  range: { branch: string; days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
}

export interface ProjectAiResponse {
  data: ProjectAnalyticsDetailResponse['ai'];
  data_version: number;
  generated_at: string;
  range: { branch: string; days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
}

export interface CurrentApiKeyData {
  api_key: null | string;
  user_id: string;
}

export interface CurrentApiKeyResponse {
  data: CurrentApiKeyData;
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
  actor_confidence: number;
  actor_type: ActorType;
  ai_agent?: null | string;
  ai_confidence?: null | string;
  ai_event_fingerprint?: null | string;
  ai_event_id?: null | string;
  ai_lines_added?: null | number;
  ai_lines_deleted?: null | number;
  ai_model?: null | string;
  ai_provider?: null | string;
  ai_source?: null | string;
  ast_confidence: null | number;
  ast_language: null | string;
  branch: null | string;
  category: string;
  cursor_position: null | number;
  dependencies: string[];
  editor: string;
  entity: string;
  entity_type: string;
  human_lines_added?: null | number;
  human_lines_deleted?: null | number;
  /** Deprecated compatibility flag; derive state from actor_type instead. */
  is_ai_generated?: boolean;
  is_write: boolean;
  language: null | string;
  line_number: null | number;
  lines: null | number;
  machine: string;
  operating_system: string;
  project: null | string;
  time: number;
  unattributed_lines_added?: null | number;
  unattributed_lines_deleted?: null | number;
}

export interface HeartbeatListResponse {
  data: HeartbeatItem[];
  date: string;
  total: number;
}

export interface HeartbeatPayload {
  active_seconds?: number;
  actor_confidence?: number;
  actor_type?: ActorType;
  ai_agent?: string;
  ai_confidence?: string;
  ai_event_id?: string;
  ai_lines_added?: number;
  ai_lines_deleted?: number;
  ai_model?: string;
  ai_provider?: string;
  ai_source?: string;
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
  human_lines_added?: number;
  human_lines_deleted?: number;
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
  unattributed_lines_added?: number;
  unattributed_lines_deleted?: number;
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
  audit_id: string;
  data_version: null | number;
  dry_run: boolean;
  end: string;
  project_ids_written: number;
  reprocessed_heartbeats: number;
  resolved_heartbeats: number;
  start: string;
  unresolved_heartbeats: number;
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
// Presence (plan.md Phase 7) — prototype. Backed by an in-memory, single-process
// store on the server; does not survive a server restart. See
// backend/api/src/infrastructure/presence_store.rs for what that means.
// ---------------------------------------------------------------------------
export type PresenceState = 'coding' | 'idle' | 'offline';

export interface PresencePoint {
  x: number;
  y: number;
}

export interface PresenceRosterEntry {
  position: null | PresencePoint;
  state: PresenceState;
  user_id: string;
  username: string;
  zone_id?: null | string;
}

/** What the SSE stream at /presence/rooms/:roomId/stream delivers on every tick. */
export interface PresenceRoomSnapshot {
  roster: PresenceRosterEntry[];
  team_id: null | string;
  team_name: null | string;
}

export interface CreatePresenceRoomResponse {
  room_id: string;
}

/** Every /api/v2 response is wrapped in this. See `unwrapV2` in `client-v2.ts`. */
export interface V2Envelope<T> {
  data: T;
  meta: {
    coverage: null | unknown;
    data_freshness: string;
    generated_at: string;
    request_id: string;
    timezone: string;
  };
}

export interface V2Capabilities {
  analytics_store: string;
  api_version: string;
  postgres_enabled: boolean;
  presence_v2_available?: boolean;
  product: string;
  transactional_store: string;
}

export interface Goal {
  created_at: string;
  direction: string;
  ends_on: null | string;
  filter_kind: string;
  filter_value: null | string;
  id: string;
  metric: string;
  name: string;
  period: string;
  priority: number;
  public: boolean;
  starts_on: string;
  target_seconds: number;
  timezone: string;
  updated_at: string;
}

export interface CreateGoalPayload {
  direction: string;
  ends_on?: null | string;
  filter_kind: string;
  filter_value?: null | string;
  metric: string;
  name: string;
  period: string;
  priority?: number;
  public?: boolean;
  starts_on: string;
  target_seconds: number;
  timezone?: string;
}

export interface GoalProgress {
  /** 0 means no data covered this window — render it as unknown, never as 0%. */
  coverage: number;
  current_seconds: number;
  direction: string;
  goal_id: string;
  on_track: boolean;
  percentage: number;
  period: string;
  target_seconds: number;
}

export interface Leaderboard {
  anonymous: boolean;
  country: null | string;
  created_at: string;
  id: string;
  language: null | string;
  metric: string;
  organization_id: null | string;
  owner_user_id: null | string;
  period: string;
  visibility: string;
}

export interface CreateLeaderboardPayload {
  anonymous?: boolean;
  country?: null | string;
  language?: null | string;
  metric: string;
  organization_id?: null | string;
  period: string;
  visibility: string;
}

export interface LeaderboardMember {
  joined_at: string;
  user_id: string;
  username: string;
}

export interface PresenceStreamTicketResponse {
  expires_in_seconds: number;
  ticket: string;
}

export interface PresenceActionResponse {
  status: string;
}

// ---------------------------------------------------------------------------
// Presence v2 — durable rooms, Redis live state and collaboration zones.
// ---------------------------------------------------------------------------
export type PresenceRoomKindV2 = 'adhoc' | 'team';

export interface PresenceV2Zone {
  center_x: number;
  center_y: number;
  height: number;
  id: string;
  label: string;
  room_id: string;
  sort_order: number;
  width: number;
}

export interface PresenceV2Room {
  ended_at: null | string;
  expires_at: null | string;
  id: string;
  kind: PresenceRoomKindV2;
  name: string;
  owner_user_id?: null | string;
  team_id: null | string;
}

export interface PresenceV2RoomData extends PresenceV2Room {
  zones: PresenceV2Zone[];
}

export type PresenceV2State = 'coding' | 'idle' | 'offline';

export interface PresenceV2RosterEntry {
  position: null | PresencePoint;
  state: PresenceV2State;
  user_id: string;
  username: string;
  zone_id: null | string;
}

export interface PresenceV2SessionParticipant {
  user_id: string;
  username: string;
}

export interface PresenceV2Session {
  leaving_deadlines: Record<string, number>;
  participants: PresenceV2SessionParticipant[];
  session_id: string;
  started_at: number;
  zone_id: string;
}

export interface PresenceV2Snapshot {
  room: PresenceV2Room;
  roster: PresenceV2RosterEntry[];
  server_time: number;
  sessions: PresenceV2Session[];
  version: number;
  zones: PresenceV2Zone[];
}

export interface PresenceV2Invite {
  created_at: string;
  expires_at: string;
  id: string;
  invite_url_token?: null | string;
  revoked_at: null | string;
  room_id: string;
  used_count: number;
}

export interface PresenceV2Ticket {
  expires_in_seconds: number;
  ticket: string;
}

export interface PresenceHistoryParticipant {
  user_id: string;
  username: string;
}

export interface PresenceHistoryItem {
  duration_seconds: number;
  ended_at: null | number;
  ended_reason: string;
  participants: PresenceHistoryParticipant[];
  room_id: string;
  room_name: string;
  session_id: string;
  source: string;
  started_at: number;
  team_id: null | string;
  your_joined_at: number;
  your_left_at: null | number;
  your_projects: string[];
  zone_id: null | string;
}

export interface PresenceHistoryData {
  items: PresenceHistoryItem[];
  next_cursor: null | string;
}

export interface PresenceSummaryData {
  active_days: null | number;
  average_group_size: null | number;
  session_count: null | number;
  suppressed: boolean;
  total_collaboration_seconds: null | number;
}

// ---------------------------------------------------------------------------
// Orgs & teams — minimal slice (plan.md 6.1, scoped down), exists only so a presence
// room can carry a real, permission-checked team name instead of free text. Not
// org-scoped analytics, not billing — see backend/api/src/handlers/v1/orgs.rs.
// ---------------------------------------------------------------------------
export interface Org {
  name: string;
  org_id: string;
  owner_user_id: string;
}

export interface Team {
  name: string;
  org_id: string;
  team_id: string;
}

export interface OrgResponse {
  data: Org;
}

export interface OrgsResponse {
  data: Org[];
}

export interface TeamResponse {
  data: Team;
}

export interface TeamsResponse {
  data: Team[];
}

// ---------------------------------------------------------------------------
// Error shape — every handler returns this on failure
// ---------------------------------------------------------------------------
export interface ApiErrorBody {
  error: { code?: number; message?: string } | string;
}
