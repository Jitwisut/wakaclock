import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/**
 * How far an AI hook's line counts may differ from VS Code's own range metrics and
 * still be considered the same edit. Small on purpose: it exists to absorb
 * trailing-newline and replacement-counting differences, not to let a large agent
 * rewrite swallow an unrelated human edit in the same file.
 */
const LINE_MATCH_SLACK = 2;

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
 * `MAX_ACTIVITY_GAP_SECONDS` (120s), which bounds one wire segment's own span, not a
 * correlation match.
 */
const CORRELATION_WINDOW_SECONDS = 15;
const MAX_SIDECAR_READ_BYTES = 256 * 1024;
const MAX_SIDECAR_EVENTS = 500;
const MAX_SIDECAR_LINE_BYTES = 64 * 1024;
const SIDECAR_CURSOR_SCHEMA_VERSION = 1;

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
}

/** Result of matching an editor-side change against the broker sidecar. */
export interface AiClassificationResult {
  attribution: RecentEditAttribution;
  /** Present only when `attribution === "ai"`. */
  event?: AiEditEvent;
}

interface PersistedSidecarCursor {
  schema_version: number;
  file_identity?: string;
  read_offset: number;
  stream_id?: string;
  last_sequence?: number;
  seen_transport_keys: string[];
  events: AiEditEvent[];
  consumed_event_ids: string[];
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
  private consumed = new Set<string>();
  private readOffset = 0;
  private partialLine = Buffer.alloc(0);
  private fileIdentity?: string;
  private streamId?: string;
  private lastSequence?: number;
  private readonly seenTransportKeys = new Set<string>();
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
    linesDeleted: number
  ): Promise<AiClassificationResult> {
    if (linesAdded === 0 && linesDeleted === 0) {
      return { attribution: "human" };
    }

    await this.refresh();
    const normalizedEntity = normalizeEntity(entity);
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
      // No nearby AI evidence exists for this file after the correlation window, so
      // preserve ordinary editor activity as Human. `unattributed` is reserved for a
      // genuinely ambiguous case where an AI event is nearby but its line delta does
      // not prove that it owns this exact editor change.
      return { attribution: "human" };
    }

    // Prefer the closest event in time so an old nearby event cannot claim a newer
    // edit when several agent activities are present in the sidecar.
    candidates.sort(
      (left, right) =>
        Math.abs(left.event.time - nowSeconds) - Math.abs(right.event.time - nowSeconds)
    );
    const { event } = candidates[0];
    if (event.lines_added === null || event.lines_deleted === null) {
      // The broker has evidence that an AI producer touched this entity, but the
      // producer did not provide line counters. It is unsafe to call the editor's
      // change Human merely because an exact delta cannot be proven.
      return { attribution: "unattributed" };
    }
    const linesAddedMatch = Math.abs(event.lines_added - linesAdded) <= LINE_MATCH_SLACK;
    const linesDeletedMatch = Math.abs(event.lines_deleted - linesDeleted) <= LINE_MATCH_SLACK;
    // Agent `Write` calls on a file that already existed have no prior content to
    // diff, so the hook can only report `lines_deleted: 0` even though the file was
    // fully replaced. VS Code sees that replacement as a delete of the old file's
    // entire line count, which is never within LINE_MATCH_SLACK of 0 for anything
    // but a tiny file. Recognize that specific shape — the hook's added-lines count
    // matches, but it reported zero deletions on what the editor saw as a large
    // deletion — as the same whole-file overwrite rather than an unrelated edit.
    const wholeFileOverwrite = linesAddedMatch && event.lines_deleted === 0 && linesDeleted > 0;
    if (!linesAddedMatch || !(linesDeletedMatch || wholeFileOverwrite)) {
      return { attribution: "unattributed" };
    }

    this.consumed.add(event.event_id);
    await this.persistCursor();
    return { attribution: "ai", event };
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
    for (const event of Array.isArray(snapshot.events) ? snapshot.events : []) {
      if (this.isValidEvent(event)) {
        this.events.set(event.event_id, event);
      }
    }
    for (const eventId of Array.isArray(snapshot.consumed_event_ids)
      ? snapshot.consumed_event_ids
      : []) {
      if (typeof eventId === "string") {
        this.consumed.add(eventId);
      }
    }
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
      events: Array.from(this.events.values()),
      consumed_event_ids: Array.from(this.consumed)
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
