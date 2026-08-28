export type DesktopCategory =
  | 'coding'
  | 'building'
  | 'debugging'
  | 'designing'
  | 'modeling'
  | 'meeting'
  | 'communicating';

export interface AppRule {
  id: string;
  label: string;
  identifiers: string[];
  enabled: boolean;
  category: DesktopCategory;
}

export interface DesktopSettings {
  enabled: boolean;
  idle_timeout_seconds: number;
  private_mode: boolean;
  title_tracking: boolean;
  denied_app_names: string[];
  denied_window_patterns: string[];
  rules: AppRule[];
}

export interface RuntimeSnapshot {
  status: 'active' | 'idle' | 'paused' | 'private' | 'unmonitored' | 'unavailable';
  app_name: string | null;
  app_identifier: string | null;
  category: DesktopCategory | null;
  idle_seconds: number;
  last_heartbeat_at: number | null;
  last_error: string | null;
}

export interface DashboardSnapshot {
  today_seconds: number;
  today_text: string;
  heartbeat_count: number;
  queued_seconds: number;
  api_connected: boolean;
  runtime: RuntimeSnapshot;
  session_seconds: number;
  category_seconds: Partial<Record<DesktopCategory, number>>;
}
