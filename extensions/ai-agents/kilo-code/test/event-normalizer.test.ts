import test from "node:test";
import assert from "node:assert/strict";
import { extractFileChange, stableEventId } from "../src/event-normalizer.ts";
import { normalizeModel, normalizeProvider } from "../src/provider-identity.ts";

test("keeps Kilo client separate from DeepSeek provider", () => {
  const event = extractFileChange({
    event_id: "call:file",
    session_id: "s1",
    tool_call_id: "call1",
    file_path: "/repo/src/main.ts",
    provider: "DeepSeek API",
    model: "deepseek-v4-pro",
    change_kind: "modify",
    lines_added: 4,
    lines_deleted: 1,
    prompt: "must never be copied"
  }, { directory: "/repo" });
  assert.deepEqual(event, {
    client_id: "kilo-code",
    provider_id: "deepseek",
    model_id: "deepseek-v4-pro",
    event_id: "call:file",
    session_id: "s1",
    tool_call_id: "call1",
    occurred_at: event?.occurred_at,
    project_root: "/repo",
    entity: "/repo/src/main.ts",
    previous_entity: undefined,
    change_kind: "modify",
    lines_added: 4,
    lines_deleted: 1,
    source: "agent_hook",
    confidence: "verified",
    transport: "native_plugin",
    tool: undefined,
    active_seconds: undefined
  });
});

test("stable IDs differ by file but remain deterministic", () => {
  const a = stableEventId({ sessionId: "s", toolCallId: "t", entity: "/a", changeKind: "modify", occurredAt: "2026-01-01T00:00:00Z" });
  const b = stableEventId({ sessionId: "s", toolCallId: "t", entity: "/b", changeKind: "modify", occurredAt: "2026-01-01T00:00:00Z" });
  assert.match(a, /^ape1:[0-9a-f]{40}$/);
  assert.notEqual(a, b);
  assert.equal(a, stableEventId({ sessionId: "s", toolCallId: "t", entity: "/a", changeKind: "modify", occurredAt: "2026-01-01T00:00:00Z" }));
});

test("provider/model normalization rejects content-like values", () => {
  assert.equal(normalizeProvider("Moonshot AI"), "moonshot");
  assert.equal(normalizeProvider("DeepSeek"), "deepseek");
  assert.equal(normalizeModel("deepseek-v4"), "deepseek-v4");
  assert.equal(normalizeModel("model with prompt"), undefined);
});

test("provider and model objects use only their bounded identity labels", () => {
  const event = extractFileChange({
    session_id: "s2",
    tool_call_id: "call2",
    file_path: "/repo/src/object.ts",
    provider: { id: "DeepSeek", secret: "must not be read" },
    model: { name: "deepseek-v4-pro", prompt: "must not be read" },
    lines_added: 1
  }, { directory: "/repo" });
  assert.equal(event?.provider_id, "deepseek");
  assert.equal(event?.model_id, "deepseek-v4-pro");
});

test("missing file path is controlled and does not guess", () => {
  assert.equal(extractFileChange({ tool: "write", content: "secret" }), undefined);
});
