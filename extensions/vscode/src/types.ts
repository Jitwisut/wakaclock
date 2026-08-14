export type HeartbeatCategory = "coding" | "building" | "debugging";

export type FlushReason =
    | "save"
    | "timer"
    | "switch"
    | "gap"
    | "manual"
    | "debug-start"
    | "debug-stop"
    | "build-start"
    | "build-stop";

export interface BufferedFileState {
    entity: string;
    project?: string;
    lastKeystrokeAt?: number;
    firstActivityAt?: number;
    lastActivityAt?: number;
    lastHeartbeatAt?: number;
    keystrokes: number;
    charsAdded: number;
    charsDeleted: number;
    humanLinesAdded: number;
    humanLinesDeleted: number;
    lineNumber?: number;
    cursorPosition?: number;
    pendingWrite: boolean;
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
}

export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface StatusBarSnapshot {
    humanReadable: string;
    totalSeconds: number;
    heartbeatCount: number;
}

export interface StatusSnapshot {
    configPath?: string;
    serverUrl?: string;
    userId?: string;
    queuedHeartbeats?: number;
    flushedNow?: number;
}

export interface WakaclockConfigSnapshot {
    cliPath: string;
    flushIntervalMs: number;
    sameFileHeartbeatMs: number;
    idleMs: number;
    statusBarEnabled: boolean;
    debugLogging: boolean;
    trackDebugSessions: boolean;
    trackBuildTasks: boolean;
}

export interface FlushOverrides {
    category?: HeartbeatCategory;
    write?: boolean;
    force?: boolean;
    now?: number;
}
