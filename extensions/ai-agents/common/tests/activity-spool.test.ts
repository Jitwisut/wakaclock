import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { retainToolMarker } from "../activity-spool.ts";
const input = { adapter: "kilo-code", surface: "ide", phase: "before", sessionId: "fixture", callId: "call", directory: "/fixture/project" } as const;
test("retains a scoped marker before missing CLI and preserves observation identity for idle recovery", async () => {
 const home = mkdtempSync(join(tmpdir(), "producer-fixture-"));
 try {
  mkdirSync(join(home, ".wakaclock/native-producer-bindings"), { recursive: true });
  writeFileSync(join(home, ".wakaclock/native-producer-bindings/kilo-code-ide.json"), JSON.stringify({ scope_id: "a".repeat(64) }));
  const retained = await retainToolMarker(join(home, "missing-cli"), input, home);
  assert.ok(retained); assert.deepEqual(JSON.parse(readFileSync(retained.file, "utf8")), retained.observation);
  assert.ok(retained.observation.observed_at); assert.ok(!("timestamp" in retained.observation.metadata));
 } finally { rmSync(home, { recursive: true, force: true }); }
});
test("unknown ownership is durable but remains parked without claiming acceptance", async () => {
 const home = mkdtempSync(join(tmpdir(), "producer-unconfirmed-"));
 try {
  await assert.rejects(retainToolMarker(join(home, "missing-cli"), input, home), /scope_unconfirmed_retained/);
  const root = join(home, ".wakaclock/native-producer-spool/unconfirmed"); assert.equal(readdirSync(root).length, 1);
 } finally { rmSync(home, { recursive: true, force: true }); }
});
test("persisted pause prevents spooling even when CLI is unavailable", async () => {
 const home = mkdtempSync(join(tmpdir(), "producer-paused-"));
 try {
  mkdirSync(join(home, ".wakaclock")); writeFileSync(join(home, ".wakaclock/runtime-desired.json"), JSON.stringify({ schema_version: 1, desired: { capture: false }, intervals: [] }));
  assert.equal(await retainToolMarker(join(home, "missing-cli"), input, home), undefined);
  assert.deepEqual(readdirSync(join(home, ".wakaclock")), ["runtime-desired.json"]);
 } finally { rmSync(home, { recursive: true, force: true }); }
});

test("legacy metadata is spooled with immutable hash/time; contents cannot cross the contract", async () => {
 const { retainMetadata, canonicalMetadata } = await import("../activity-spool.ts");
 const { createHash } = await import("node:crypto");
 const home = mkdtempSync(join(tmpdir(), "producer-metadata-"));
 try {
  mkdirSync(join(home, ".wakaclock/native-producer-bindings"), {recursive:true});
  writeFileSync(join(home, ".wakaclock/native-producer-bindings/kilo-code-cli.json"), JSON.stringify({scope_id:"a".repeat(64)}));
  const input = {adapter:"kilo-code",surface:"cli",kind:"session_end",metadata:{session_id:"session",agent:"kilo-code",cwd:"/fixture"},observedAt:"2026-10-07T01:18:09Z"} as const;
  const retained = await retainMetadata(join(home,"missing-cli"), input, home);
  assert.ok(retained); const record = JSON.parse(readFileSync(retained.file,"utf8"));
  assert.equal(record.observed_at, input.observedAt); assert.equal(record.metadata.occurred_at,input.observedAt);
  assert.equal(record.payload_hash,createHash("sha256").update(canonicalMetadata(record.metadata)).digest("hex"));
  await assert.rejects(retainMetadata(join(home,"missing-cli"), {...input, metadata:{...input.metadata,prompt:"SECRET"}}, home), /metadata_invalid/);
  assert.equal(readdirSync(join(home,".wakaclock/native-producer-spool", "a".repeat(64))).length,1);
 } finally {rmSync(home,{recursive:true,force:true});}
});
