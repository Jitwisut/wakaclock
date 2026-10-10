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
  line_metric_coverage: Array<{
    ai_inferred_heartbeats: number;
    ai_line_changes: number;
    ai_verified_heartbeats: number;
    heartbeats: number;
    human_heartbeats: number;
    human_line_changes: number;
    line_change_denominator: number;
    line_coverage_percent: null | number;
    reason: null | string;
    status: string;
    unknown_heartbeats: number;
    unknown_line_changes: number;
    version: string;
  }>;
  project_id: null | string;
  proven_seconds: number;
  start: string;
  timeout_seconds: number;
  timezone: string;
  total_seconds: number;
}

export interface OperationEvidencePage {
  date_basis: string;
  has_more: boolean;
  next_cursor: null | string;
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
    repair_reference: string;
    revision: number;
  }>;
}

export interface DeliveryStatusResponse {
  devices: Array<{
    age_seconds: number;
    capture?: {
      captured_at: string;
      enabled: boolean;
      last_scan_success_at: null | string;
      editor_journal?: {
        status: string;
        pending: null | number;
        dead_letter: number;
        last_observed_at: string;
      };
      parser_errors: number;
      pending: number;
      schema_version: number;
      status: string;
    } | null;
    captured_at: string;
    dead_letter: null | number;
    details?: {
      accepted_total: number;
      backlog_error: {
        failed_at: string;
        http_status: null | number;
        kind: string;
        message_code: string;
      } | null;
      eligible: number;
      leased: number;
      next_retry_at: null | string;
      oldest_event_at: null | string;
    } | null;
    device_id: string;
    last_successful_delivery_at: null | string;
    oldest_pending_at: null | string;
    pending: null | number;
    queue_id: string;
    received_at: string;
    retry: null | number;
    schema_version?: number;
    sequence: number;
    status: 'fresh' | 'stale' | 'unavailable';
  }>;
  storage: 'ephemeral' | 'postgres';
}

export type MeasurementRepairOutcome = 'failed' | 'partial' | 'success' | 'unknown';

export interface MeasurementRepairCandidate {
  lines_added: null | number;
  lines_deleted: null | number;
  outcome: MeasurementRepairOutcome;
  repair_reference: string;
}

export interface MeasurementRepairJob {
  after_added_total: null | number;
  after_deleted_total: null | number;
  applied: number;
  before_added_total: null | number;
  before_deleted_total: null | number;
  conflict_count: number;
  created_at: string;
  end: string;
  items: Array<{
    after: MeasurementRepairValues | null;
    applied_revision: null | number;
    base_revision: null | number;
    before: MeasurementRepairValues | null;
    outcome: MeasurementRepairOutcome;
    reason: null | string;
    repair_reference: string;
    rolled_back_revision: null | number;
    status: string;
  }>;
  ready: number;
  repair_id: string;
  requested: number;
  rolled_back: number;
  start: string;
  status: string;
  timezone: string;
  unchanged: number;
  unresolved: number;
  updated_at: string;
}

export interface MeasurementRepairValues {
  ai_lines_added: null | number;
  ai_lines_deleted: null | number;
  line_measurement_reason: null | string;
  line_measurement_status: null | string;
  line_metric_version: null | string;
  measurement_window_id: null | string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

/** OrganizationTeam in backend/api/src/model/organization.rs. */
export interface OrganizationTeam {
  created_at: string;
  id: string;
  name: string;
  organization_id: string;
  slug: string;
}

/** OrganizationMember in backend/api/src/model/organization.rs. */
export interface OrganizationMember {
  deactivated_at: null | string;
  email: null | string;
  joined_at: string;
  role: string;
  seat_type: string;
  user_id: string;
  username: string;
}

export type TeamRole = 'lead' | 'member' | 'viewer';

export type OrganizationInviteRole = 'admin' | 'member' | 'viewer';
export type OrganizationSeatType = 'developer' | 'viewer';

/** OrganizationUserInvite in backend/api/src/model/organization.rs. */
export interface OrganizationUserInvite {
  created_at: string;
  expires_at: string;
  id: string;
  invited_by: null | string;
  organization_id: string;
  organization_name: string;
  role: OrganizationInviteRole;
  seat_type: OrganizationSeatType;
  username: string;
}

/** AcceptedOrganizationInvite in backend/api/src/model/organization.rs. */
export interface AcceptedOrganizationInvite {
  organization_id: string;
  role: string;
  seat_type: string;
}

/** OrganizationTeamMember in backend/api/src/model/organization.rs. */
export interface OrganizationTeamMember {
  joined_at: string;
  role: TeamRole;
  user_id: string;
  username: string;
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
  confirmed_legacy_ambiguity_chunks: number;
  id: string;
  imported_heartbeats: number;
  issue_counts: Record<string, number>;
  legacy_scan_limited_chunks: number;
  net_change_seconds: null | number;
  possible_legacy_duplicates: number;
  received_chunks: number[];
  skipped_heartbeats: number;
  total_chunks: number;
}

export interface WakaTimeImportChunkPreview {
  chunk_index: number;
  digest: string;
  invalid_heartbeats: number;
  legacy_scan_limited: boolean;
  possible_legacy_duplicates: number;
  requires_confirmation: boolean;
  valid_heartbeats: number;
}
