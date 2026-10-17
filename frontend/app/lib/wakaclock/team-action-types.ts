import type { TeamWeeklyComparison } from './team-types';

export interface TeamAction {
  baseline_week: string;
  changed_by: string;
  created_at: string;
  created_by: string;
  family: 'copilot' | 'team_cost';
  focus:
    | 'delivery_reliability'
    | 'measurement_coverage'
    | 'review_flow'
    | 'tool_evaluation'
    | 'work_linking';
  followup_week: string;
  id: string;
  organization_id: string;
  owner_id: string;
  revision: number;
  status: 'active' | 'cancelled' | 'completed' | 'planned';
  team_id: null | string;
  timezone: string;
  title: string;
  updated_at: string;
}
export type TeamActionEdit = { expected_revision: number; request_id: string } & Pick<
  TeamAction,
  'baseline_week' | 'family' | 'focus' | 'followup_week' | 'owner_id' | 'status' | 'title'
>;
export interface TeamActionPage {
  actions: TeamAction[];
  can_manage: boolean;
  next_cursor: null | string;
}
export interface TeamActionHistory {
  changes: TeamAction[];
  next_revision: null | number;
}
export interface TeamActionComparison {
  action_id: string;
  action_revision: number;
  report: TeamWeeklyComparison;
}
