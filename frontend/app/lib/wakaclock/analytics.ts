import type { ActorType } from './types';

export type AnalyticsSourceFilter = 'ai' | 'human' | 'other';
export type AnalyticsActorTypeFilter = ActorType;

export interface AnalyticsExplorerParams {
  actor_type?: AnalyticsActorTypeFilter;
  category?: string;
  editor?: string;
  end: string;
  language?: string;
  operating_system?: string;
  project_id?: string;
  source?: AnalyticsSourceFilter;
  start: string;
  timezone?: string;
}

export interface AnalyticsDurationSplit {
  ai_inferred_seconds?: number;
  ai_seconds: number;
  ai_verified_seconds?: number;
  human_seconds: number;
  other_seconds: number;
  total_seconds: number;
  unknown_seconds?: number;
}

export interface AnalyticsFilterOption {
  key: string;
  name: string;
  total_seconds: number;
}

export interface AnalyticsFilterOptions {
  actor_types?: AnalyticsFilterOption[];
  categories: AnalyticsFilterOption[];
  editors: AnalyticsFilterOption[];
  languages: AnalyticsFilterOption[];
  operating_systems: AnalyticsFilterOption[];
  projects: AnalyticsFilterOption[];
}

export interface AnalyticsExplorerResponse {
  applied_filters: {
    actor_type?: null | string;
    category: null | string;
    editor: null | string;
    language: null | string;
    operating_system: null | string;
    project_id: null | string;
    source: null | string;
  };
  breakdowns: AnalyticsFilterOptions;
  calendar_heatmap: Array<{ date: string } & AnalyticsDurationSplit>;
  filter_options: AnalyticsFilterOptions;
  generated_at: string;
  range: { days_included: number; end: string; start: string; timezone: string };
  schema_version: number;
  summary: {
    active_days: number;
    ai_additional_seconds?: number;
    ai_measured_seconds?: number;
    ai_share_percent: null | number;
    calculation_version?: 'combined_v2' | 'legacy';
    comparable_seconds?: number;
  } & AnalyticsDurationSplit;
  time_heatmap: Array<
    {
      hour: number;
      weekday: number;
      weekday_name: string;
    } & AnalyticsDurationSplit
  >;
  timeline: {
    bucket_seconds: number;
    items: Array<{ bucket: string; label: string } & AnalyticsDurationSplit>;
  };
}

export interface ReplaySegment {
  actor_type: ActorType;
  branch: null | string;
  category: string;
  end: number;
  language: null | string;
  project: null | string;
  project_id: null | string;
  source: string;
  start: number;
}

export interface ReplayAiSession {
  agent: string;
  end: number;
  model: null | string;
  start: number;
}

export interface ReplayResponse {
  ai_sessions: ReplayAiSession[];
  ai_sessions_status: 'available' | 'filtered' | 'not_permitted';
  applied_filters: AnalyticsExplorerResponse['applied_filters'];
  filter_options: AnalyticsFilterOptions;
  generated_at: string;
  range: AnalyticsExplorerResponse['range'];
  schema_version: number;
  segments: ReplaySegment[];
  summary: AnalyticsDurationSplit;
}

export type ReplayEventKind =
  | 'ci_cancelled'
  | 'ci_failure'
  | 'ci_success'
  | 'pr_closed'
  | 'pr_first_review'
  | 'pr_merged'
  | 'pr_opened'
  | 'pr_ready';

export interface ReplayEvent {
  at: number;
  id: string;
  kind: ReplayEventKind;
  number: number;
  project_ids: string[];
  repository: string;
  url: string;
}

export interface ReplayEventsResponse {
  events: ReplayEvent[];
  status: 'available' | 'identity_required';
  unconfirmed_items: number;
}

export interface ProjectCityPoint {
  day: number;
  dependencies: number;
  files: number;
  lines: number;
}

export interface ProjectCityModule {
  area: string;
  language: string;
  path: string;
  series: ProjectCityPoint[];
  top_files: Array<{ lines: number; path: string }>;
}

export interface ProjectCityResponse {
  coverage: {
    files_ignored: number;
    files_included: number;
    files_outside_root: number;
    files_without_lines: number;
  };
  days: string[];
  generated_at: string;
  modules: ProjectCityModule[];
  project_id: string;
  schema_version: number;
  timezone: string;
}

export const analyticsFilterParamNames = [
  'project_id',
  'language',
  'editor',
  'category',
  'source',
  'actor_type',
  'operating_system',
  'timezone',
] as const;

export type AnalyticsFilterParamName = (typeof analyticsFilterParamNames)[number];

export function analyticsFilterLabel(value: string) {
  if (!value) return 'Unknown';
  return value.replaceAll('_', ' ').replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}
