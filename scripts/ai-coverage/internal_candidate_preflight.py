#!/usr/bin/env python3
"""Fail closed before native packaging; cross compilation is not native smoke."""
from __future__ import annotations
import argparse
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HOSTS={"darwin-x64":("Darwin","x64","x86_64-apple-darwin"),"darwin-arm64":("Darwin","arm64","aarch64-apple-darwin"),"win32-x64":("Windows","x64","x86_64-pc-windows-msvc"),"win32-arm64":("Windows","arm64","aarch64-pc-windows-msvc")}

def architecture(machine):
    return {"x86_64":"x64","amd64":"x64","arm64":"arm64","aarch64":"arm64"}.get(machine.lower())

def validate(target,system,machine,node_arch,rust_host):
    expected=HOSTS.get(target)
    if expected is None or (system,architecture(machine),rust_host)!=expected or node_arch!=expected[1]:
        raise ValueError("candidate_native_runner_mismatch")

def read(args):
    result=subprocess.run(args,check=True,capture_output=True,text=True,timeout=15)
    if len(result.stdout)>16384:raise ValueError("candidate_toolchain_output_invalid")
    return result.stdout.strip()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target",required=True);parser.add_argument("--commit",required=True);parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    head=read(["git","rev-parse","HEAD"])
    if head!=args.commit or read(["git","status","--porcelain"]):raise ValueError("candidate_source_not_clean")
    node=json.loads(read(["node","-p","JSON.stringify({arch:process.arch,version:process.versions.node})"]))
    rust=read(["rustc","-vV"]);host=next((line.removeprefix("host: ") for line in rust.splitlines() if line.startswith("host: ")),None)
    validate(args.target,platform.system(),platform.machine(),node["arch"],host)
    if sys.version_info<(3,10) or int(node["version"].split('.')[0])<24:raise ValueError("candidate_runtime_prerequisite_missing")
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({"schema_version":1,"source_commit":head,"target":args.target,"checked_at":datetime.now(timezone.utc).isoformat(),"native_runner_preflight":"passed","python":platform.python_version(),"node":node["version"],"rust_host":host,"native_smoke":"pending","live_certification":"pending","production_ready":False},sort_keys=True,indent=2)+'\n')
    print(json.dumps({"status":"native_runner_verified","target":args.target}))
if __name__=='__main__':main()
