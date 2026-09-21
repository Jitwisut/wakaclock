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
  /** Observed by the sampler. Keeps advancing while the server is unreachable. */
  last_captured_at?: number | null;
  /** Handed to delivery, which durably queues what it cannot send. */
  last_queued_at?: number | null;
  /** Accepted by the server. */
  last_delivered_at?: number | null;
  last_error: string | null;
}

/** Same vocabulary as `wakaclock today --json` (see offline-reliability Phase 01). */
export type DesktopConnectionState =
  | 'online'
  | 'offline'
  | 'auth_rejected'
  | 'subscription_required'
  | 'retryable_server_error'
  | 'validation_rejected'
  | 'unknown_error'
  | 'needs_api_key';

export interface DashboardSnapshot {
  today_seconds: number;
  today_text: string;
  heartbeat_count: number;
  queued_seconds: number;
  api_connected: boolean;
  runtime: RuntimeSnapshot;
  session_seconds: number;
  category_seconds: Partial<Record<DesktopCategory, number>>;
  connection_state: DesktopConnectionState;
  /** Server-confirmed time. `null` means never read — not zero. */
  confirmed_seconds: number | null;
  /** Confirmed unioned with locally queued activity; `null` when unknown. */
  display_total_seconds: number | null;
  queued_heartbeats: number;
  orphaned_heartbeats: number;
  last_confirmed_at: number | null;
  server_snapshot_stale: boolean;
  /** Handoffs delivery was too busy to take; samples are still accounted for. */
  coalesced_intents: number;
}
