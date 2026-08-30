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

export type RecentEditAttribution = "ai" | "human" | "unattributed";

export interface AiEditEvent {
  event_id: string;
  entity: string;
  time: number;
  /** Null is an explicit unknown, never a zero-line edit. */
  lines_added: number | null;
  lines_deleted: number | null;
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

  public async matchesRecentEdit(
    entity: string,
    timeMs: number,
    linesAdded: number,
    linesDeleted: number
  ): Promise<boolean> {
    return (
      (await this.classifyRecentEdit(entity, timeMs, linesAdded, linesDeleted)) ===
      "ai"
    );
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
  public async classifyRecentEdit(
    entity: string,
    timeMs: number,
    linesAdded: number,
    linesDeleted: number
  ): Promise<RecentEditAttribution> {
    if (linesAdded === 0 && linesDeleted === 0) {
      return "human";
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
      if (Math.abs(event.time - nowSeconds) > 15) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      // No nearby AI evidence exists for this file after the correlation window, so
      // preserve ordinary editor activity as Human. `unattributed` is reserved for a
      // genuinely ambiguous case where an AI event is nearby but its line delta does
      // not prove that it owns this exact editor change.
      return "human";
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
      return "unattributed";
    }
    const lineMatch =
      Math.abs(event.lines_added - linesAdded) <= LINE_MATCH_SLACK &&
      Math.abs(event.lines_deleted - linesDeleted) <= LINE_MATCH_SLACK;
    if (!lineMatch) {
      return "unattributed";
    }

    this.consumed.add(event.event_id);
    return "ai";
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
