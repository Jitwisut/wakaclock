import test from "node:test";
import assert from "node:assert/strict";
import { server, setup } from "../src/plugin.ts";
test("v1 projects only verified identity and metadata", async () => {
 const calls: any[] = []; const plugin = await server({ directory: "/fixture/repo" }, async (...args: any[]) => { calls.push(args); return undefined; });
 await plugin["tool.execute.before"]({ sessionID: "session", callID: "tool", args: "SENSITIVE", output: "SENSITIVE" });
 await plugin["tool.execute.after"]({ sessionID: "session", callID: "tool", args: "SENSITIVE" });
 assert.equal(calls.length, 2); assert.equal(calls[0][1].sessionId, "session"); assert.ok(!JSON.stringify(calls).includes("SENSITIVE"));
});
test("v2 uses native id and actual session location, never plugin location", async () => {
 const hooks: Record<string, any> = {}, calls: any[] = [];
 await setup({ location: { directory: "/wrong/plugin-location" }, tool: { hook: async (name: string, fn: any) => { hooks[name] = fn; } }, session: { get: async ({sessionID}: any) => ({ id: sessionID, location: { directory: "/fixture/actual-session" }, title: "SENSITIVE" }) } }, async (...args: any[]) => { calls.push(args); return undefined; });
 await hooks["execute.before"]({ sessionID: "session", id: "native-id", input: "SENSITIVE" });
 await hooks["execute.after"]({ sessionID: "session", id: "native-id", status: "error", error: { message: "SENSITIVE" } });
 assert.equal(calls.length, 2); assert.equal(calls[0][1].callId, "native-id"); assert.equal(calls[0][1].directory, "/fixture/actual-session"); assert.equal(calls[1][1].phase, "failure"); assert.ok(!JSON.stringify(calls).includes("SENSITIVE"));
});
test("unknown identity/schema and missing session location cannot create activity", async () => {
 const hooks: Record<string, any> = {}, calls: any[] = [];
 await setup({ tool: { hook: async (name: string, fn: any) => { hooks[name] = fn; } }, session: { get: async () => ({ id: "other" }) } }, async (...args: any[]) => { calls.push(args); return undefined; });
 await hooks["execute.before"]({ sessionID: "session", id: "call" });
 await hooks["execute.after"]({ sessionID: "session", id: "call", status: "unknown" });
 assert.equal(calls.length, 1); assert.equal(calls[0][1].directory,undefined); assert.equal(calls[0][1].callId,"call"); assert.ok(calls[0][1].observedAt);
 await assert.rejects(setup({}), /incompatible/);
});

test("stalled session lookup retains original native observation without guessing project", async () => {
 const hooks: Record<string, any> = {}, calls: any[] = [];
 await setup({ tool: { hook: async (name: string, fn: any) => { hooks[name] = fn; } }, session: { get: () => new Promise(() => {}) } }, async (...args: any[]) => { calls.push(args); return undefined; }, 20);
 const before = Date.now();
 await hooks["execute.before"]({ sessionID: "native-session", id: "native-call" });
 assert.equal(calls.length, 1);
 assert.equal(calls[0][1].sessionId, "native-session");
 assert.equal(calls[0][1].directory, undefined);
 assert.ok(Date.parse(calls[0][1].observedAt) >= before);
 assert.ok(Date.parse(calls[0][1].observedAt) < before + 20);
});
