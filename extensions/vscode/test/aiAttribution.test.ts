import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiAttributionStore } from "../src/aiAttribution";

describe("AiAttributionStore.classify — correlation window", () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-window-"));
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeSidecar(entity: string, timeSeconds: number) {
    const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(
      logPath,
      JSON.stringify({
        event_id: "e1",
        entity,
        time: timeSeconds,
        lines_added: 3,
        lines_deleted: 1
      }) + "\n"
    );
  }

  // Pins CORRELATION_WINDOW_SECONDS's actual value (15s), the same way
  // correlation.rs's `pins_exact_match_window_at_five_seconds_past_the_window_edge`
  // pins EXACT_MATCH_WINDOW on the Rust side — a change to the constant should make
  // one of the two assertions below fail.
  it("matches an event exactly at the 15-second boundary", async () => {
    await writeSidecar("/project/a.ts", 100);
    const store = new AiAttributionStore(homeDir);

    const result = await store.classify("/project/a.ts", (100 + 15) * 1000, 3, 1);

    expect(result.attribution).toBe("ai");
  });

  it("does not match an event one second past the 15-second boundary", async () => {
    await writeSidecar("/project/a.ts", 100);
    const store = new AiAttributionStore(homeDir);

    const result = await store.classify("/project/a.ts", (100 + 16) * 1000, 3, 1);

    expect(result.attribution).toBe("human");
  });
});
