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

export type RecentEditAttribution = "ai" | "human" | "unattributed";

export interface AiEditEvent {
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

/**
 * Reads the tiny metadata-only sidecar written by the local BrokerProcessor. It lets the
 * editor extension avoid counting the same external AI edit as human typing when the
 * edited file is open in VS Code. No source text or prompt is ever written here.
 */
export class AiAttributionStore {
  private readonly logPath: string;
  private events: AiEditEvent[] = [];
  private consumed = new Set<string>();

  public constructor(homeDir = os.homedir()) {
    this.logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
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
    const candidates = this.events
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
    return { attribution: "ai", event };
  }

  private async refresh(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.logPath, "utf8");
    } catch {
      return;
    }

    const parsed: AiEditEvent[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        const candidate = JSON.parse(line) as Partial<AiEditEvent>;
        if (
          typeof candidate.event_id === "string" &&
          typeof candidate.entity === "string" &&
          typeof candidate.time === "number" &&
          (typeof candidate.lines_added === "number" || candidate.lines_added === null) &&
          (typeof candidate.lines_deleted === "number" || candidate.lines_deleted === null)
        ) {
          parsed.push(candidate as AiEditEvent);
        }
      } catch {
        // A hook may be in the middle of appending a line. The next refresh will retry it.
      }
    }

    this.events = parsed.slice(-500);
    const activeIds = new Set(this.events.map((event) => event.event_id));
    for (const eventId of this.consumed) {
      if (!activeIds.has(eventId)) {
        this.consumed.delete(eventId);
      }
    }
  }
}

function normalizeEntity(entity: string): string {
  return path.normalize(path.resolve(entity)).replace(/\\/g, "/");
}
