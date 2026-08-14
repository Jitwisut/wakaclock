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

export interface AiEditEvent {
  event_id: string;
  entity: string;
  time: number;
  lines_added: number;
  lines_deleted: number;
}

/**
 * Reads the tiny metadata-only sidecar written by the CLI agent hooks. It lets the
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
    if (linesAdded === 0 && linesDeleted === 0) {
      return false;
    }

    await this.refresh();
    const normalizedEntity = normalizeEntity(entity);
    const nowSeconds = timeMs / 1000;
    const index = this.events.findIndex((event) => {
      if (this.consumed.has(event.event_id)) {
        return false;
      }
      if (normalizeEntity(event.entity) !== normalizedEntity) {
        return false;
      }
      if (Math.abs(event.time - nowSeconds) > 15) {
        return false;
      }
      // The two sides must plausibly describe the *same* edit. A hook counts a
      // replacement slightly differently from VS Code's range metrics, so a small
      // absolute slack is allowed — but no more than that.
      //
      // This used to be `event.lines_added >= linesAdded`, which matched any AI event
      // that touched at least as many lines as the editor observed. Because an agent
      // routinely rewrites whole files (events with +491 lines were present in a real
      // log), that test passed for essentially any human edit in a file an agent had
      // touched in the last 15 seconds: `491 >= 1`. The user's own typing was then
      // reattributed to the AI and their heartbeat dropped entirely, so the time they
      // genuinely spent disappeared. When in doubt leave the activity with the human —
      // plan.md 8.7 requires never erasing real human work to make attribution tidier.
      return (
        Math.abs(event.lines_added - linesAdded) <= LINE_MATCH_SLACK &&
        Math.abs(event.lines_deleted - linesDeleted) <= LINE_MATCH_SLACK
      );
    });

    if (index === -1) {
      return false;
    }

    const event = this.events[index];
    this.consumed.add(event.event_id);
    return true;
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
          typeof candidate.lines_added === "number" &&
          typeof candidate.lines_deleted === "number"
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
