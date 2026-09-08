#!/usr/bin/env python3
"""Verify shipped VSIX and terminal artifacts before publication.

The verifier reads archives without executing or trusting their contents. It
checks safe archive member names, the embedded CLI manifest, every AI bundle
file and the outer checksum sidecar. A platform binary is never considered
verified merely because it exists; its bytes must match the manifest embedded
in the package.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tarfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

TARGETS = {
    "darwin-x64": "wakaclock",
    "darwin-arm64": "wakaclock",
    "win32-x64": "wakaclock.exe",
    "win32-arm64": "wakaclock.exe",
    "linux-x64": "wakaclock",
    "linux-arm64": "wakaclock",
    "alpine-x64": "wakaclock",
    "alpine-arm64": "wakaclock",
}
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


class ArtifactError(ValueError):
    """A release artifact failed a deterministic safety or integrity check."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _safe_member(name: str) -> None:
    if not name or "\\" in name or "\x00" in name:
        raise ArtifactError(f"unsafe archive member name: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise ArtifactError(f"unsafe archive member path: {name!r}")


def _safe_relative(name: str) -> None:
    _safe_member(name)
    if name.endswith("/"):
        raise ArtifactError(f"directory is not a file: {name!r}")


def _require_hex(value: Any, field: str) -> str:
    if not isinstance(value, str) or not HEX64_RE.fullmatch(value):
        raise ArtifactError(f"{field} must be a lowercase sha256")
    return value


def _load_json(raw: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ArtifactError(f"{label} is not valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ArtifactError(f"{label} must be a JSON object")
    return value


def _bundle_digest(files: dict[str, str]) -> str:
    # generate-ai-bundle-manifest.js uses JSON.stringify(files), with files
    # inserted in sorted traversal order and no whitespace.
    compact = json.dumps(files, separators=(",", ":"), ensure_ascii=False)
    return sha256_bytes(compact.encode("utf-8"))


def _validate_bundle(
    manifest_raw: bytes,
    actual_files: dict[str, bytes],
    *,
    label: str,
    expected_version: str | None = None,
) -> dict[str, Any]:
    manifest = _load_json(manifest_raw, label)
    if manifest.get("schema_version") != 1:
        raise ArtifactError(f"{label} schema_version must be 1")
    bundle_version = manifest.get("bundle_version")
    if not isinstance(bundle_version, str) or not VERSION_RE.fullmatch(bundle_version):
        raise ArtifactError(f"{label} bundle_version is invalid")
    if expected_version is not None and bundle_version != expected_version:
        raise ArtifactError(f"{label} bundle_version {bundle_version} does not match package {expected_version}")
    files = manifest.get("files")
    if not isinstance(files, dict) or not files:
        raise ArtifactError(f"{label} files must be a non-empty object")
    normalized: dict[str, str] = {}
    for relative, digest in files.items():
        if not isinstance(relative, str):
            raise ArtifactError(f"{label} contains a non-string file name")
        _safe_relative(relative)
        if relative == "bundle-manifest.json":
            raise ArtifactError(f"{label} must exclude itself")
        normalized[relative] = _require_hex(digest, f"{label} files.{relative}")
    if set(normalized) != set(actual_files):
        missing = sorted(set(normalized) - set(actual_files))
        extra = sorted(set(actual_files) - set(normalized))
        raise ArtifactError(f"{label} file set mismatch (missing={missing}, extra={extra})")
    for relative, expected_digest in normalized.items():
        actual_digest = sha256_bytes(actual_files[relative])
        if actual_digest != expected_digest:
            raise ArtifactError(f"{label} hash mismatch for {relative}")
    digest = _require_hex(manifest.get("digest"), f"{label} digest")
    if digest != _bundle_digest(normalized):
        raise ArtifactError(f"{label} digest does not match its file map")
    return {"bundle_version": bundle_version, "digest": digest, "file_count": len(normalized)}


def _find_unique(names: Iterable[str], suffix: str, label: str) -> str:
    matches = [name for name in names if name == suffix or name.endswith(f"/{suffix}")]
    if len(matches) != 1:
        raise ArtifactError(f"{label} requires exactly one {suffix}, found {len(matches)}")
    return matches[0]


def _zip_symlink(info: zipfile.ZipInfo) -> bool:
    return ((info.external_attr >> 16) & 0o170000) == 0o120000


def verify_vsix(path: Path) -> dict[str, Any]:
    if not path.is_file() or path.suffix != ".vsix":
        raise ArtifactError(f"VSIX not found: {path}")
    sidecar_digest = _verify_sidecar(path)
    try:
        archive = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as error:
        raise ArtifactError(f"cannot open VSIX {path.name}") from error
    with archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            raise ArtifactError(f"{path.name} contains duplicate archive members")
        for info in infos:
            _safe_member(info.filename)
            if _zip_symlink(info):
                raise ArtifactError(f"{path.name} contains a symlink: {info.filename}")
        package_candidates = [name for name in names if name in {"package.json", "extension/package.json"}]
        if len(package_candidates) != 1:
            raise ArtifactError(f"{path.name} requires exactly one root package.json, found {len(package_candidates)}")
        package_name = package_candidates[0]
        package = _load_json(archive.read(package_name), f"{path.name}/{package_name}")
        package_version = package.get("version")
        if not isinstance(package_version, str) or not VERSION_RE.fullmatch(package_version):
            raise ArtifactError(f"{path.name} package version is invalid")
        cli_manifest_name = _find_unique(names, "resources/cli-manifest.json", path.name)
        bundle_manifest_name = _find_unique(names, "resources/ai-agents/bundle-manifest.json", path.name)
        cli_manifest = _load_json(archive.read(cli_manifest_name), f"{path.name}/{cli_manifest_name}")
        if cli_manifest.get("schemaVersion") != 1 or cli_manifest.get("protocolVersion") != 1:
            raise ArtifactError(f"{path.name} CLI manifest protocol is unsupported")
        target = cli_manifest.get("target")
        if target not in TARGETS:
            raise ArtifactError(f"{path.name} CLI manifest target is unsupported")
        cli_version = cli_manifest.get("cliVersion")
        if cli_version != package_version:
            raise ArtifactError(f"{path.name} CLI version {cli_version} does not match package {package_version}")
        binary = cli_manifest.get("binary")
        expected_binary = TARGETS[target]
        if binary != expected_binary:
            raise ArtifactError(f"{path.name} target {target} requires {expected_binary}")
        binary_name = f"resources/bin/{binary}"
        binary_candidates = [name for name in names if name == binary_name or name.endswith(f"/{binary_name}")]
        if len(binary_candidates) != 1:
            raise ArtifactError(f"{path.name} requires exactly one {binary_name}")
        binary_digest = _require_hex(cli_manifest.get("sha256"), f"{path.name} CLI sha256")
        if sha256_bytes(archive.read(binary_candidates[0])) != binary_digest:
            raise ArtifactError(f"{path.name} embedded CLI hash does not match cli-manifest.json")
        bin_prefix = binary_candidates[0][: -len(binary_name)]
        extra_binaries = [name for name in names if name.startswith(f"{bin_prefix}resources/bin/") and not name.endswith("/") and name != binary_candidates[0]]
        if extra_binaries:
            raise ArtifactError(f"{path.name} contains unexpected CLI binaries: {extra_binaries}")
        bundle_prefix = bundle_manifest_name[: -len("resources/ai-agents/bundle-manifest.json")]
        bundle_root = f"{bundle_prefix}resources/ai-agents/"
        actual_files: dict[str, bytes] = {}
        for name in names:
            info = archive.getinfo(name)
            if name.startswith(bundle_root) and name != bundle_manifest_name and not info.is_dir():
                relative = name[len(bundle_root) :]
                _safe_relative(relative)
                actual_files[relative] = archive.read(name)
        bundle = _validate_bundle(archive.read(bundle_manifest_name), actual_files, label=f"{path.name}/{bundle_manifest_name}", expected_version=package_version)
        return {
            "kind": "vsix",
            "name": path.name,
            "sha256": sidecar_digest or sha256_bytes(path.read_bytes()),
            "target": target,
            "package_version": package_version,
            "cli_sha256": binary_digest,
            "bundle_digest": bundle["digest"],
            "bundle_file_count": bundle["file_count"],
            "checksum_sidecar": sidecar_digest is not None,
        }


def _verify_sidecar(path: Path) -> str | None:
    sidecar = Path(f"{path}.sha256")
    if not sidecar.exists():
        return None
    lines = sidecar.read_text(encoding="utf-8").splitlines()
    if len(lines) != 1:
        raise ArtifactError(f"{sidecar.name} must contain exactly one checksum line")
    parts = lines[0].split()
    if len(parts) != 2 or parts[1] != path.name or not HEX64_RE.fullmatch(parts[0]):
        raise ArtifactError(f"{sidecar.name} has invalid format")
    actual = sha256_bytes(path.read_bytes())
    if actual != parts[0]:
        raise ArtifactError(f"{sidecar.name} does not match {path.name}")
    return parts[0]


def verify_archive(path: Path) -> dict[str, Any]:
    if not path.is_file() or not path.name.endswith(".tar.gz"):
        raise ArtifactError(f"terminal archive not found: {path}")
    sidecar_digest = _verify_sidecar(path)
    try:
        archive = tarfile.open(path, "r:gz")
    except (OSError, tarfile.TarError) as error:
        raise ArtifactError(f"cannot open terminal archive {path.name}") from error
    with archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)):
            raise ArtifactError(f"{path.name} contains duplicate archive members")
        for member in members:
            _safe_member(member.name)
            if member.issym() or member.islnk():
                raise ArtifactError(f"{path.name} contains a symlink: {member.name}")
            if not member.isdir() and not member.isfile():
                raise ArtifactError(f"{path.name} contains an unsupported member: {member.name}")
        if "wakaclock" not in names:
            raise ArtifactError(f"{path.name} is missing wakaclock")
        manifest_name = _find_unique(names, "resources/ai-agents/bundle-manifest.json", path.name)
        prefix = manifest_name[: -len("resources/ai-agents/bundle-manifest.json")]
        root = f"{prefix}resources/ai-agents/"
        actual: dict[str, bytes] = {}
        for member in members:
            if member.name.startswith(root) and member.name != manifest_name and not member.isdir():
                relative = member.name[len(root) :]
                _safe_relative(relative)
                file_handle = archive.extractfile(member)
                if file_handle is None:
                    raise ArtifactError(f"cannot read {member.name}")
                actual[relative] = file_handle.read()
        manifest_member = archive.getmember(manifest_name)
        manifest_handle = archive.extractfile(manifest_member)
        if manifest_handle is None:
            raise ArtifactError(f"cannot read {manifest_name}")
        bundle = _validate_bundle(manifest_handle.read(), actual, label=f"{path.name}/{manifest_name}")
        return {
            "kind": "terminal_archive",
            "name": path.name,
            "sha256": sidecar_digest or sha256_bytes(path.read_bytes()),
            "bundle_version": bundle["bundle_version"],
            "bundle_digest": bundle["digest"],
            "bundle_file_count": bundle["file_count"],
            "checksum_sidecar": sidecar_digest is not None,
        }


def verify_dist(dist: Path, expected_vsix: int | None, expected_archives: int | None) -> dict[str, Any]:
    if not dist.is_dir():
        raise ArtifactError(f"distribution directory not found: {dist}")
    vsix = sorted(dist.rglob("*.vsix"))
    archives = sorted(dist.rglob("*.tar.gz"))
    if expected_vsix is not None and len(vsix) != expected_vsix:
        raise ArtifactError(f"expected {expected_vsix} VSIX files, found {len(vsix)}")
    if expected_archives is not None and len(archives) != expected_archives:
        raise ArtifactError(f"expected {expected_archives} terminal archives, found {len(archives)}")
    results = [verify_vsix(path) for path in vsix] + [verify_archive(path) for path in archives]
    if not results:
        raise ArtifactError("distribution has no VSIX or terminal archives")
    return {"status": "passed", "dist": str(dist), "artifacts": results}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path)
    parser.add_argument("--vsix", type=Path, action="append", default=[])
    parser.add_argument("--archive", type=Path, action="append", default=[])
    parser.add_argument("--expected-vsix", type=int)
    parser.add_argument("--expected-archives", type=int)
    args = parser.parse_args(argv)
    try:
        if args.dist:
            report = verify_dist(args.dist, args.expected_vsix, args.expected_archives)
        else:
            artifacts = [verify_vsix(path) for path in args.vsix] + [verify_archive(path) for path in args.archive]
            if not artifacts:
                raise ArtifactError("provide --dist, --vsix or --archive")
            report = {"status": "passed", "artifacts": artifacts}
    except (ArtifactError, OSError, tarfile.TarError, zipfile.BadZipFile) as error:
        print(json.dumps({"status": "failed", "error": str(error)}, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
