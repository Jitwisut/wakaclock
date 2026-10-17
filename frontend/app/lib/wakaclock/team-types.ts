export interface TeamMetric {
  calculation_version: string;
  coverage: null | number;
  provenance: string;
  reason: null | string;
  status: string;
  updated_at: null | string;
  value: null | number;
}

export interface TeamConsent {
  aggregate_from: null | string;
  individual_from: null | string;
  preview: {
    downloaded_exports_recallable: boolean;
    excludes: string[];
    history_before_consent: boolean;
    metadata: string[];
    minimum_contributors: number;
  };
  share_aggregate: boolean;
  share_individual: boolean;
  version: number;
}

export interface TeamInsights {
  currency: string;
  end: string;
  estimated_ai_cost_microusd: TeamMetric;
  generation: number;
  measurement_health: string[];
  merged_pr_cost?: {
    average_microusd: TeamMetric;
    calculation_version: string;
    complete_prs: TeamMetric;
    pricing_versions: string[];
    with_cost: TeamMetric;
    without_cost: TeamMetric;
  };
  merged_pr_cost_microusd: TeamMetric;
  organization_id: string;
  production_ready: boolean;
  provider_breakdown: Array<{ cost_microusd: TeamMetric; model: string; provider: string }>;
  start: string;
  team_id: null | string;
  timezone: string;
}

export interface TeamWorkItem {
  closed_at: null | string;
  external_id: number;
  first_review_at: null | string;
  kind: string;
  merged_at: null | string;
  number: number;
  opened_at: string;
  ready_at: null | string;
  repository_id: string;
  session_details: 'withheld';
  state: string;
  synced_at: string;
}

export interface WorkReceipt {
  calculation_version?: string;
  cost_until?: null | string;
  estimated_cost_microusd: TeamMetric;
  generation: number;
  next?: null | string;
  pricing_versions?: string[];
  repository_id: string;
  sessions: Array<{
    allocation: string;
    cost_microusd: TeamMetric;
    link_evidence: string;
    link_id: string;
    session_id: string;
  }>;
  sharing: string;
  work_item_id: number;
}

export interface TeamHealthState {
  reason: string;
  scope?: string;
  status: string;
  updated_at?: null | string;
}
export interface TeamMeasurementHealth {
  capabilities?: {
    improvement_actions?: boolean;
    weekly_comparison?: boolean;
    weekly_summary?: boolean;
  };
  checked_at: string;
  own: { capture: TeamHealthState; delivery: TeamHealthState };
  report_timezone: string;
  restore: TeamHealthState;
  team: {
    capture: TeamHealthState;
    delivery: TeamHealthState;
    integration: TeamHealthState;
    retention: TeamHealthState;
  };
}

export interface TeamWeeklyComparison {
  baseline: {
    generation: number;
    measurement_health: string[];
    timezone: string;
    week_start: string;
  };
  calculation_version: string;
  changes: Array<{
    baseline_coverage: null | number;
    baseline_value: null | string;
    difference: null | string;
    followup_coverage: null | number;
    followup_value: null | string;
    metric: string;
    percent_change: null | number;
    reason: string;
    status: string;
    unit: string;
  }>;
  followup: {
    generation: number;
    measurement_health: string[];
    timezone: string;
    week_start: string;
  };
  interpretation: string;
  pricing_changed: boolean | null;
}
