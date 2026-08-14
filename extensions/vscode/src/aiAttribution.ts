import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

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
      // A hook may count a replacement slightly differently from VS Code's range
      // metrics. Requiring the AI delta to cover the editor delta avoids suppressing
      // nearby human typing while still handling a complete AI insertion.
      return event.lines_added >= linesAdded && event.lines_deleted >= linesDeleted;
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
