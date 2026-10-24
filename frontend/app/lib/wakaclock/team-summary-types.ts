import type { TeamAction } from './team-action-types';

export interface TeamSummaryCell {
  calculation_version: string;
  coverage: null | number;
  dimension: string;
  metric: string;
  pricing_versions: string[];
  provenance: string;
  provider_definition_version: null | string;
  reason: null | string;
  status: string;
  unit: string;
  updated_at: null | string;
  value: null | string;
}
export interface TeamWeeklySummary {
  action_basis: string;
  action_snapshot_at: null | string;
  actions: TeamAction[];
  actions_next_cursor: null | string;
  calculation_version: string;
  cells: TeamSummaryCell[];
  checked_at: string;
  data_status: string;
  family: 'copilot' | 'team_cost';
  interpretation: string;
  measurement_health: string[];
  organization_id: string;
  production_ready: false;
  team_id: null | string;
  timezone: string;
  week_start: string;
  window_end: string;
  window_start: string;
}
export interface TeamSummaryQuery {
  actions_after?: string;
  family: TeamWeeklySummary['family'];
  include_actions?: boolean;
  team_id?: string;
  timezone: string;
  week_start: string;
}
