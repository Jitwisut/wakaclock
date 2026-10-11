import type { PipelineStage } from "./pipelineHealth";
export type HeartbeatCategory = "coding" | "building" | "debugging";
export type ActorType = "human" | "ai_verified" | "ai_inferred" | "unknown";
export type PasteOrigin = "same_file" | "same_workspace" | "external_or_unknown";

export interface ClipboardCopyMetrics {
    copiedChars: number;
    copiedLines: number;
}

export interface ClipboardPasteMetrics {
    origin: PasteOrigin;
}

/**
 * Metadata captured when a file changes on disk outside VS Code's document event
 * stream (for example an AI desktop client applying a patch).  The receiver keeps
 * the bytes local; only bounded line counts and an opaque fingerprint may cross the
 * heartbeat boundary.  Missing counters are intentionally `undefined` rather than
 * zero because a new/unreadable file has no proven before-version.
 */
export interface ExternalFileChangeMetadata {
    /** Stable receiver identity used to make watcher retries idempotent. */
    event_id?: string;
    change_kind?: "create" | "modify" | "delete" | "rename";
    previous_entity?: string;
    lines_added?: number;
    lines_deleted?: number;
    content_fingerprint?: string;
}

/** Metadata sent by the workspace watcher to correlate an external write with
 * the local broker's native AI event. File contents never leave VS Code. */
export interface EditorObservationPayload {
    schema_version: 1;
    observation_id: string;
    editor: "vscode";
    entity: string;
    workspace_root: string;
    occurred_at: string;
    change_kind: "create" | "modify" | "delete" | "rename";
    previous_entity?: string;
    lines_added?: number;
    lines_deleted?: number;
    content_fingerprint?: string;
}

export interface EditorObservationStatus {
    observation_id: string;
    status: "accepted" | "pending" | "matched" | "expired" | "duplicate";
    matched_event_id?: string;
    expires_at: number;
}

export type FlushReason =
    | "save"
    | "timer"
    | "focus-lost"
    | "shutdown"
    | "switch"
    | "gap"
    | "manual"
    | "debug-start"
    | "debug-stop"
    | "build-start"
    | "build-stop";

export interface BufferedFileState {
    entity: string;
    heartbeatId?: string;
    /** Workspace-folder name; the CLI uses it only when it cannot detect a project. */
    alternateProject?: string;
    /** Timestamp of the most recent text edit, kept separate from cross-file activity time. */
    lastEditAt?: number;
    /**
     * Where the interval that `lastEditAt` closed began. Only an agent-attribution
     * decision needs it: it is the exact boundary between time the developer had
     * already earned and the interval the agent's edit created.
     */
    lastEditIntervalStartAt?: number;
    lastActivityAt?: number;
    lastHeartbeatAt?: number;
    activeSeconds: number;
    activitySegments: ActivitySegment[];
    keystrokes: number;
    charsAdded: number;
    charsDeleted: number;
    humanLinesAdded: number;
    humanLinesDeleted: number;
    unattributedLinesAdded: number;
    unattributedLinesDeleted: number;
    copyActions: number;
    pasteActions: number;
    copiedChars: number;
    copiedLines: number;
    pastedChars: number;
    pastedLines: number;
    pasteSameFileActions: number;
    pasteSameWorkspaceActions: number;
    pasteExternalOrUnknownActions: number;
    lineNumber?: number;
    cursorPosition?: number;
    pendingWrite: boolean;
    /**
     * Set only when the pending edit was matched against a broker sidecar event
     * (`AiAttributionStore.classify`). Its presence, not `write`, is what should decide
     * whether the next payload reports AI or Human attribution — a save immediately
     * after an agent-owned edit must not fall back to Human just because `write` is true.
     */
    aiEventId?: string;
    aiAgent?: string;
    aiProvider?: string;
    aiModel?: string;
    aiSource?: string;
    aiConfidence?: string;
    aiActorType?: ActorType;
    aiActorConfidence?: number;
    aiLinesAdded?: number;
    aiLinesDeleted?: number;
    /** At most two event metadata records: one permits exact reconciliation,
     * two mark a mixed window. Source text is never retained here. */
    pendingEditorChanges: EditorChangeObservation[];
}

export interface EditorChangeObservation {
    timeMs: number;
    /** Deprecated event-shape fields, zero until the window is measured. */
    linesAdded: number;
    linesDeleted: number;
    contentFingerprint?: string;
    toolEventId?: string;
}

export interface ExtraHeartbeatPayload {
    entity: string;
    /** Unix seconds when the captured editor activity occurred. */
    time?: number;
    entity_type?: "file" | "domain" | "url" | "app";
    /**
     * Fallback project name (WakaTime `alternate_project`). The CLI resolves the real
     * project from the entity (git root first) and uses this only when none is found.
     */
    alternate_project?: string;
    category?: string;
    write?: boolean;
    line_number?: number;
    cursor_position?: number;
    keystrokes?: number;
    chars_added?: number;
    chars_deleted?: number;
    active_seconds?: number;
    heartbeat_id?: string;
    revision?: number;
    activity_segments?: ActivitySegment[];
    actor_type?: ActorType;
    actor_confidence?: number;
    ai_agent?: string;
    ai_provider?: string;
    ai_model?: string;
    ai_source?: string;
    ai_confidence?: "verified" | "correlated" | "inferred" | "unknown" | string;
    ai_event_id?: string;
    ai_lines_added?: number;
    ai_lines_deleted?: number;
    human_lines_added?: number;
    human_lines_deleted?: number;
    unattributed_lines_added?: number;
    unattributed_lines_deleted?: number;
    line_metric_version?: string;
    line_measurement_status?: "measured" | "unavailable";
    line_measurement_reason?: string;
    measurement_window_id?: string;
    clipboard_tracking_version?: number;
    copy_actions?: number;
    paste_actions?: number;
    copied_chars?: number;
    copied_lines?: number;
    pasted_chars?: number;
    pasted_lines?: number;
    paste_same_file_actions?: number;
    paste_same_workspace_actions?: number;
    paste_external_or_unknown_actions?: number;
}

export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/** Outcome of saving an API key: did it reach config.toml, and does the server accept it. */
export interface ApiKeySyncResult {
    /** config.toml is the only channel the AI agent hooks can read a key from. */
    mirroredToCliConfig: boolean;
    /** The server accepted the key on a real authenticated request. */
    verified: boolean;
    mirrorError?: string;
  verifyError?: string;
  /** Machine-readable outcome returned by `wakaclock verify --json`. */
  status?: VerifyStatus;
  /** The key may be retained in SecretStorage while the server is offline. */
  pending?: boolean;
  serverUrl?: string;
}

export type VerifyStatus =
  | "verified"
  | "invalid_key"
  | "subscription_required"
  | "unreachable"
  | "server_error"
  | "incompatible";

export type ConnectionState =
  | "needs-api-key"
  | "connecting"
  | "verified"
  | "offline"
  | "offline-queued"
  | "key-rejected"
  | "subscription-required"
  | "service-degraded"
  | "cli-unavailable";

/** `connection.state` from `wakaclock today --json` (wakaclock-core `ConnectionState`). */
export type ServerConnectionState =
  | "online"
  | "offline"
  | "auth_rejected"
  | "subscription_required"
  | "retryable_server_error"
  | "validation_rejected"
  | "unknown_error";

export interface ServerConnectionSnapshot {
  state: ServerConnectionState;
  reachable?: boolean;
  authenticated?: boolean | null;
  httpStatus?: number | null;
  lastErrorKind?: string | null;
  lastErrorAt?: number | null;
}

export interface VerifyResult {
  status: VerifyStatus;
  server_url?: string;
  authenticated?: boolean;
  reachable?: boolean;
  cli_version?: string;
  queue_count?: number;
  error?: string | null;
}

export interface DeliveryQueueDetails {
    eligible: number;
    leased: number;
    next_retry_at: string | null;
    oldest_event_at: string | null;
    accepted_total: number;
    backlog_error: { kind: string; http_status: number | null; message_code: string; failed_at: string } | null;
}

export interface StatusBarSnapshot {
    deliveryDetails?: DeliveryQueueDetails;
    dataIncomplete?: boolean;
    capture?: { pipeline?: PipelineStage[]; status: string; checked_at?: string; last_scan_success_at?: string; pending?: number; parser_errors?: number; incomplete?: boolean };
    deadLetter?: number;
    oldestPendingAt?: string;
    humanReadable: string;
    totalSeconds: number;
    heartbeatCount: number;
    confirmedSeconds?: number;
    queuedSeconds?: number;
    bufferedSeconds?: number;
    lastHeartbeatAt?: number;
    agentHealth?: unknown;
    coveredIntervals?: ActivitySegment[];
    lastIncrementSeconds?: number;
    lastIncrementSource?: string;
    discardedSeconds?: number;
    /** Heartbeats the server has not accepted yet, across every day — see cli.ts. */
    queuedHeartbeats?: number;
    /** The CLI's one-line delivery verdict. Starts with "REFUSED" when the server is
     *  turning heartbeats away (an expired trial, a revoked key), which is otherwise
     *  indistinguishable from a quiet day. */
    delivery?: string;
    /** Typed server state. Absent only for CLIs that predate the structured
     *  `today --json` contract; the status bar then falls back to legacy rules. */
    connection?: ServerConnectionSnapshot;
    legacyCli?: boolean;
}

export interface StatusSnapshot {
    configPath?: string;
    serverUrl?: string;
    userId?: string;
    queuedHeartbeats?: number;
    flushedNow?: number;
    capabilities?: string[];
}

export interface BrokerStatusSnapshot {
    runtime_mode?: "on_demand" | string;
    running?: boolean;
    pid?: number | null;
    endpoint?: string | null;
    protocol?: number;
    started_at?: number | null;
    uptime_seconds?: number;
    last_received_at?: number | null;
    last_processed_at?: number | null;
    last_delivery_at?: number | null;
    inbox?: {
        pending?: number;
        processing?: number;
        processed?: number;
        retry?: number;
        dead_letter?: number;
        last_received_at?: number | null;
        last_processed_at?: number | null;
        last_delivery_at?: number | null;
        last_error_code?: string | null;
        last_error_message?: string | null;
    };
    outbound_queue_count?: number;
}

export interface WakaclockConfigSnapshot {
  cliPath: string;
  /** Production origin; kept optional so older third-party test/config providers remain additive. */
  serverUrl?: string;
    flushIntervalMs: number;
    heartbeatRateLimitMs: number;
    sameFileHeartbeatMs: number;
    idleMs: number;
    statusBarEnabled: boolean;
    debugLogging: boolean;
    trackDebugSessions: boolean;
    trackBuildTasks: boolean;
    trackClipboardActions: boolean;
    autoInstallAgentHooks?: boolean;
    presenceAutoJoinEnabled?: boolean;
}

export interface FlushOverrides {
    category?: HeartbeatCategory;
    write?: boolean;
    force?: boolean;
    now?: number;
}

export interface BufferedActivitySnapshot {
    /** Seconds accumulated locally since the last successful/queued flush. */
    bufferedSeconds: number;
    activitySegments?: ActivitySegment[];
}

/** A non-overlapping piece of observed activity, expressed in epoch seconds. */
export interface ActivitySegment {
    segment_id: string;
    start: number;
    end: number;
    source?: "editor" | "ai" | "other" | string;
}
