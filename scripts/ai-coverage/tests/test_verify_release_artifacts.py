#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_release_artifacts import ArtifactError, sha256_bytes, verify_archive, verify_vsix  # noqa: E402


def bundle_files() -> dict[str, bytes]:
    return {
        "common/emit-event.sh": b"#!/bin/sh\nprintf ok\n",
        "kilo-code/package.json": b'{"name":"kilo-code"}\n',
        "README.md": b"metadata-only\n",
    }


def bundle_manifest(files: dict[str, bytes], version: str = "0.1.0") -> bytes:
    hashes = {name: hashlib.sha256(content).hexdigest() for name, content in files.items()}
    digest = hashlib.sha256(json.dumps(hashes, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    return (json.dumps({"schema_version": 1, "bundle_version": version, "files": hashes, "digest": digest}, indent=2) + "\n").encode()


def create_vsix(path: Path, *, target: str = "darwin-arm64", tamper_binary: bool = False, extra_file: bool = False, unsafe: bool = False) -> None:
    binary_name = "wakaclock.exe" if target.startswith("win32-") else "wakaclock"
    binary = b"fake native cli\n"
    cli_digest = sha256_bytes(binary)
    files = bundle_files()
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("extension/package.json", json.dumps({"version": "0.1.0"}))
        archive.writestr(
            "extension/resources/cli-manifest.json",
            json.dumps({"schemaVersion": 1, "cliVersion": "0.1.0", "protocolVersion": 1, "target": target, "binary": binary_name, "sha256": cli_digest}),
        )
        archive.writestr(f"extension/resources/bin/{binary_name}", b"tampered\n" if tamper_binary else binary)
        for name, content in files.items():
            archive.writestr(f"extension/resources/ai-agents/{name}", content)
        archive.writestr("extension/resources/ai-agents/bundle-manifest.json", bundle_manifest(files))
        if extra_file:
            archive.writestr("extension/resources/ai-agents/extra.txt", b"not in manifest")
        if unsafe:
            archive.writestr("extension/../escape.txt", b"unsafe")


def create_archive(path: Path, *, tamper_checksum: bool = False) -> None:
    files = bundle_files()
    manifest = bundle_manifest(files)
    with tarfile.open(path, "w:gz") as archive:
        cli = tarfile.TarInfo("wakaclock")
        cli_data = b"fake native cli\n"
        cli.size = len(cli_data)
        archive.addfile(cli, __import__("io").BytesIO(cli_data))
        for name, content in files.items():
            member = tarfile.TarInfo(f"resources/ai-agents/{name}")
            member.size = len(content)
            archive.addfile(member, __import__("io").BytesIO(content))
        member = tarfile.TarInfo("resources/ai-agents/bundle-manifest.json")
        member.size = len(manifest)
        archive.addfile(member, __import__("io").BytesIO(manifest))
    digest = sha256_bytes(path.read_bytes())
    if tamper_checksum:
        digest = "0" * 64
    path.with_name(f"{path.name}.sha256").write_text(f"{digest}  {path.name}\n", encoding="utf-8")


class ReleaseArtifactVerifierTest(unittest.TestCase):
    def test_valid_vsix_checks_embedded_cli_and_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "atoaxis-vscode-darwin-arm64.vsix"
            create_vsix(path)
            report = verify_vsix(path)
            self.assertEqual(report["target"], "darwin-arm64")
            self.assertEqual(report["bundle_file_count"], 3)

    def test_vsix_checksum_sidecar_is_verified_when_present(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "atoaxis-vscode-darwin-arm64.vsix"
            create_vsix(path)
            path.with_name(f"{path.name}.sha256").write_text(
                f"{sha256_bytes(path.read_bytes())}  {path.name}\n", encoding="utf-8"
            )
            report = verify_vsix(path)
            self.assertTrue(report["checksum_sidecar"])

    def test_vsix_checksum_sidecar_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "atoaxis-vscode-darwin-arm64.vsix"
            create_vsix(path)
            path.with_name(f"{path.name}.sha256").write_text(
                f"{'0' * 64}  {path.name}\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(ArtifactError, "does not match"):
                verify_vsix(path)

    def test_tampered_cli_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.vsix"
            create_vsix(path, tamper_binary=True)
            with self.assertRaisesRegex(ArtifactError, "CLI hash"):
                verify_vsix(path)

    def test_extra_bundle_file_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.vsix"
            create_vsix(path, extra_file=True)
            with self.assertRaisesRegex(ArtifactError, "file set mismatch"):
                verify_vsix(path)

    def test_unsafe_zip_member_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.vsix"
            create_vsix(path, unsafe=True)
            with self.assertRaisesRegex(ArtifactError, "unsafe archive member"):
                verify_vsix(path)

    def test_valid_terminal_archive_and_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wakaclock-0.1.0-darwin-arm64.tar.gz"
            create_archive(path)
            report = verify_archive(path)
            self.assertTrue(report["checksum_sidecar"])
            self.assertEqual(report["bundle_file_count"], 3)

    def test_tampered_terminal_checksum_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wakaclock-0.1.0-darwin-arm64.tar.gz"
            create_archive(path, tamper_checksum=True)
            with self.assertRaisesRegex(ArtifactError, "does not match"):
                verify_archive(path)


if __name__ == "__main__":
    unittest.main()
