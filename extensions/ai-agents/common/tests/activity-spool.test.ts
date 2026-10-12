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
  const root = join(home, ".wakaclock/native-producer-spool/unconfirmed"); assert.equal(readdirSync(root).length, 2);
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
  assert.equal(readdirSync(join(home,".wakaclock/native-producer-spool", "a".repeat(64))).length,2);
 } finally {rmSync(home,{recursive:true,force:true});}
});


test("fixed owner binding cannot be overwritten by the currently configured foreign account", async () => {
 const { retainMetadata } = await import("../activity-spool.ts");
 const home = mkdtempSync(join(tmpdir(), "producer-owner-"));
 try {
  const bindings = join(home, ".wakaclock/native-producer-bindings");
  mkdirSync(bindings, {recursive:true});
  const binding = join(bindings, "kilo-code-ide.json");
  writeFileSync(binding, JSON.stringify({scope_id:"a".repeat(64),owner_fixed:true}));
  const calls = join(home, "calls");
  const cli = join(home, "foreign-cli");
  writeFileSync(cli, `#!/bin/sh\nprintf '%s\n' "$*" >> '${calls}'\nif [ "$1" = journal-scope ]; then printf '{"schema_version":1,"owner_confirmed":true,"scope_id":"${"b".repeat(64)}","capabilities":["activity_envelope_v3"]}'; fi\n`);
  chmodSync(cli, 0o700);
  const marker = await retainToolMarker(cli, input, home);
  const metadata = await retainMetadata(cli, {adapter:"kilo-code",surface:"ide",kind:"session_end",metadata:{session_id:"fixture",agent:"kilo-code"}}, home);
  assert.equal(marker?.observation.scope_id,"a".repeat(64));
  assert.equal(metadata?.record.scope_id,"a".repeat(64));
  assert.equal(JSON.parse(readFileSync(binding,"utf8")).scope_id,"a".repeat(64));
  assert.ok(!readFileSync(calls,"utf8").includes("journal-scope"));
  assert.equal(readdirSync(join(home,".wakaclock/native-producer-spool","a".repeat(64))).length,4);
 } finally {rmSync(home,{recursive:true,force:true});}
});

test("context freezes before a CLI handshake can change the active branch", async () => {
 const {execFileSync}=await import("node:child_process");
 const home=mkdtempSync(join(tmpdir(),"producer-context-boundary-"));
 try {
  const root=join(home,"repo");mkdirSync(root);
  execFileSync("git",["-C",root,"init","-q","--initial-branch=original"]);
  execFileSync("git",["-C",root,"remote","add","origin","https://github.com/o/r.git"]);
  const cli=join(home,"fixture-cli");
  writeFileSync(cli,`#!/usr/bin/env node\nconst {execFileSync}=require('node:child_process');\nif(process.argv[2]==='journal-scope') execFileSync('git',['-C',${JSON.stringify(root)},'symbolic-ref','HEAD','refs/heads/changed-by-handshake']);\nconsole.log(JSON.stringify({schema_version:1,owner_confirmed:true,scope_id:'${"a".repeat(64)}',capabilities:['activity_envelope_v3']}));\n`);chmodSync(cli,0o700);
  await retainToolMarker(cli,{...input,directory:root},home);
  const records=readdirSync(join(home,".wakaclock/native-producer-spool","a".repeat(64))).map(file=>JSON.parse(readFileSync(join(home,".wakaclock/native-producer-spool","a".repeat(64),file),"utf8")));
  const context=records.find(record=>record.kind==='session_context');assert.equal(context.metadata.branch,"original");
  assert.equal(context.metadata.repository,"o/r");
 } finally {rmSync(home,{recursive:true,force:true});}
});

test("Roo retains project-unresolved observations and does not borrow a later mapping", async()=>{
 const {retainRooMarker,confirmRooProject}=await import("../activity-spool.ts");
 const home=mkdtempSync(join(tmpdir(),"roo-project-ภาษาไทย-"));const profile={scope_id:"a".repeat(64),cli_path:"missing"};
 try {
  const root=join(home,"repo");mkdirSync(root);const {execFileSync}=await import("node:child_process");execFileSync("git",["-C",root,"init","-q"]);execFileSync("git",["-C",root,"remote","add","origin","https://github.com/o/r.git"]);const first=retainRooMarker(profile,"task","taskStarted",home);
  assert.ok(first);assert.equal(first.record.metadata.project_root,undefined);
  const original=readFileSync(first.file,"utf8");const mapping=confirmRooProject(profile,"task",root,home);
  assert.equal(mapping.provenance,"user_confirmed");assert.equal(mapping.revision,1);
  assert.throws(()=>confirmRooProject(profile,"task",root,home),/revision_conflict/);
  assert.equal(readFileSync(first.file,"utf8"),original);
  const next=retainRooMarker(profile,"task","taskToolFailed",home);assert.equal(next?.record.metadata.project_root,root);
  const files=join(home,".wakaclock/native-producer-spool",profile.scope_id);
  const contexts=readdirSync(files).map(file=>JSON.parse(readFileSync(join(files,file),"utf8"))).filter(record=>record.kind==="session_context");
  assert.ok(contexts.some(record=>record.metadata.project_provenance==="user_confirmed" && record.metadata.project_effective_at===mapping.effective_at));
  const delayed=retainRooMarker(profile,"task","taskStarted",home,"2020-01-01T00:00:00Z");assert.equal(delayed?.record.metadata.project_root,undefined);
  const history=confirmRooProject(profile,"task",root,home,1);assert.equal(history.revision,2);
  assert.throws(()=>retainRooMarker({...profile,scope_id:"invalid"},"task","taskStarted",home),/contract_invalid/);
  mkdirSync(join(home,".wakaclock"),{recursive:true});writeFileSync(join(home,".wakaclock/runtime-desired.json"),JSON.stringify({schema_version:1,desired:{capture:false}}));
  assert.equal(retainRooMarker(profile,"task","taskStarted",home),undefined);
 }finally{rmSync(home,{recursive:true,force:true});}
});
