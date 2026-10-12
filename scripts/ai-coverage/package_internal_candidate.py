#!/usr/bin/env python3
"""Package a verified VSIX and identical standalone runtime; never publish.

The workflow builds the CLI before generated outputs modify the checkout. This
tool requires its immutable commit stamp and checks package contents directly.
Cross-compiled binaries remain pending native certification.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import struct
import tarfile
import zipfile
from pathlib import Path

from verify_release_artifacts import ArtifactError, verify_vsix, _safe_member

TARGETS = {"darwin-x64", "darwin-arm64", "win32-x64", "win32-arm64"}
REQUIRED_CAPABILITIES = {"editor_durable_ack_v1", "activity_envelope_v3", "persistent_runtime_intent_v1", "editor_receipts_read_v1", "native_producer_spool_v1", "producer_batch_ack_v2", "journal_evidence_read_v1"}
SECRET_PATTERNS = [rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", rb"gh[pousr]_[A-Za-z0-9]{30,}", rb"github_pat_[A-Za-z0-9_]{40,}", rb"sk-(?:proj-|ant-)?[A-Za-z0-9_-]{40,}"]


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_native_target(binary: bytes, target: str) -> None:
    expected = {"darwin-x64": 0x01000007, "darwin-arm64": 0x0100000C, "win32-x64": 0x8664, "win32-arm64": 0xAA64}[target]
    if target.startswith("win32"):
        if len(binary) < 64 or binary[:2] != b"MZ":
            raise ArtifactError("candidate_native_format_invalid")
        offset = struct.unpack_from("<I", binary, 60)[0]
        if offset + 6 > len(binary) or binary[offset:offset+4] != b"PE\0\0":
            raise ArtifactError("candidate_native_format_invalid")
        machine = struct.unpack_from("<H", binary, offset+4)[0]
    else:
        if len(binary) < 8 or binary[:4] not in (b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf"):
            raise ArtifactError("candidate_native_format_invalid")
        machine = struct.unpack_from("<I" if binary[:4] == b"\xcf\xfa\xed\xfe" else ">I", binary, 4)[0]
    if machine != expected:
        raise ArtifactError("candidate_native_architecture_mismatch")


def inspect_members(package: Path, commit: str) -> tuple[dict, dict[str, bytes]]:
    verification = verify_vsix(package)
    with zipfile.ZipFile(package) as archive:
        members = {name: archive.read(name) for name in archive.namelist() if not name.endswith("/")}
    manifest = json.loads(members["extension/resources/cli-manifest.json"])
    if not re.fullmatch(r"[a-f0-9]{40}", commit) or manifest.get("sourceCommit") != commit:
        raise ArtifactError("candidate_source_commit_mismatch")
    if manifest.get("releaseChannel") != "internal" or manifest.get("signing") != "unsigned" or manifest.get("buildProfile") != "release":
        raise ArtifactError("candidate_channel_invalid")
    if manifest.get("target") not in TARGETS or not REQUIRED_CAPABILITIES.issubset(manifest.get("capabilities", [])):
        raise ArtifactError("candidate_capabilities_invalid")
    for name, data in members.items():
        _safe_member(name)
        if any(re.search(pattern, data) for pattern in SECRET_PATTERNS):
            # Never include a matching secret, its prefix or contents in output.
            raise ArtifactError("candidate_sensitive_material_detected")
    compiled = members.get("extension/out/src/extension.js", b"")
    compiled_cli = members.get("extension/out/src/cli.js", b"")
    package_metadata = json.loads(members["extension/package.json"])
    commands = {command.get("command") for command in package_metadata.get("contributes", {}).get("commands", [])}
    if (b"enableJournal" not in compiled or b".runtime(" not in compiled
            or b"acceptJournalBatch" not in compiled_cli or b"heartbeat-batch" not in compiled_cli
            or not {"wakaclock.runtimePause", "wakaclock.runtimeResume"}.issubset(commands)):
        raise ArtifactError("candidate_compiled_extension_incompatible")
    recovery_commands = {"wakaclock.inspectJournal", "wakaclock.prepareJournalRecovery", "wakaclock.applyJournalRecovery", "wakaclock.journalRecoveryHistory"}
    if (not recovery_commands.issubset(commands) or b"registerJournalRecoveryCommands" not in compiled
            or b"applyJournalRecovery" not in members.get("extension/out/src/journalRecovery.js", b"")):
        raise ArtifactError("candidate_journal_recovery_incompatible")
    if "wakaclock.setupRooTracking" in commands:
        if (not {"wakaclock.confirmRooProject", "wakaclock.inspectRooTracking"}.issubset(commands)
                or b"RooBridge" not in members.get("extension/out/src/rooBridge.js", b"")
                or b"retainRooMarker" not in members.get("extension/resources/ai-agents/common/activity-spool.js", b"")
                or "roo_public_task_bridge_v1" not in manifest.get("capabilities", [])):
            raise ArtifactError("candidate_roo_bridge_incompatible")
    if not re.fullmatch(r"[a-f0-9]{64}", manifest.get("sourceTreeDigest", "")):
        raise ArtifactError("candidate_source_inventory_missing")
    compiled_hashes = manifest.get("compiledSha256")
    if not isinstance(compiled_hashes, dict) or not compiled_hashes:
        raise ArtifactError("candidate_compiled_inventory_missing")
    observed_compiled = {name.removeprefix("extension/"): digest(data) for name, data in members.items() if name.startswith("extension/out/src/") and name.endswith(".js")}
    if compiled_hashes != observed_compiled:
        raise ArtifactError("candidate_compiled_hash_mismatch")
    binary = members[f"extension/resources/bin/{manifest['binary']}"]
    verify_native_target(binary, manifest["target"])
    if commit.encode() not in binary or (commit + "-dirty").encode() in binary:
        raise ArtifactError("candidate_embedded_source_commit_mismatch")
    required_binary_capabilities = REQUIRED_CAPABILITIES | ({"roo_public_task_bridge_v1"} if "wakaclock.setupRooTracking" in commands else set())
    if any(capability.encode() not in binary for capability in required_binary_capabilities):
        raise ArtifactError("candidate_embedded_cli_incompatible")
    return {**verification, "source_commit": commit, "manifest": manifest}, members


def verify_standalone(archive_path: Path, expected_files: dict[str, bytes]) -> None:
    if archive_path.suffix == ".zip":
        with zipfile.ZipFile(archive_path) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise ArtifactError("candidate_standalone_duplicate_member")
            actual = {name: archive.read(name) for name in names}
    else:
        with tarfile.open(archive_path) as archive:
            actual = {}
            for member in archive.getmembers():
                _safe_member(member.name)
                if not member.isfile() or member.name in actual:
                    raise ArtifactError("candidate_standalone_invalid_member")
                handle = archive.extractfile(member)
                if handle is None:
                    raise ArtifactError("candidate_standalone_invalid_member")
                actual[member.name] = handle.read()
    for name in actual:
        _safe_member(name)
    if actual != expected_files:
        raise ArtifactError("candidate_standalone_content_mismatch")


def package_candidate(package: Path, commit: str, output: Path) -> Path:
    evidence, members = inspect_members(package, commit)
    manifest = evidence["manifest"]
    output.mkdir(parents=True, exist_ok=True)
    files = {manifest["binary"]: members[f"extension/resources/bin/{manifest['binary']}"]}
    for name, content in members.items():
        if name.startswith("extension/resources/ai-agents/"):
            files[name.removeprefix("extension/")] = content
    files["runtime-manifest.json"] = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    base = f"wakaclock-{manifest['cliVersion']}-{manifest['target']}-{commit[:12]}-internal"
    windows = manifest["target"].startswith("win32-")
    standalone = output / (base + (".zip" if windows else ".tar.gz"))
    if windows:
        with zipfile.ZipFile(standalone, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(files.items()):
                archive.writestr(name, data)
    else:
        with tarfile.open(standalone, "w:gz") as archive:
            for name, data in sorted(files.items()):
                member = tarfile.TarInfo(name)
                member.size = len(data)
                member.mode = 0o755 if name == manifest["binary"] or name.endswith(".sh") else 0o644
                archive.addfile(member, io.BytesIO(data))
    verify_standalone(standalone, files)
    vsix_path = output / package.name
    if vsix_path.resolve() != package.resolve():
        vsix_path.write_bytes(package.read_bytes())
    for artifact in (standalone, vsix_path):
        Path(f"{artifact}.sha256").write_text(f"{digest(artifact.read_bytes())}  {artifact.name}\n")
    verification = {
        "schema_version": 1, "source_commit": commit, "target": manifest["target"],
        "release_channel": "internal", "signing": "unsigned", "build_profile": "release",
        "version": manifest["cliVersion"], "protocol_version": manifest["protocolVersion"],
        "capabilities": manifest["capabilities"], "binary_sha256": manifest["sha256"],
        "bundle_sha256": evidence["bundle_digest"],
        "source_tree_digest": manifest["sourceTreeDigest"], "compiled_sha256": manifest["compiledSha256"],
        "artifacts": {artifact.name: digest(artifact.read_bytes()) for artifact in (standalone, vsix_path)},
        "native_certification": "pending", "live_adapter_certification": "pending",
        "production_ready": False,
    }
    report = output / f"candidate-{manifest['target']}.json"
    report.write_text(json.dumps(verification, sort_keys=True, indent=2) + "\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vsix", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = package_candidate(args.vsix, args.commit, args.output)
    print(json.dumps({"status": "packaged_internal_only", "evidence": str(report)}))


if __name__ == "__main__":
    main()
