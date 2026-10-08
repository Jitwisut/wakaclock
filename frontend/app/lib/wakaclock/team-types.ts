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
  estimated_cost_microusd: TeamMetric;
  generation: number;
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
