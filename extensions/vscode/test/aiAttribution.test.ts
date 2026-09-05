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

describe("F0-02 reproducer — ai-coverage-gap-audit-2026-09-05.md gap #1", () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-unmatched-"));
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  // `classify` has zero candidates whenever no sidecar event exists for this
  // entity/window — which is exactly the shape of an AI edit with no adapter
  // installed for that tool, or one whose sidecar write simply hasn't landed yet
  // (a delayed sidecar, gap #4's other named scenario). There is no positive
  // evidence of human keystrokes here either: only that no AI event was found.
  // Per execution-plan decision D06 ("absence of AI evidence is not proof of human
  // origin"), the correct verdict is `unattributed`, not a silent promotion to
  // `human`. `classify`'s empty-candidates branch (aiAttribution.ts) returns
  // `human` unconditionally, so this currently fails.
  it.fails(
    "an edit with no sidecar candidate at all is not silently attributed to a human (D06)",
    async () => {
      const store = new AiAttributionStore(homeDir);

      const result = await store.classify("/project/never-seen.ts", Date.now(), 12, 0);

      expect(result.attribution).toBe("unattributed");
    }
  );

  it.fails(
    "a sidecar that arrives after the editor flush is retained for late reconciliation",
    async () => {
      const entity = "/project/delayed.ts";
      const editorTimeMs = 100_000;
      const store = new AiAttributionStore(homeDir);

      // The editor flushes before the producer has appended its sidecar event. F0's
      // expected contract is to keep this observation pending/unattributed so a
      // later exact event can revise it; the current store has no pending ledger and
      // immediately calls it human.
      const initial = await store.classify(entity, editorTimeMs, 3, 1);

      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "delayed-event",
          entity,
          time: editorTimeMs / 1000,
          lines_added: 3,
          lines_deleted: 1
        }) + "\n"
      );

      const late = await store.classify(entity, editorTimeMs, 3, 1);
      expect({ initial: initial.attribution, late: late.attribution }).toEqual({
        initial: "unattributed",
        late: "ai"
      });
    }
  );

  it.fails(
    "a mixed human+AI editor batch is split by change ownership instead of one scalar verdict",
    async () => {
      const entity = "/project/mixed.ts";
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "mixed-ai-event",
          entity,
          time: 200,
          lines_added: 4,
          lines_deleted: 0
        }) + "\n"
      );

      const result = await new AiAttributionStore(homeDir).classify(
        entity,
        200_000,
        10,
        0
      );
      const actual =
        result.attribution === "ai"
          ? { ai_added: 10, human_added: 0, unattributed_added: 0 }
          : result.attribution === "human"
            ? { ai_added: 0, human_added: 10, unattributed_added: 0 }
            : { ai_added: 0, human_added: 0, unattributed_added: 10 };

      // Four lines have direct AI evidence and six are human editor input. The
      // current batch classifier has no per-change ownership model, so it cannot
      // produce this expected split and falls back to one unattributed verdict.
      expect(actual).toEqual({ ai_added: 4, human_added: 6, unattributed_added: 0 });
    }
  );
});
