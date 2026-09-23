export interface MeasurementQuality {
  attribution_coverage: {
    attributed_line_changes: number;
    heartbeat_denominator: number;
    line_change_denominator: number;
    line_coverage_percent: null | number;
    status: 'complete' | 'no_activity' | 'partial';
    unknown_heartbeats: number;
    unknown_line_changes: number;
  };
  attribution_date_basis: string;
  calculation_version: string;
  days: Array<{
    active_coverage: null | string;
    active_seconds: null | number;
    date: string;
    heartbeat_count: number;
    inferred_seconds: number;
    proven_seconds: number;
    reason: null | string;
    status: 'no_observation' | 'observed';
    total_seconds: number;
  }>;
  delivery_status: string;
  end: string;
  inferred_seconds: number;
  proven_seconds: number;
  start: string;
  timeout_seconds: number;
  timezone: string;
  total_seconds: number;
}

export interface OperationEvidencePage {
  date_basis: string;
  has_more: boolean;
  operations: Array<{
    actor: string;
    agent: null | string;
    event_id: string;
    identity_reason: null | string;
    identity_source: null | string;
    lines_added: null | number;
    lines_deleted: null | number;
    model: null | string;
    occurred_at: number;
    provider: null | string;
    revision: number;
  }>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationAnalyticsSharing {
  share_aggregate: boolean;
  share_individual: boolean;
}

export interface OrganizationAnalytics {
  active_developer_seats: number;
  measurement: {
    attributed_line_changes: number;
    consenting_members: number;
    end: string;
    individual: Array<{
      attributed_line_changes: number;
      line_change_denominator: number;
      total_seconds: number;
      user_id: string;
    }>;
    inferred_seconds: null | number;
    line_change_denominator: number;
    proven_seconds: null | number;
    small_team_inference_warning: boolean;
    start: string;
    status: string;
    timezone: string;
    total_seconds: null | number;
  };
  member_count: number;
  organization_id: string;
  team_count: number;
}

export interface WakaTimeImportJob {
  after_calculation_version: null | string;
  after_total_seconds: null | number;
  before_calculation_version: string;
  before_total_seconds: number;
  completed: boolean;
  id: string;
  imported_heartbeats: number;
  issue_counts: Record<string, number>;
  net_change_seconds: null | number;
  received_chunks: number[];
  skipped_heartbeats: number;
  total_chunks: number;
}
