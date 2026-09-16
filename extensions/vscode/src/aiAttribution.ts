import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";

/**
 * How far an AI hook's line counts may differ from VS Code's own range metrics and
 * still be considered the same edit. Small on purpose: it exists to absorb
 * trailing-newline and replacement-counting differences, not to let a large agent
 * rewrite swallow an unrelated human edit in the same file.
 */
/**
 * How far a broker sidecar event's own timestamp may sit from this editor change's
 * timestamp and still be considered a candidate for the same edit — a point-to-point
 * distance, unlike `wakaclock-core::ai::correlation::EXACT_MATCH_WINDOW`'s 5s, which
 * measures distance to an *editor-observed window* (`EditorObservation.window_start`/
 * `window_end`), not a single point. 5s-to-a-window can be more permissive than
 * 15s-to-a-point depending on how wide that window is, so the two numbers are not
 * directly comparable and must not be unified — narrowing this one to match the
 * other's number would tighten matching here and reduce AI recall for no reason tied
 * to this call site's own accuracy. Also unrelated to `activity.ts`'s
 * `MAX_ACTIVITY_GAP_SECONDS` (15s), which bounds one wire segment's own span, not a
 * correlation match.
 */
const CORRELATION_WINDOW_SECONDS = 15;
const MAX_SIDECAR_READ_BYTES = 256 * 1024;
const MAX_SIDECAR_EVENTS = 500;
const MAX_SIDECAR_LINE_BYTES = 64 * 1024;
const SIDECAR_CURSOR_SCHEMA_VERSION = 1;
const PENDING_OBSERVATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_OBSERVATIONS = 500;

export type RecentEditAttribution = "ai" | "human" | "unattributed";

export interface AiEditEvent {
  /** v2 sidecars carry a schema, stream identity and transport sequence. */
  schema_version?: number;
  stream_id?: string;
  sequence?: number;
  event_id: string;
  entity: string;
  time: number;
  /** Null is an explicit unknown, never a zero-line edit. */
  lines_added: number | null;
  lines_deleted: number | null;
  /**
   * The remaining fields are optional because older sidecar writers may not emit
   * them, but the current broker (`append_broker_sidecar` in
   * `wakaclock-cli/src/broker.rs`) always does. `actor_type`/`actor_confidence` are
   * the server's own `resolve_attribution` output for this event — prefer them over
   * re-deriving attribution client-side from `confidence` alone.
   */
  agent?: string;
  provider?: string;
  model?: string;
  session_id?: string;
  source?: string;
  confidence?: string;
  actor_type?: string;
  actor_confidence?: number;
  tool_event_id?: string;
  canonical_operation_id?: string;
  content_fingerprint?: string;
  change_kind?: string;
}

/** Result of matching an editor-side change against the broker sidecar. */
export interface AiClassificationResult {
  attribution: RecentEditAttribution;
  /** Present only when `attribution === "ai"`. */
  event?: AiEditEvent;
  ai_lines_added?: number;
  ai_lines_deleted?: number;
  unattributed_lines_added?: number;
  unattributed_lines_deleted?: number;
  observation_id?: string;
  proof?: "identity" | "exact_shape" | "partial_shape" | "none";
}

interface PendingEditorObservation {
  observation_id: string;
  entity: string;
  time_ms: number;
  lines_added: number;
  lines_deleted: number;
  content_fingerprint?: string;
  tool_event_id?: string;
  created_at_ms: number;
  expires_at_ms: number;
}

interface PersistedSidecarCursor {
  schema_version: number;
  file_identity?: string;
  read_offset: number;
  stream_id?: string;
  last_sequence?: number;
  seen_transport_keys: string[];
  seen_operation_keys?: string[];
  events: AiEditEvent[];
  consumed_event_ids: string[];
  pending_observations?: PendingEditorObservation[];
}

/**
 * Reads the tiny metadata-only sidecar written by the local BrokerProcessor. It lets the
 * editor extension avoid counting the same external AI edit as human typing when the
 * edited file is open in VS Code. No source text or prompt is ever written here. V2
 * records carry a durable stream/sequence pair; the reader advances by byte offset,
 * keeps an incomplete trailing line out of attribution, and still accepts legacy v1
 * rows for upgrades.
 */
export class AiAttributionStore {
  private readonly logPath: string;
  private readonly cursorPath: string;
  private readonly events = new Map<string, AiEditEvent>();
  private readonly pendingObservations = new Map<string, PendingEditorObservation>();
  private consumed = new Set<string>();
  private readOffset = 0;
  private partialLine = Buffer.alloc(0);
  private fileIdentity?: string;
  private streamId?: string;
  private lastSequence?: number;
  private readonly seenTransportKeys = new Set<string>();
  private readonly seenOperationKeys = new Set<string>();
  private cursorLoaded = false;
  private refreshInFlight?: Promise<void>;

  public constructor(homeDir = os.homedir()) {
    this.logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
    this.cursorPath = path.join(homeDir, ".wakaclock", "ai-events.cursor.json");
  }

  /**
   * Thin wrapper over {@link classify} for callers that only need the verdict, not
   * the matched event's metadata (e.g. `agent`/`provider`/`model`).
   */
  public async classifyRecentEdit(
    entity: string,
    timeMs: number,
    linesAdded: number,
    linesDeleted: number
  ): Promise<RecentEditAttribution> {
    return (await this.classify(entity, timeMs, linesAdded, linesDeleted)).attribution;
  }

  /**
   * Classify an editor-side change using only the metadata emitted by agent hooks.
   *
   * A nearby event with a materially different line delta is deliberately not
   * treated as human work: it is evidence that an agent may have touched the file,
   * but not enough evidence to claim that this exact editor change belongs to it.
   * Keeping that result as `unattributed` prevents the dashboard from silently
   * inflating human attribution while preserving the observed activity.
   */
  public async classify(
    entity: string,
    timeMs: number,
    linesAdded: number,
    linesDeleted: number,
    contentFingerprint?: string,
    toolEventId?: string,
    _allowPartial = false
  ): Promise<AiClassificationResult> {
    if (linesAdded === 0 && linesDeleted === 0) {
      return { attribution: "human" };
    }

    await this.refresh();
    const normalizedEntity = normalizeEntity(entity);
    const observation = this.rememberPendingObservation(
      normalizedEntity,
      timeMs,
      linesAdded,
      linesDeleted,
      contentFingerprint,
      toolEventId
    );
    const nowSeconds = timeMs / 1000;
    const candidates = Array.from(this.events.values())
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => {
        if (this.consumed.has(event.event_id)) {
          return false;
        }
        if (normalizeEntity(event.entity) !== normalizedEntity) {
          return false;
        }
        if (Math.abs(event.time - nowSeconds) > CORRELATION_WINDOW_SECONDS) {
          return false;
        }
        return true;
      });

    if (candidates.length === 0) {
      // Absence of a sidecar record is not positive human evidence. Keep the
      // observation durable so a delayed producer can reconcile it later.
      await this.persistCursor();
      return {
        attribution: "unattributed",
        unattributed_lines_added: linesAdded,
        unattributed_lines_deleted: linesDeleted,
        observation_id: observation.observation_id,
        proof: "none"
      };
    }

    // Prefer the closest event in time, but reject a tie. A same-time/same-shape
    // event from another producer is ambiguity, not ownership.
    candidates.sort(
      (left, right) =>
        Math.abs(left.event.time - nowSeconds) - Math.abs(right.event.time - nowSeconds)
    );
    const bestDistance = Math.abs(candidates[0].event.time - nowSeconds);
    const equallyClose = candidates.filter(
      ({ event }) => Math.abs(Math.abs(event.time - nowSeconds) - bestDistance) < 0.001
    );
    if (equallyClose.length > 1) {
      await this.persistCursor();
      return {
        attribution: "unattributed",
        unattributed_lines_added: linesAdded,
        unattributed_lines_deleted: linesDeleted,
        observation_id: observation.observation_id,
        proof: "none"
      };
    }
    const { event } = candidates[0];
    if (event.lines_added === null || event.lines_deleted === null) {
      // The broker has evidence that an AI producer touched this entity, but the
      // producer did not provide line counters. It is unsafe to call the editor's
      // change Human merely because an exact delta cannot be proven.
      await this.persistCursor();
      return {
        attribution: "unattributed",
        unattributed_lines_added: linesAdded,
        unattributed_lines_deleted: linesDeleted,
        observation_id: observation.observation_id,
        proof: "none"
      };
    }
    const identityProof =
      (toolEventId !== undefined && event.tool_event_id === toolEventId) ||
      (isContentFingerprint(contentFingerprint) &&
        isContentFingerprint(event.content_fingerprint) &&
        event.content_fingerprint === contentFingerprint);
    // Time plus line shape is deliberately insufficient identity. Two producers (or
    // a human and an agent) can make the same sized edit in the same window. Only a
    // shared tool ID or post-edit content version can claim ownership; otherwise keep
    // the measured lines in the unknown bucket for late reconciliation.
    if (!identityProof) {
      await this.persistCursor();
      return {
        attribution: "unattributed",
        unattributed_lines_added: linesAdded,
        unattributed_lines_deleted: linesDeleted,
        observation_id: observation.observation_id,
        proof: "none"
      };
    }

    this.consumeEvent(event.event_id, observation.observation_id);
    await this.persistCursor();
    return {
      attribution: "ai",
      event,
      ai_lines_added: Math.min(event.lines_added, linesAdded),
      ai_lines_deleted: Math.min(event.lines_deleted, linesDeleted),
      unattributed_lines_added: Math.max(0, linesAdded - event.lines_added),
      unattributed_lines_deleted: Math.max(0, linesDeleted - event.lines_deleted),
      observation_id: observation.observation_id,
      proof: "identity"
    };
  }

  private rememberPendingObservation(
    entity: string,
    timeMs: number,
    linesAdded: number,
    linesDeleted: number,
    contentFingerprint?: string,
    toolEventId?: string
  ): PendingEditorObservation {
    const digest = createHash("sha256")
      .update(entity)
      .update("\0")
      .update(String(timeMs))
      .update("\0")
      .update(String(linesAdded))
      .update("\0")
      .update(String(linesDeleted))
      .update("\0")
      .update(contentFingerprint ?? "")
      .digest("hex");
    const now = Date.now();
    const existing = this.pendingObservations.get(digest);
    const observation =
      existing ?? {
        observation_id: `editor:${digest}`,
        entity,
        time_ms: timeMs,
        lines_added: linesAdded,
        lines_deleted: linesDeleted,
        content_fingerprint: contentFingerprint,
        tool_event_id: toolEventId,
        created_at_ms: now,
        expires_at_ms: now + PENDING_OBSERVATION_TTL_MS
      };
    this.pendingObservations.set(digest, observation);
    this.trimPendingObservations(now);
    return observation;
  }

  private consumeEvent(eventId: string, observationId: string): void {
    this.consumed.add(eventId);
    for (const [key, observation] of this.pendingObservations) {
      if (observation.observation_id === observationId) {
        this.pendingObservations.delete(key);
      }
    }
  }

  private trimPendingObservations(now = Date.now()): void {
    for (const [key, observation] of this.pendingObservations) {
      if (observation.expires_at_ms <= now) {
        this.pendingObservations.delete(key);
      }
    }
    while (this.pendingObservations.size > MAX_PENDING_OBSERVATIONS) {
      const oldest = this.pendingObservations.keys().next().value as string | undefined;
      if (!oldest) break;
      this.pendingObservations.delete(oldest);
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const operation = this.readNewSidecarBytes();
    this.refreshInFlight = operation;
    try {
      await operation;
    } finally {
      if (this.refreshInFlight === operation) {
        this.refreshInFlight = undefined;
      }
    }
  }

  private async readNewSidecarBytes(): Promise<void> {
    await this.loadCursor();
    let handle: import("node:fs/promises").FileHandle;
    try {
      handle = await fs.open(this.logPath, "r");
    } catch {
      return;
    }

    try {
      const stat = await handle.stat();
      const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
      if (
        (this.fileIdentity !== undefined && this.fileIdentity !== identity) ||
        stat.size < this.readOffset
      ) {
        // A truncate/rename starts a new byte stream. Keep the bounded event cache so
        // already-consumed ownership is not replayed, but resync from byte zero.
        this.readOffset = 0;
        this.partialLine = Buffer.alloc(0);
        // Keep the stream cursor across a file replacement when the broker keeps
        // its durable stream identity. A new stream_id below resets it safely.
      }
      this.fileIdentity = identity;
      if (stat.size <= this.readOffset) {
        await this.persistCursor();
        return;
      }

      const requested = Math.min(
        MAX_SIDECAR_READ_BYTES,
        Math.max(0, stat.size - this.readOffset)
      );
      const buffer = Buffer.alloc(requested);
      const result = await handle.read(buffer, 0, requested, this.readOffset);
      this.readOffset += result.bytesRead;
      const combined = Buffer.concat([this.partialLine, buffer.subarray(0, result.bytesRead)]);
      const newline = combined.lastIndexOf(0x0a);
      if (newline < 0) {
        if (combined.length <= MAX_SIDECAR_LINE_BYTES) {
          this.partialLine = combined;
        } else {
          // Do not let one unterminated producer line grow without bound. It is
          // discarded until a later newline arrives, and never becomes evidence.
          this.partialLine = Buffer.alloc(0);
        }
        await this.persistCursor();
        return;
      }

      this.partialLine = combined.subarray(newline + 1);
      if (this.partialLine.length > MAX_SIDECAR_LINE_BYTES) {
        // The next refresh starts after the oversized unterminated line. It cannot
        // become evidence, even if a producer later appends a newline.
        this.partialLine = Buffer.alloc(0);
      }
      const complete = combined.subarray(0, newline).toString("utf8");
      for (const line of complete.split("\n")) {
        this.acceptSidecarLine(line.endsWith("\r") ? line.slice(0, -1) : line);
      }
      await this.persistCursor();
    } finally {
      await handle.close();
    }
  }

  private acceptSidecarLine(line: string): void {
    if (!line.trim() || Buffer.byteLength(line, "utf8") > MAX_SIDECAR_LINE_BYTES) {
      return;
    }
    let candidate: Partial<AiEditEvent>;
    try {
      candidate = JSON.parse(line) as Partial<AiEditEvent>;
    } catch {
      // A malformed or half-written line is not attribution evidence.
      return;
    }
    const schemaVersion = candidate.schema_version ?? 1;
    if (schemaVersion !== 1 && schemaVersion !== 2) {
      return;
    }
    if (
      typeof candidate.event_id !== "string" ||
      typeof candidate.entity !== "string" ||
      typeof candidate.time !== "number" ||
      !Number.isFinite(candidate.time) ||
      (typeof candidate.lines_added !== "number" && candidate.lines_added !== null) ||
      (typeof candidate.lines_deleted !== "number" && candidate.lines_deleted !== null)
    ) {
      return;
    }
    if (
      candidate.content_fingerprint !== undefined &&
      !isContentFingerprint(candidate.content_fingerprint)
    ) {
      return;
    }
    if (candidate.sequence !== undefined &&
        (!Number.isSafeInteger(candidate.sequence) || candidate.sequence < 1)) {
      return;
    }
    if (
      schemaVersion === 2 &&
      (typeof candidate.stream_id !== "string" ||
        candidate.stream_id.trim() === "" ||
        candidate.sequence === undefined)
    ) {
      return;
    }
    if (candidate.stream_id !== undefined && candidate.stream_id !== this.streamId) {
      this.streamId = candidate.stream_id;
      this.lastSequence = undefined;
    }
    if (
      candidate.sequence !== undefined &&
      this.lastSequence !== undefined &&
      candidate.sequence <= this.lastSequence
    ) {
      return;
    }
    if (candidate.sequence !== undefined) {
      this.lastSequence = candidate.sequence;
    }
    const transportKey =
      candidate.stream_id !== undefined && candidate.sequence !== undefined
        ? `${candidate.stream_id}:${candidate.sequence}`
        : `legacy:${candidate.event_id}`;
    if (this.seenTransportKeys.has(transportKey)) {
      return;
    }
    this.seenTransportKeys.add(transportKey);
    this.trimState();
    const event = candidate as AiEditEvent;
    const operationKey = proofOperationKey(event);
    if (operationKey !== undefined && this.seenOperationKeys.has(operationKey)) {
      return;
    }
    if (operationKey !== undefined) {
      this.seenOperationKeys.add(operationKey);
    }
    const existing = this.events.get(event.event_id);
    if (
      existing &&
      event.sequence !== undefined &&
      existing.sequence !== undefined &&
      event.sequence <= existing.sequence
    ) {
      return;
    }
    this.events.set(event.event_id, event);
  }

  private async loadCursor(): Promise<void> {
    if (this.cursorLoaded) {
      return;
    }
    this.cursorLoaded = true;
    let snapshot: Partial<PersistedSidecarCursor>;
    try {
      const decoded: unknown = JSON.parse(await fs.readFile(this.cursorPath, "utf8"));
      if (!decoded || typeof decoded !== "object") {
        return;
      }
      snapshot = decoded as Partial<PersistedSidecarCursor>;
    } catch {
      return;
    }
    const readOffset = snapshot.read_offset;
    if (
      snapshot.schema_version !== SIDECAR_CURSOR_SCHEMA_VERSION ||
      typeof readOffset !== "number" ||
      !Number.isSafeInteger(readOffset) ||
      readOffset < 0
    ) {
      return;
    }
    this.readOffset = readOffset;
    this.fileIdentity =
      typeof snapshot.file_identity === "string" ? snapshot.file_identity : undefined;
    this.streamId = typeof snapshot.stream_id === "string" ? snapshot.stream_id : undefined;
    this.lastSequence =
      snapshot.last_sequence !== undefined &&
      Number.isSafeInteger(snapshot.last_sequence) &&
      snapshot.last_sequence >= 1
        ? snapshot.last_sequence
        : undefined;
    for (const key of Array.isArray(snapshot.seen_transport_keys)
      ? snapshot.seen_transport_keys
      : []) {
      if (typeof key === "string" && key.length <= MAX_SIDECAR_LINE_BYTES) {
        this.seenTransportKeys.add(key);
      }
    }
    for (const key of Array.isArray(snapshot.seen_operation_keys)
      ? snapshot.seen_operation_keys
      : []) {
      if (typeof key === "string" && key.length <= MAX_SIDECAR_LINE_BYTES) {
        this.seenOperationKeys.add(key);
      }
    }
    for (const event of Array.isArray(snapshot.events) ? snapshot.events : []) {
      if (this.isValidEvent(event)) {
        this.events.set(event.event_id, event);
        const operationKey = proofOperationKey(event);
        if (operationKey !== undefined) {
          this.seenOperationKeys.add(operationKey);
        }
      }
    }
    for (const eventId of Array.isArray(snapshot.consumed_event_ids)
      ? snapshot.consumed_event_ids
      : []) {
      if (typeof eventId === "string") {
        this.consumed.add(eventId);
      }
    }
    for (const observation of Array.isArray(snapshot.pending_observations)
      ? snapshot.pending_observations
      : []) {
      if (
        observation &&
        typeof observation.observation_id === "string" &&
        typeof observation.entity === "string" &&
        typeof observation.time_ms === "number" &&
        Number.isFinite(observation.time_ms) &&
        typeof observation.lines_added === "number" &&
        typeof observation.lines_deleted === "number" &&
        typeof observation.created_at_ms === "number" &&
        typeof observation.expires_at_ms === "number"
      ) {
        this.pendingObservations.set(observation.observation_id, observation);
      }
    }
    this.trimPendingObservations();
    this.trimState();
  }

  private isValidEvent(candidate: Partial<AiEditEvent>): candidate is AiEditEvent {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }
    const schemaVersion = candidate.schema_version ?? 1;
    return (
      (schemaVersion === 1 || schemaVersion === 2) &&
      typeof candidate.event_id === "string" &&
      typeof candidate.entity === "string" &&
      typeof candidate.time === "number" &&
      Number.isFinite(candidate.time) &&
      (typeof candidate.lines_added === "number" || candidate.lines_added === null) &&
      (typeof candidate.lines_deleted === "number" || candidate.lines_deleted === null) &&
      (candidate.content_fingerprint === undefined ||
        isContentFingerprint(candidate.content_fingerprint)) &&
      (candidate.sequence === undefined ||
        (Number.isSafeInteger(candidate.sequence) && candidate.sequence >= 1)) &&
      (schemaVersion !== 2 ||
        (typeof candidate.stream_id === "string" &&
          candidate.stream_id.trim() !== "" &&
          candidate.sequence !== undefined))
    );
  }

  private trimState(): void {
    while (this.seenTransportKeys.size > MAX_SIDECAR_EVENTS * 2) {
      const oldest = this.seenTransportKeys.values().next().value as string | undefined;
      if (oldest === undefined) {
        break;
      }
      this.seenTransportKeys.delete(oldest);
    }
    while (this.seenOperationKeys.size > MAX_SIDECAR_EVENTS * 2) {
      const oldest = this.seenOperationKeys.values().next().value as string | undefined;
      if (oldest === undefined) {
        break;
      }
      this.seenOperationKeys.delete(oldest);
    }
    while (this.events.size > MAX_SIDECAR_EVENTS) {
      const oldest = this.events.keys().next().value as string | undefined;
      if (oldest === undefined) {
        break;
      }
      this.events.delete(oldest);
      this.consumed.delete(oldest);
    }
  }

  private async persistCursor(): Promise<void> {
    if (!this.cursorLoaded) {
      return;
    }
    const partialBytes = this.partialLine.length;
    const stableOffset = Math.max(0, this.readOffset - partialBytes);
    const snapshot: PersistedSidecarCursor = {
      schema_version: SIDECAR_CURSOR_SCHEMA_VERSION,
      file_identity: this.fileIdentity,
      read_offset: stableOffset,
      stream_id: this.streamId,
      last_sequence: this.lastSequence,
      seen_transport_keys: Array.from(this.seenTransportKeys),
      seen_operation_keys: Array.from(this.seenOperationKeys),
      events: Array.from(this.events.values()),
      consumed_event_ids: Array.from(this.consumed),
      pending_observations: Array.from(this.pendingObservations.values())
    };
    const temporaryPath = `${this.cursorPath}.${process.pid}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.cursorPath), { recursive: true });
      await fs.writeFile(temporaryPath, `${JSON.stringify(snapshot)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.rename(temporaryPath, this.cursorPath);
      await fs.chmod(this.cursorPath, 0o600);
    } catch {
      // The sidecar remains usable if a read-only home or an interrupted atomic
      // replace prevents checkpoint persistence; the in-memory reader still applies
      // the same bounded, ordered rules for this extension process.
      try {
        await fs.rm(temporaryPath, { force: true });
      } catch {
        // Ignore cleanup failures on the best-effort metadata checkpoint.
      }
    }
  }
}

function normalizeEntity(entity: string): string {
  return path.normalize(path.resolve(entity)).replace(/\\/g, "/");
}

function isContentFingerprint(value: string | undefined): value is string {
  return /^sha256:[0-9a-f]{64}$/i.test(value ?? "");
}

function proofOperationKey(event: AiEditEvent): string | undefined {
  if (
    typeof event.tool_event_id !== "string" ||
    event.tool_event_id.trim() === "" ||
    !isContentFingerprint(event.content_fingerprint)
  ) {
    return undefined;
  }
  return `${normalizeEntity(event.entity)}:${event.tool_event_id}:${event.content_fingerprint}`;
}
