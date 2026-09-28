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

// ---------------------------------------------------------------------------
// API v2 — stable data/meta envelope, mirrors V2Envelope/V2Meta in
// backend/api/src/handlers/v2.rs. Everything under /api/v2 responds in this shape;
// presence v2's own RoomEnvelope/RoomMeta (handlers/presence_v2.rs) are structurally
// identical and reuse the same TS types rather than duplicating them.
// ---------------------------------------------------------------------------
export interface V2Meta {
  coverage?: unknown;
  data_freshness: string;
  generated_at: string;
  request_id: string;
  timezone: string;
}

export interface V2Envelope<T> {
  data: T;
  meta: V2Meta;
}

// GET /capabilities
export interface V2Capabilities {
  analytics_store: string;
  api_version: string;
  clients: {
    browser_extensions: string;
    desktop_tracker: string;
    vscode: string;
    wakatime_protocol: string;
  };
  features: Array<{ api: string; available?: boolean; key: string; status: string }>;
  line_metric_versions: Array<{ version: string; status: string }>;
  postgres_enabled: boolean;
  presence_v2_available: boolean;
  privacy: {
    stores_prompt_lengths: boolean;
    stores_prompts: boolean;
    stores_responses: boolean;
    stores_source_code: boolean;
  };
  product: string;
  transactional_store: string;
  wakatime_routes: Array<{ method: string; route: string; section: string; status: string }>;
}

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
  active_ai_seconds?: number;
  active_coverage?: 'measured' | 'partial' | 'unavailable' | string;
  active_intervals?: Array<{
    end: number;
    segment_id: string;
    source: string;
    start: number;
  }>;
  active_human_seconds?: number;
  active_human_only_seconds?: number;
  active_ai_only_seconds?: number;
  active_overlap_seconds?: number;
  active_seconds?: number;
  agent_health?: unknown;
  ai_additional_seconds?: number;
  ai_measured_seconds?: number;
  buffered_seconds?: number;
  calculation_version?: 'combined_v2' | 'legacy';
  comparable_seconds?: number;
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
  wakatime_compatible_seconds?: number;
}

// ---------------------------------------------------------------------------
// GET /all_time_since_today
// ---------------------------------------------------------------------------
export interface AllTimeData {
  active_ai_seconds?: number;
  active_coverage?: 'measured' | 'partial' | 'unavailable' | string;
  active_human_seconds?: number;
  active_human_only_seconds?: number;
  active_ai_only_seconds?: number;
  active_overlap_seconds?: number;
  active_seconds?: number;
  ai_additional_seconds?: number;
  ai_measured_seconds?: number;
  calculation_version?: 'combined_v2' | 'legacy';
  comparable_seconds?: number;
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

/** How much of a total was measured versus inferred, and attended by a human versus
 * an agent — see EvidenceSplit in backend/api/src/services/activity_timeline.rs.
 * `attended + agent + other === proven + inferred` (both partitions of the same total);
 * `ai_coding`/`ai_session` are additive diagnostics with their own union semantics and
 * may legitimately exceed that total. */
export interface EvidenceSplit {
  agent_seconds: number;
  ai_additional_seconds?: number;
  ai_coding_seconds: number;
  ai_measured_seconds?: number;
  ai_session_seconds: number;
  attended_seconds: number;
  calculation_version?: 'combined_v2' | 'legacy';
  comparable_seconds?: number;
  inferred_seconds: number;
  other_seconds: number;
  proven_seconds: number;
}

export interface StatsData {
  active_ai_seconds?: number;
  active_coverage?: 'measured' | 'partial' | 'unavailable' | string;
  active_human_seconds?: number;
  active_human_only_seconds?: number;
  active_ai_only_seconds?: number;
  active_overlap_seconds?: number;
  active_seconds?: number;
  ai_additional_seconds?: number;
  ai_measured_seconds?: number;
  best_day: BestDay | null;
  calculation_version?: 'combined_v2' | 'legacy';
  categories: StatsBreakdownItem[];
  comparable_seconds?: number;
  daily_average_seconds: number;
  daily_average_text: string;
  days_included: number;
  days_with_activity: number;
  editors: StatsBreakdownItem[];
  evidence: EvidenceSplit;
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
  active_ai_seconds?: number;
  active_coverage?: 'measured' | 'partial' | 'unavailable' | string;
  active_human_seconds?: number;
  active_human_only_seconds?: number;
  active_ai_only_seconds?: number;
  active_overlap_seconds?: number;
  active_seconds?: number;
  ai_additional_seconds?: number;
  ai_measured_seconds?: number;
  calculation_version?: 'combined_v2' | 'legacy';
  comparable_seconds?: number;
  /** Additive evidence split; optional for compatibility with older servers. */
  evidence?: EvidenceSplit;
  heartbeats: number;
  hours: number;
  text: string;
  total_seconds: number;
}

export interface SummaryDay {
  /** Category breakdown is additive and may be absent on older servers. */
  categories?: SummaryItem[];
  date: string;
  editors: SummaryItem[];
  grand_total: SummaryGrandTotal;
  languages: SummaryItem[];
  operating_systems: SummaryItem[];
  projects: SummaryItem[];
}

export interface SummaryCalculation {
  calculation_version: 'combined_v2' | 'legacy' | string;
  comparable_metric: string;
  scope: string;
  timeout_seconds: number;
  timezone: string;
  writes_only: boolean;
}

export interface SummariesResponse {
  days: SummaryDay[];
  end: string;
  start: string;
  /** Additive effective-settings contract for external duration comparisons. */
  calculation?: SummaryCalculation;
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
  active_ai_seconds?: number;
  active_coverage?: 'measured' | 'partial' | 'unavailable' | string;
  active_human_seconds?: number;
  active_human_only_seconds?: number;
  active_ai_only_seconds?: number;
  active_overlap_seconds?: number;
  active_seconds?: number;
  ai_additional_seconds?: number;
  ai_measured_seconds?: number;
  calculation_version?: 'combined_v2' | 'legacy';
  comparable_seconds?: number;
  data: DurationBlock[];
  date: string;
  range_end?: number;
  range_start?: number;
  timezone?: string;
  wakatime_compatible_seconds?: number;
  total: number;
  total_seconds?: number;
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
  ai_additional_seconds?: number;
  ai_measured_seconds?: number;
  calculation_version?: 'combined_v2' | 'legacy';
  comparable_seconds?: number;
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
  ai_added_measured_heartbeats?: number;
  ai_deleted_measured_heartbeats?: number;
  ai_lines_added: number;
  ai_lines_deleted: number;
  heartbeat_count: number;
  human_lines_added: number;
  human_lines_deleted: number;
  identity_reason?: null | string;
  identity_source?: null | string;
  identity_status?: null | string;
  model?: null | string;
  provider?: null | string;
  /** Legacy spelling retained while older servers roll forward. */
  unattributed_lines_added?: number;
  /** Legacy spelling retained while older servers roll forward. */
  unattributed_lines_deleted?: number;
  unknown_lines_added?: number;
  unknown_lines_deleted?: number;
}

export interface AiDailyItem {
  ai_inferred_lines_added?: number;
  ai_inferred_lines_deleted?: number;
  ai_lines_added: number;
  ai_lines_deleted: number;
  ai_verified_lines_added?: number;
  ai_verified_lines_deleted?: number;
  date: string;
  heartbeat_count: number;
  human_chars_added: number;
  human_keystrokes: number;
  human_lines_added: number;
  human_lines_deleted: number;
  /** Legacy spelling retained while older servers roll forward. */
  unattributed_lines_added?: number;
  /** Legacy spelling retained while older servers roll forward. */
  unattributed_lines_deleted?: number;
  unknown_lines_added?: number;
  unknown_lines_deleted?: number;
}

export interface AiStatsData {
  agents: AiAgentItem[];
  ai_heartbeat_percentage: number;
  ai_inferred_heartbeat_percentage: number;
  ai_verified_heartbeat_percentage: number;
  /** Additive F6 contract; absent on older servers. */
  coverage?: AiStatsCoverage;
  daily: AiDailyItem[];
  human_heartbeat_percentage: number;
  identity?: AiIdentitySummary;
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
  total_unknown_lines_added: number;
  total_unknown_lines_deleted: number;
  unknown_heartbeat_percentage: number;
}

export interface AiIdentitySummary {
  /** Denominator is every canonical ai_verified heartbeat, including incomplete/conflict rows. */
  ai_verified_heartbeat_denominator?: number;
  confirmed_ai_heartbeat_percentage?: number;
  confirmed_ai_heartbeats: number;
  conflict_heartbeats: number;
  incomplete_ai_heartbeats: number;
  incomplete_ai_lines_added: number;
  incomplete_ai_lines_deleted: number;
  reason_counts: Array<{ heartbeats: number; reason: string }>;
}

export type AiStatsCoverageStatus = 'complete' | 'no_activity' | 'partial';

export interface AiStatsCoverage {
  ai_inferred_heartbeats: number;
  ai_verified_heartbeats: number;
  attributed_line_changes: number;
  heartbeat_denominator: number;
  human_heartbeats: number;
  line_change_denominator: number;
  line_coverage_percent: null | number;
  status: AiStatsCoverageStatus;
  unknown_heartbeats: number;
  unknown_line_changes: number;
}

export interface AiStatsResponse {
  data: AiStatsData;
  end: string;
  /** Optional for compatibility with pre-F6 servers. */
  schema_version?: number;
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
  schema_version: 1;
}

export type AiMeasurementAvailability = 'available' | 'disabled' | 'unavailable';
export type AiRuntimeHealth = 'degraded' | 'disabled' | 'healthy' | 'idle' | 'unavailable';

export interface AiDiagnosticsMeasurement<T> {
  availability: AiMeasurementAvailability;
  measured_at: null | string;
  value: null | T;
}

export interface AiDiagnosticsBrokerV2 {
  availability: AiMeasurementAvailability;
  dead_letter: AiDiagnosticsMeasurement<number>;
  last_delivery_at?: null | string;
  last_error_code?: null | string;
  pending: AiDiagnosticsMeasurement<number>;
  retry: AiDiagnosticsMeasurement<number>;
  running: AiDiagnosticsMeasurement<boolean>;
}

export interface AiDiagnosticsParserV2 {
  availability: AiMeasurementAvailability;
  max_lag_seconds: AiDiagnosticsMeasurement<number>;
  transcripts_behind: AiDiagnosticsMeasurement<number>;
  transcripts_watched: AiDiagnosticsMeasurement<number>;
}

export interface AiAdapterFreshnessV2 {
  agent: string;
  availability: AiMeasurementAvailability;
  certificate_id?: null | string;
  certification?: AiCertificationTuple | null;
  certification_status?: null | string;
  detected: AiDiagnosticsMeasurement<boolean>;
  diagnostic_code?: null | string;
  enabled: AiDiagnosticsMeasurement<boolean>;
  last_evidence_at?: null | string;
  runtime_health: AiRuntimeHealth;
  verification: AiVerificationStatus;
}

/** Exact capability tuple used by the server-side certification catalog. */
export interface AiCertificationTuple {
  adapter_id: string;
  arch?: null | string;
  client_id: string;
  contract_version: string;
  corpus_version?: null | string;
  edit_modes: string[];
  fingerprint_version: string;
  model_id?: null | string;
  os?: null | string;
  payload_schema_versions: string[];
  producer_version?: null | string;
  provider_id: string;
  runtime?: null | string;
  tool_version?: null | string;
}

export interface AiDiagnosticsReportV2 {
  adapters: AiAdapterFreshnessV2[];
  boot_id: string;
  broker: AiDiagnosticsBrokerV2;
  captured_at: string;
  consent: {
    adapter_tracking: boolean;
    diagnostics_upload: boolean;
    observer: boolean;
  };
  device_id: string;
  measured_at: string;
  parser: AiDiagnosticsParserV2;
  runtime_health: AiRuntimeHealth;
  schema_version: 2;
  sequence: number;
}

export interface AiDiagnosticsV2Response {
  reports: AiDiagnosticsReportV2[];
  storage: 'ephemeral' | 'postgres' | string;
}

export interface AiDiagnosticsResponse {
  report: AiDiagnosticsReport | null;
}

// ---------------------------------------------------------------------------
// GET /users/current/keystroke_stats
// ---------------------------------------------------------------------------
/** Shared by daily/project rows and the aggregate totals — see
 * backend/api/src/model/keystroke_stats.rs, whose *Item/*Row structs all carry the
 * same clipboard fields under an un-prefixed name (`copy_actions`) while
 * `KeystrokeStatsData`'s totals carry the `total_` prefix (`total_copy_actions`). */
interface KeystrokeClipboardCounts {
  copied_chars: number;
  copied_lines: number;
  copy_actions: number;
  paste_actions: number;
  paste_external_or_unknown_actions: number;
  paste_same_file_actions: number;
  paste_same_workspace_actions: number;
  pasted_chars: number;
  pasted_lines: number;
}

export interface KeystrokeProjectItem extends KeystrokeClipboardCounts {
  chars_added: number;
  chars_deleted: number;
  keystrokes: number;
  name: string;
}

export interface KeystrokeDailyItem extends KeystrokeClipboardCounts {
  chars_added: number;
  chars_deleted: number;
  date: string;
  keystrokes: number;
}

export interface ClipboardCoverage {
  percent: number;
  supported_vscode_heartbeats: number;
  total_vscode_heartbeats: number;
}

export interface KeystrokeStatsData {
  clipboard_coverage: ClipboardCoverage;
  daily: KeystrokeDailyItem[];
  days_with_activity: number;
  projects: KeystrokeProjectItem[];
  total_chars_added: number;
  total_chars_deleted: number;
  total_copied_chars: number;
  total_copied_lines: number;
  total_copy_actions: number;
  total_keystrokes: number;
  total_paste_actions: number;
  total_paste_external_or_unknown_actions: number;
  total_paste_same_file_actions: number;
  total_paste_same_workspace_actions: number;
  total_pasted_chars: number;
  total_pasted_lines: number;
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

/**
 * `api_key` is the caller's active key when the server holds a sealed copy
 * (ATOAXIS_KMS_KEY_ID configured), otherwise null — keys issued without a master
 * key, or by a ClickHouse-only deployment, are shown only once by POST.
 */
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
    ai_inferred_added: number;
    ai_inferred_deleted: number;
    ai_verified_added: number;
    ai_verified_deleted: number;
    date: string;
    human_added: number;
    human_deleted: number;
    /** Historical heartbeats predate explicit unknown provenance — null protects the
     * UI from presenting that absence as a measured zero. Deprecated alias of `unknown_*`. */
    unattributed_added: null | number;
    unattributed_deleted: null | number;
    unit: 'lines';
    unknown_added: number;
    unknown_deleted: number;
  }>;
  data_version: number;
  generated_at: string;
  range: { days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  summary: {
    active_day_average_seconds: number;
    ai_additional_seconds?: number;
    ai_measured_seconds?: number;
    calculation_version?: 'combined_v2' | 'legacy';
    calendar_day_average_seconds: number;
    comparable_seconds?: number;
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
/** Shared by `ai`/`ai_inferred`/`ai_verified`/`human` — see AttributionTotals in
 * backend/api/src/model/project_analytics.rs. */
export interface AttributionTotals {
  changes: number;
  lines_added: number;
  lines_deleted: number;
  percentage: null | number;
}

/** The Unknown-authorship bucket. `unattributed` fields elsewhere are a deprecated
 * response alias for the same `unknown` data, not a distinct bucket. */
export interface UnattributedTotals {
  changes: number;
  lines_added: number;
  lines_deleted: number;
  percentage_of_observed: null | number;
}

export interface TokenTotals {
  cache_read: null | number;
  cache_write: null | number;
  coverage_percent: null | number;
  input: null | number;
  output: null | number;
  total: null | number;
}

export interface EstimatedSpend {
  amount_microusd: null | number;
  coverage_percent: null | number;
  currency: 'USD';
}

export interface ProjectAnalyticsCard {
  /** Compatibility aggregate for both AI actor states (ai_inferred + ai_verified). */
  ai: AttributionTotals;
  ai_inferred: AttributionTotals;
  ai_verified: AttributionTotals;
  attribution_coverage_percent: null | number;
  estimated_spend: EstimatedSpend;
  human: AttributionTotals;
  last_activity_at: null | string;
  name: string;
  project_id: string;
  prompts: null | number;
  repository: null | string;
  sessions: null | number;
  tokens: TokenTotals;
  total_seconds: number;
  /** Deprecated compatibility alias for `unknown`. */
  unattributed: UnattributedTotals;
  /** Canonical Unknown bucket. */
  unknown: UnattributedTotals;
}

export interface ProjectAnalyticsListResponse {
  data_version: number;
  generated_at: string;
  items: ProjectAnalyticsCard[];
  next_cursor: null | string;
  range: { days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  totals: {
    ai_additional_seconds?: number;
    ai_measured_seconds?: number;
    calculation_version?: 'combined_v2' | 'legacy';
    comparable_seconds?: number;
    project_count: number;
    total_seconds: number;
  };
}

export interface ProjectAiSummary {
  ai_inferred_lines: number;
  ai_lines: number;
  ai_percentage: null | number;
  ai_verified_lines: number;
  attribution_coverage_percent: null | number;
  estimated_spend: EstimatedSpend;
  human_lines: number;
  prompts: null | number;
  prompts_per_session: null | number;
  sessions: null | number;
  tokens: TokenTotals;
  /** Deprecated compatibility alias for `unknown_lines`. */
  unattributed_lines: null | number;
  /** Canonical Unknown bucket. */
  unknown_lines: null | number;
}

export interface ProjectBranchItem {
  ai_changes: number;
  ai_inferred_changes: number;
  ai_verified_changes: number;
  branch: string;
  heartbeat_count: number;
  human_changes: number;
  total_seconds: number;
  /** Deprecated compatibility alias for `unknown_changes`. */
  unattributed_changes: null | number;
  unknown_changes: null | number;
}

export interface ProjectDailyItem {
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
  /** Deprecated compatibility aliases for the Unknown bucket. */
  unattributed_added: null | number;
  unattributed_deleted: null | number;
  unknown_added: null | number;
  unknown_deleted: null | number;
}

export interface ProjectAnalyticsDetailResponse {
  ai: ProjectAiSummary;
  branches: ProjectBranchItem[];
  daily_activity: ProjectDailyItem[];
  data_version: number;
  editors: Array<{ name: string; percentage: number; total_seconds: number }>;
  generated_at: string;
  languages: Array<{ name: string; percentage: number; total_seconds: number }>;
  project: { name: string; project_id: string; repository: null | string };
  range: { branch: string; days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  summary: {
    active_days: number;
    ai_additional_seconds?: number;
    ai_measured_seconds?: number;
    all_projects_seconds: number;
    calculation_version?: 'combined_v2' | 'legacy';
    comparable_seconds?: number;
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
  /** Deprecated compatibility alias for `unknown_changes`. */
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
  actor_confidence?: null | number;
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
  identity_message_id?: null | string;
  identity_reason?: null | string;
  identity_schema_version?: null | number;
  identity_source?: null | string;
  identity_status?: null | string;
  identity_turn_id?: null | string;
  is_write: boolean;
  language: null | string;
  line_number: null | number;
  lines: null | number;
  machine: string;
  operating_system: string;
  project: null | string;
  session_id?: null | string;
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
  identity_message_id?: string;
  identity_reason?: string;
  identity_schema_version?: number;
  identity_source?: string;
  identity_status?: string;
  identity_turn_id?: string;
  is_ai_generated?: boolean;
  is_write?: boolean;
  keystrokes?: number;
  language?: string;
  line_number?: number;
  lines?: number;
  machine?: string;
  operating_system?: string;
  project?: string;
  session_id?: string;
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
// project_merges — user_id REQUIRED; applied at read time by /projects and by every
// duration surface built on the backend's build_timeline (durations/session timeline,
// stats, all-time, project analytics)
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
// POST /import/wakatime — uploaded JSON contents
// ---------------------------------------------------------------------------
export interface WakaTimeImportRequest {
  dump_json: string;
}

export interface WakaTimeImportData {
  import_id: string;
  imported_heartbeats: number;
  skipped_heartbeats: number;
  user_id: string;
}

export interface WakaTimeImportResponse {
  data: WakaTimeImportData;
  status: string;
}

// ---------------------------------------------------------------------------
// Presence v1 (plan.md Phase 7) — legacy prototype, still used by endpoints.ts.
// Backed by an in-memory, single-process store on the server; does not survive a
// server restart. See backend/api/src/infrastructure/presence_store.rs. Superseded
// for the actual presence page by the Presence v2 section below.
// ---------------------------------------------------------------------------
export type PresenceState = 'coding' | 'idle' | 'offline';

export interface PresencePoint {
  x: number;
  y: number;
}

/** PresenceStatus in infrastructure/redis_presence.rs — a status message the user typed
 * themselves (never inferred from activity). `expires_at` is unix seconds. */
export interface PresenceStatusMessage {
  emoji: null | string;
  expires_at: number;
  text: string;
}

/** Also doubles as presence v2's roster entry shape (RosterItem in
 * handlers/presence_v2.rs) — the two happen to be identical. */
export interface PresenceRosterEntry {
  position: null | PresencePoint;
  state: PresenceState;
  /** Unix seconds until which the member asked not to be disturbed (v2 only). */
  focus_until?: number;
  /** Present only when the member has set a status message (v2 only). */
  status?: PresenceStatusMessage;
  user_id: string;
  username: string;
  zone_id: null | string;
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
// Presence v2 (plan.md Phase 7 hardening) — Redis-backed rooms, mirrors
// backend/api/src/handlers/presence_v2.rs and model/presence.rs. This is what the
// actual /dashboard/wakaclock/presence page is wired to.
// ---------------------------------------------------------------------------
export interface PresenceZone {
  center_x: number;
  center_y: number;
  height: number;
  id: string;
  label: string;
  room_id: string;
  sort_order: number;
  width: number;
}

/** RoomListItem in handlers/presence_v2.rs — the shape returned by the room list and
 * embedded in a snapshot's `room` field. */
export interface PresenceV2Room {
  ended_at: null | string;
  expires_at: null | string;
  id: string;
  kind: 'adhoc' | 'team';
  name: string;
  team_id: null | string;
}

/** RoomData in handlers/presence_v2.rs — a single room fetched/created/previewed,
 * with its zone layout but no live roster (that comes from a snapshot). */
export interface PresenceV2RoomData {
  ended_at: null | string;
  expires_at: null | string;
  id: string;
  kind: 'adhoc' | 'team';
  name: string;
  owner_user_id: null | string;
  team_id: null | string;
  zones: PresenceZone[];
}

export interface PresenceV2SessionParticipant {
  user_id: string;
  username: string;
}

/** SessionItem in handlers/presence_v2.rs — an active table/zone co-working session. */
export interface PresenceV2Session {
  leaving_deadlines: Record<string, number>;
  participants: PresenceV2SessionParticipant[];
  session_id: string;
  started_at: number;
  zone_id: string;
}

/** SnapshotData in handlers/presence_v2.rs — what join/move and the SSE `snapshot`
 * event both deliver. `version` is monotonic per room; a viewer only ever applies a
 * snapshot whose version is >= the one it already has. */
export interface PresenceV2Snapshot {
  room: PresenceV2Room;
  roster: PresenceRosterEntry[];
  server_time: number;
  sessions: PresenceV2Session[];
  version: number;
  zones: PresenceZone[];
}

/** InviteData in handlers/presence_v2.rs. `invite_url_token` is only present on the
 * response to the creating call — listing invites later never re-exposes the token. */
export interface PresenceV2Invite {
  created_at: string;
  expires_at: string;
  id: string;
  invite_url_token: null | string;
  revoked_at: null | string;
  room_id: string;
  used_count: number;
}

/** TicketData in handlers/presence_v2.rs — a short-lived, single-use credential for
 * the SSE stream URL (EventSource cannot send an Authorization header). */
export interface PresenceV2Ticket {
  expires_in_seconds: number;
  ticket: string;
}

export interface PresenceHistoryParticipant {
  user_id: string;
  username: string;
}

/** HistoryItem in handlers/presence_v2.rs — one past co-working session from the
 * caller's own point of view (`your_*` fields are this user's window within the
 * session, which can be shorter than the session itself). */
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

/** PresenceSummaryData in handlers/presence_v2.rs. Suppressed (all fields null) below
 * a distinct-participant floor so a 1-2 person team's individual activity is never
 * reconstructable from an "org-wide" aggregate. */
export interface PresenceSummaryData {
  active_days: null | number;
  average_group_size: null | number;
  session_count: null | number;
  suppressed: boolean;
  total_collaboration_seconds: null | number;
}

// ---------------------------------------------------------------------------
// Goals — Phase 10, Postgres-backed. Mirrors backend/api/src/model/goal.rs. Only
// present in a deployment where useCapabilities().postgresEnabled is true.
// ---------------------------------------------------------------------------
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
  filter_value: null | string;
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
  coverage: number;
  current_seconds: number;
  direction: string;
  goal_id: string;
  on_track: boolean;
  percentage: number;
  period: string;
  target_seconds: number;
}

// ---------------------------------------------------------------------------
// Leaderboards — Phase 10, Postgres-backed. Mirrors
// backend/api/src/model/leaderboard.rs.
// ---------------------------------------------------------------------------
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
// Error shape — every handler returns this on failure. v1 handlers emit a plain
// string (`{"error": "message"}`); v2's `ApiError` (handlers/v2.rs) and presence's
// `PresenceApiError` both emit a structured object (`{"error": {"code", "message"}}`).
// Both clients (client.ts, client-v2.ts) already branch on `typeof payload`, so the
// type just needs to admit both shapes rather than picking one.
// ---------------------------------------------------------------------------
export interface ApiErrorBody {
  error: { code?: number; message: string } | string;
}
