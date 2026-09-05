/**
 * Mirrors serde structs in backend/api/src/model/*.rs.
 * IDs, timestamps: see field-level comments where the shape is non-obvious.
 */

export type EntityType = 'app' | 'domain' | 'file' | 'url';

/** Canonical authorship state returned by the AI statistics endpoint. */
export type ActorType = 'ai_inferred' | 'ai_verified' | 'human' | 'unknown';

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
  actor_type: ActorType;
  ai_lines_added: number;
  ai_lines_deleted: number;
  heartbeat_count: number;
  human_lines_added: number;
  human_lines_deleted: number;
  unknown_lines_added: number;
  unknown_lines_deleted: number;
  unattributed_lines_added: number;
  unattributed_lines_deleted: number;
  model?: null | string;
  provider?: null | string;
}

export interface AiDailyItem {
  ai_lines_added: number;
  ai_lines_deleted: number;
  ai_verified_lines_added?: number;
  ai_verified_lines_deleted?: number;
  ai_inferred_lines_added?: number;
  ai_inferred_lines_deleted?: number;
  date: string;
  heartbeat_count: number;
  human_chars_added: number;
  human_keystrokes: number;
  human_lines_added: number;
  human_lines_deleted: number;
}

export interface AiStatsData {
  agents: AiAgentItem[];
  ai_heartbeat_percentage: number;
  ai_verified_heartbeat_percentage: number;
  ai_inferred_heartbeat_percentage: number;
  human_heartbeat_percentage: number;
  unknown_heartbeat_percentage: number;
  daily: AiDailyItem[];
  total_ai_lines_added: number;
  total_ai_lines_deleted: number;
  total_ai_verified_lines_added: number;
  total_ai_verified_lines_deleted: number;
  total_ai_inferred_lines_added: number;
  total_ai_inferred_lines_deleted: number;
  total_heartbeats: number;
  total_unknown_lines_added: number;
  total_unknown_lines_deleted: number;
  total_human_chars_added: number;
  total_human_keystrokes: number;
  total_human_lines_added: number;
  total_human_lines_deleted: number;
}

export interface AiStatsResponse {
  data: AiStatsData;
  end: string;
  start: string;
}

// ---------------------------------------------------------------------------
// GET /users/current/ai_diagnostics — local, metadata-only observer health
// ---------------------------------------------------------------------------
export type AiVerificationStatus =
  | 'installed'
  | 'live_tested'
  | 'scaffold'
  | 'unsupported'
  | 'unverified'
  | 'verified';

export interface AiDiagnosticsBroker {
  dead_letter?: number;
  inbox_dead_letter?: number;
  inbox_pending?: number;
  inbox_retry?: number;
  last_delivery_unix?: null | number;
  last_error_code?: null | string;
  pending?: number;
  retry?: number;
  running: boolean;
}

export interface AiDiagnosticsParser {
  max_lag_seconds: number;
  transcripts_behind: number;
  transcripts_watched: number;
}

export interface AiAdapterFreshness {
  agent: string;
  dead_letter_events?: number;
  detected: boolean;
  diagnostic_code?: null | string;
  enabled: boolean;
  last_delivery_result?: null | string;
  last_evidence_unix?: null | number;
  model_id?: null | string;
  pending_events?: number;
  provider_id?: null | string;
  retry_events?: number;
  transcript_lag_seconds?: null | number;
  transport?: null | string;
  verification: AiVerificationStatus;
}

/** Backward-compatible name used by the first AI diagnostics UI. */
export type AdapterFreshness = AiAdapterFreshness;

export type AiPipelineStage =
  | 'accepted_locally'
  | 'adapter_installed'
  | 'agent_detected'
  | 'correlated'
  | 'delivered'
  | 'evidence_received'
  | 'queued_for_delivery'
  | 'rejected';

export interface AiPipelineState {
  agent: string;
  entered_stage_at: string;
  history: Array<{ at: string; stage: AiPipelineStage }>;
  rejection_reason?: null | string;
  stage: AiPipelineStage;
}

export interface AiDiagnosticsReport {
  adapters: AiAdapterFreshness[];
  broker: AiDiagnosticsBroker;
  captured_at: string;
  parser: AiDiagnosticsParser;
  schema_version: number;
}

export interface AiDiagnosticsResponse {
  report: AiDiagnosticsReport | null;
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

/** `api_key` is always null on reads: plaintext keys are returned only once by POST. */
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
    attribution_percent: null | number;
    cost_percent: null | number;
    token_percent: null | number;
  };
  daily_attribution: Array<{
    ai_added: number;
    ai_deleted: number;
    date: string;
    human_added: number;
    human_deleted: number;
    unattributed_added: null | number;
    unattributed_deleted: null | number;
    unit: 'lines';
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
    ai_lines: number;
    ai_percentage: null | number;
    attribution_coverage_percent: null | number;
    estimated_spend: ProjectAnalyticsCard['estimated_spend'];
    human_lines: number;
    prompts: null | number;
    prompts_per_session: null | number;
    sessions: null | number;
    tokens: ProjectAnalyticsCard['tokens'];
    unattributed_lines: null | number;
  };
  branches: Array<{
    ai_changes: number;
    branch: string;
    heartbeat_count: number;
    human_changes: number;
    total_seconds: number;
    unattributed_changes: null | number;
  }>;
  daily_activity: Array<{
    ai_added: number;
    ai_deleted: number;
    date: string;
    human_added: number;
    human_deleted: number;
    total_seconds: number;
    unattributed_added: null | number;
    unattributed_deleted: null | number;
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
  display_name: string;
  entity_key: string;
  human_changes: number;
  language: string;
  path: string;
  percentage_of_project: number;
  total_seconds: number;
  unattributed_changes: null | number;
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
  actor_type?: string;
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
  actor_type?: string;
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
  /** Bulk only, and only when non-zero: payloads the server could not accept. */
  heartbeats_rejected?: number;
  /** `"ok"`, or `"partial"` when a bulk batch had rejections. */
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

export interface PresenceActionResponse {
  status: string;
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
  error: string;
}
