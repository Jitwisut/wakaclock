import { mkdtemp, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import plugin from "../src/plugin.ts";

async function withMockCli(run: (capture: string, argsCapture: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "atoaxis-kilo-plugin-"));
  const cli = join(root, "wakaclock");
  const capture = join(root, "events.jsonl");
  const argsCapture = join(root, "args.log");
  await writeFile(
    cli,
    "#!/usr/bin/env node\n" +
      "let data = ''; process.stdin.on('data', chunk => data += chunk);\n" +
      "process.stdin.on('end', () => { const fs = require('node:fs'); if(process.argv[2] === 'journal-scope') {console.log(JSON.stringify({schema_version:1,scope_id:'a'.repeat(64),owner_confirmed:true,capabilities:['activity_envelope_v3']}));return;} fs.appendFileSync(process.env.ATOAXIS_CAPTURE, data + '\\n'); fs.appendFileSync(process.env.ATOAXIS_ARGS, process.argv.slice(2).join(' ') + '\\n'); if(process.argv[3] === 'activity-hook') { const x=JSON.parse(data); const hash=x=>require('node:crypto').createHash('sha256').update(x).digest('hex'); const op=hash(x.sessionID+'\\0'+x.callID); const kind=x.hook_event_name.endsWith('before')?'ToolStart':'ToolEnd'; const id=hash('activity-v3\\0kilo-code\\0'+x.sessionID+'\\0'+op+'\\0'+kind); console.log(JSON.stringify({acknowledgement:{schema_version:3,event_id:id,durable:true,status:'accepted'}})); } });\n"
  );
  await chmod(cli, 0o755);
  const previousHome = process.env.ATOAXIS_PRODUCER_HOME;
  process.env.ATOAXIS_PRODUCER_HOME = root;
  const previous = process.env.WAKACLOCK_CLI_PATH;
  const previousCapture = process.env.ATOAXIS_CAPTURE;
  const previousArgs = process.env.ATOAXIS_ARGS;
  process.env.WAKACLOCK_CLI_PATH = cli;
  process.env.ATOAXIS_CAPTURE = capture;
  process.env.ATOAXIS_ARGS = argsCapture;
  try {
    await run(capture, argsCapture);
  } finally {
    if (previousHome === undefined) delete process.env.ATOAXIS_PRODUCER_HOME; else process.env.ATOAXIS_PRODUCER_HOME = previousHome;
    if (previous === undefined) delete process.env.WAKACLOCK_CLI_PATH;
    else process.env.WAKACLOCK_CLI_PATH = previous;
    if (previousCapture === undefined) delete process.env.ATOAXIS_CAPTURE;
    else process.env.ATOAXIS_CAPTURE = previousCapture;
    if (previousArgs === undefined) delete process.env.ATOAXIS_ARGS;
    else process.env.ATOAXIS_ARGS = previousArgs;
    await rm(root, { recursive: true, force: true });
  }
}

test("Kilo emits successful file evidence and deduplicates file.edited", async () => {
  await withMockCli(async (capture) => {
    const hooks = await plugin.server({
      sessionID: "session-1",
      directory: "/repo",
      provider: "DeepSeek API",
      model: "deepseek-v4"
    }) as Record<string, any>;
    await hooks["tool.execute.before"]({ callID: "call-1", file_path: "/repo/src/main.ts" });
    await hooks["tool.execute.after"](
      { callID: "call-1", file_path: "/repo/src/main.ts", tool: "WriteFile" },
      { success: true, lines_added: 3, lines_deleted: 1 }
    );
    await hooks.event({ event: { type: "file.edited", file_path: "/repo/src/main.ts", tool_call_id: "call-1", lines_added: 3, lines_deleted: 1 } });
    const lines = (await readFile(capture, "utf8")).trim().split("\n").filter(Boolean);
    assert.equal(lines.length, 1);
    const event = JSON.parse(lines[0]) as Record<string, unknown>;
    assert.equal(event.agent, "kilo-code");
    assert.equal(event.provider, "deepseek");
    assert.equal(event.model, "deepseek-v4");
    assert.equal(event.lines_added, 3);
    assert.equal(event.lines_deleted, 1);
  });
});

test("Kilo captures read/search and failed tool markers without edits or tool contents", async () => {
  await withMockCli(async (capture, argsCapture) => {
    const hooks = await plugin.server({ directory: "/repo" }, { activitySurface: "ide" }) as Record<string, any>;
    for (const [callID, tool, failure] of [["read-call", "read", false], ["search-call", "search", true]] as const) {
      const input = { sessionID: "session-markers", callID, tool, args: { contents: "SENSITIVE" } };
      await hooks["tool.execute.before"](input);
      await hooks["tool.execute.after"](input, failure ? { error: "SENSITIVE" } : { output: "SENSITIVE" });
    }
    const text = await readFile(capture, "utf8");
    assert.ok(!text.includes("SENSITIVE"));
    const events = text.trim().split("\n").map(line => JSON.parse(line));
    assert.equal(events.length, 4);
    assert.deepEqual(events.map(event => event.hook_event_name), ["tool.execute.before", "tool.execute.after", "tool.execute.before", "tool.execute.failure"]);
    assert.ok(events.every(event => !event.active_seconds && !event.entity && !event.started_at));
    assert.ok((await readFile(argsCapture, "utf8")).split("\n").filter(Boolean).every(args => args.startsWith("ai activity-hook --adapter kilo-code --surface ide --scope-id ")));
  });
});

test("Kilo does not emit a failed tool", async () => {
  await withMockCli(async (capture) => {
    const hooks = await plugin.server({ sessionID: "session-2", directory: "/repo" }) as Record<string, any>;
    await hooks["tool.execute.before"]({ callID: "call-2", file_path: "/repo/src/fail.ts" });
    await hooks["tool.execute.after"](
      { callID: "call-2", file_path: "/repo/src/fail.ts" },
      { error: "tool failed" }
    );
    await new Promise((resolve) => setTimeout(resolve, 25));
    await assert.rejects(readFile(capture, "utf8"), /ENOENT/);
  });
});

test("Kilo keeps independent edits to one file inside the dedup window", async () => {
  await withMockCli(async (capture) => {
    const hooks = await plugin.server({ sessionID: "session-3", directory: "/repo" }) as Record<string, any>;
    for (const [callID, added] of [["call-3", 1], ["call-4", 2]] as const) {
      await hooks["tool.execute.before"]({ callID, file_path: "/repo/src/main.ts" });
      await hooks["tool.execute.after"](
        { callID, file_path: "/repo/src/main.ts", tool: "WriteFile" },
        { success: true, lines_added: added, lines_deleted: 0 }
      );
    }
    const lines = (await readFile(capture, "utf8")).trim().split("\n").filter(Boolean);
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map((line) => JSON.parse(line).lines_added), [1, 2]);
  });
});

test("Kilo deduplicates a delayed file.edited callback beyond two seconds", async () => {
  await withMockCli(async (capture) => {
    const hooks = await plugin.server({ sessionID: "session-delayed", directory: "/repo" }) as Record<string, any>;
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      await hooks["tool.execute.before"]({ callID: "call-delayed", file_path: "/repo/src/main.ts" });
      await hooks["tool.execute.after"](
        { callID: "call-delayed", file_path: "/repo/src/main.ts", tool: "WriteFile" },
        { success: true, lines_added: 3, lines_deleted: 1 }
      );
      now += 2_001;
      await hooks.event({
        event: {
          type: "file.edited",
          file_path: "/repo/src/main.ts",
          tool_call_id: "call-delayed",
          lines_added: 3,
          lines_deleted: 1
        }
      });
    } finally {
      Date.now = realNow;
    }
    const lines = (await readFile(capture, "utf8")).trim().split("\n").filter(Boolean);
    assert.equal(lines.length, 1);
  });
});

test("Kilo shell tools use the shared snapshot lifecycle without forwarding command text", async () => {
  await withMockCli(async (_capture, argsCapture) => {
    const hooks = await plugin.server({ sessionID: "session-shell", directory: "/repo", provider: "DeepSeek" }) as Record<string, any>;
    await hooks["tool.execute.before"]({ callID: "shell-1", tool: "bash", cwd: "/repo", args: { command: "secret command" } });
    await hooks["tool.execute.after"](
      { callID: "shell-1", tool: "bash", cwd: "/repo" },
      { success: true, output: "secret output" }
    );
    const args = (await readFile(argsCapture, "utf8")).trim().split("\n");
    assert.deepEqual(args, ["ai tool-before --json", "ai tool-after --json"]);
  });
});

test("Kilo session events persist only bounded lifecycle metadata", async () => {
  await withMockCli(async (_capture, argsCapture) => {
    const hooks = await plugin.server({
      sessionID: "session-lifecycle",
      directory: "/repo",
      provider: "Moonshot AI",
      model: "kimi-k2"
    }) as Record<string, any>;
    await hooks.event({ event: { type: "session.created", session_id: "session-lifecycle" } });
    await hooks.event({ event: { type: "session.updated", session_id: "session-lifecycle" } });
    await hooks.event({ event: { type: "session.idle", session_id: "session-lifecycle" } });
    const args = (await readFile(argsCapture, "utf8")).trim().split("\n");
    assert.deepEqual(args, [
      "ai session-start --json",
      "ai session-start --json",
      "ai session-end --json"
    ]);
  });
});
