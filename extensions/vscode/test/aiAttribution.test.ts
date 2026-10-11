import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiAttributionStore } from "../src/aiAttribution";

describe("AiAttributionStore.classify — correlation window", () => {
  let homeDir: string;
  const contentFingerprint = `sha256:${"a".repeat(64)}`;

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
        lines_deleted: 1,
        content_fingerprint: contentFingerprint
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

    const result = await store.classify(
      "/project/a.ts",
      (100 + 15) * 1000,
      3,
      1,
      contentFingerprint
    );

    expect(result.attribution).toBe("ai");
  });

  it("does not match an event one second past the 15-second boundary", async () => {
    await writeSidecar("/project/a.ts", 100);
    const store = new AiAttributionStore(homeDir);

    const result = await store.classify(
      "/project/a.ts",
      (100 + 16) * 1000,
      3,
      1,
      contentFingerprint
    );

    expect(result.attribution).toBe("unattributed");
  });
  it("does not overwrite an unreadable cursor or acknowledge a failed checkpoint", async () => {
    await writeSidecar("/project/a.ts",100);
    const cursor=path.join(homeDir,".wakaclock","ai-events.cursor.json");
    await fs.writeFile(cursor,"invalid record retained");
    const corrupt=new AiAttributionStore(homeDir);
    await expect(corrupt.classify("/project/a.ts",100000,3,1)).rejects.toThrow("sidecar_cursor_unreadable_or_corrupt");
    expect(await fs.readFile(cursor,"utf8")).toBe("invalid record retained");
    expect(corrupt.checkpointHealth().errorCode).toBe("sidecar_cursor_unreadable_or_corrupt");
    await fs.rm(cursor);await fs.mkdir(cursor);
    const blocked=new AiAttributionStore(homeDir);
    await expect(blocked.classify("/project/a.ts",100000,3,1)).rejects.toThrow("sidecar_cursor_unreadable_or_corrupt");
    expect((await fs.stat(cursor)).isDirectory()).toBe(true);
  });
});

describe("AiAttributionStore — sidecar v2 incremental transport", () => {
  let homeDir: string;
  const contentFingerprint = `sha256:${"b".repeat(64)}`;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-sidecar-v2-"));
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  function record(
    eventId: string,
    timeSeconds: number,
    sequence: number,
    streamId = "stream-a"
  ): string {
    return JSON.stringify({
      schema_version: 2,
      stream_id: streamId,
      sequence,
      event_id: eventId,
      entity: "/project/a.ts",
      time: timeSeconds,
      lines_added: 3,
      lines_deleted: 1,
      content_fingerprint: contentFingerprint
    });
  }

  async function writeRaw(value: string) {
    const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, value);
    return logPath;
  }

  it("does not parse a partial line until the producer writes its newline", async () => {
    const logPath = await writeRaw(record("partial", 100, 1));
    const store = new AiAttributionStore(homeDir);

    expect((await store.classify("/project/a.ts", 100_000, 3, 1)).attribution).toBe("unattributed");

    await fs.appendFile(logPath, "\n");
    expect(
      (await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");
    // The same transport record is consumed once, even though the reader resumed from
    // a byte offset instead of rereading the entire file.
    expect((await store.classify("/project/a.ts", 100_000, 3, 1)).attribution).toBe("unattributed");
  });

  it("reads appended bytes and resynchronizes after a truncation with a new stream", async () => {
    const logPath = await writeRaw(`${record("first", 100, 1)}\n`);
    const store = new AiAttributionStore(homeDir);

    expect(
      (await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");

    await fs.appendFile(logPath, `${record("second", 101, 2)}\n`);
    expect(
      (await store.classify("/project/a.ts", 101_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");

    await fs.writeFile(logPath, `${record("rotated", 102, 1, "stream-b")}\n`);
    expect(
      (await store.classify("/project/a.ts", 102_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");
  });

  it("keeps legacy v1 rows readable and ignores future schemas", async () => {
    const legacy = JSON.stringify({
      event_id: "legacy",
      entity: "/project/a.ts",
      time: 100,
      lines_added: 3,
      lines_deleted: 1,
      content_fingerprint: contentFingerprint
    });
    const future = JSON.stringify({
      ...JSON.parse(record("future", 101, 2)),
      schema_version: 99
    });
    await writeRaw(`${legacy}\n${future}\n`);
    const store = new AiAttributionStore(homeDir);

    expect(
      (await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");
    expect((await store.classify("/project/a.ts", 101_000, 3, 1)).attribution).toBe("unattributed");
  });

  it("collapses only duplicate sidecar rows with the same tool identity and content version", async () => {
    const first = {
      ...JSON.parse(record("operation-first", 100, 1)),
      tool_event_id: "tool-1"
    };
    const retry = {
      ...JSON.parse(record("operation-retry", 100, 2)),
      tool_event_id: "tool-1"
    };
    await writeRaw(`${JSON.stringify(first)}\n${JSON.stringify(retry)}\n`);
    const store = new AiAttributionStore(homeDir);

    expect(
      (await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");
    expect(
      (await store.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution
    ).toBe("unattributed");
  });

  it("persists pending evidence and consumed ownership across reader restarts", async () => {
    await writeRaw(`${record("restart", 100, 1)}\n`);

    const firstReader = new AiAttributionStore(homeDir);
    // The event is retained as pending because the line delta is ambiguous.
    expect((await firstReader.classify("/project/a.ts", 100_000, 20, 1)).attribution).toBe(
      "unattributed"
    );

    const secondReader = new AiAttributionStore(homeDir);
    expect(
      (await secondReader.classify("/project/a.ts", 100_000, 3, 1, contentFingerprint)).attribution
    ).toBe("ai");

    const thirdReader = new AiAttributionStore(homeDir);
    // The same event cannot be replayed as ownership after the extension restarts.
    expect((await thirdReader.classify("/project/a.ts", 100_000, 3, 1)).attribution).toBe(
      "unattributed"
    );
  });
});

describe("F0-02 reproducer — ai-coverage-gap-audit-2026-09-05.md gap #1", () => {
  let homeDir: string;
  const contentFingerprint = `sha256:${"c".repeat(64)}`;

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
  // `human`. `classify`'s empty-candidates branch therefore keeps the observation
  // unattributed until a later producer can provide proof.
  it(
    "an edit with no sidecar candidate at all is not silently attributed to a human (D06)",
    async () => {
      const store = new AiAttributionStore(homeDir);

      const result = await store.classify("/project/never-seen.ts", Date.now(), 12, 0);

      expect(result.attribution).toBe("unattributed");
    }
  );

  it(
    "a sidecar that arrives after the editor flush is retained for late reconciliation",
    async () => {
      const entity = "/project/delayed.ts";
      const editorTimeMs = 100_000;
      const store = new AiAttributionStore(homeDir);

      // The editor flushes before the producer has appended its sidecar event. The
      // pending ledger keeps this observation unattributed so a later proof can revise it.
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
          lines_deleted: 1,
          content_fingerprint: contentFingerprint
        }) + "\n"
      );

      const late = await store.classify(entity, editorTimeMs, 3, 1, contentFingerprint);
      expect({ initial: initial.attribution, late: late.attribution }).toEqual({
        initial: "unattributed",
        late: "ai"
      });
    }
  );

  it(
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
          lines_deleted: 0,
          content_fingerprint: contentFingerprint
        }) + "\n"
      );

      const result = await new AiAttributionStore(homeDir).classify(
        entity,
        200_000,
        10,
        0,
        contentFingerprint,
        undefined,
        true
      );
      const actual = {
        ai_added: result.ai_lines_added ?? 0,
        human_added: 0,
        unattributed_added: result.unattributed_lines_added ?? 0
      };

      // Four lines have direct AI evidence. The residual six have no positive
      // human proof and therefore remain unknown until another producer proves them.
      expect(actual).toEqual({ ai_added: 4, human_added: 0, unattributed_added: 6 });
    }
  );


});
