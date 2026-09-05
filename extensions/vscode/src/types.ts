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
    project?: string;
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
}

export interface ExtraHeartbeatPayload {
    entity: string;
    entity_type?: "file" | "domain" | "url" | "app";
    project?: string;
    category?: string;
    write?: boolean;
    line_number?: number;
    cursor_position?: number;
    keystrokes?: number;
    chars_added?: number;
    chars_deleted?: number;
    active_seconds?: number;
    heartbeat_id?: string;
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
  | "offline-queued"
  | "subscription-required"
  | "cli-unavailable";

export interface VerifyResult {
  status: VerifyStatus;
  server_url?: string;
  authenticated?: boolean;
  reachable?: boolean;
  cli_version?: string;
  queue_count?: number;
  error?: string | null;
}

export interface StatusBarSnapshot {
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
