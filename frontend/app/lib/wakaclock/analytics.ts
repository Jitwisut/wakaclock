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
