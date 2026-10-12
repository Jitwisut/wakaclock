import {mkdtempSync,rmSync,readFileSync,existsSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";import path from "node:path";
import {describe,it,expect} from "vitest";
const {copyAiAgents}=require("../scripts/copy-ai-agents.js");
describe("isolated AI resources",()=>{it("ships the shared durable spool as CommonJS without a sibling runtime dependency",()=>{
 const root=mkdtempSync(path.join(tmpdir(),"atoaxis-ai-bundle-"));
 try {const target=path.join(root,"ai-agents");copyAiAgents(path.resolve(__dirname,"../../ai-agents"),target);
  const shared=require(path.join(target,"common","activity-spool.js"));expect(typeof shared.retainRooMarker).toBe("function");expect(typeof shared.confirmRooProject).toBe("function");
  expect(readFileSync(path.join(target,"common","activity-spool.js"),"utf8")).toContain("roo_mapping_revision_conflict");
  expect(existsSync(path.join(target,"common","__pycache__"))).toBe(false);expect(readdirSync(target)).not.toContain("node_modules");
 }finally{rmSync(root,{recursive:true,force:true});}
});});
