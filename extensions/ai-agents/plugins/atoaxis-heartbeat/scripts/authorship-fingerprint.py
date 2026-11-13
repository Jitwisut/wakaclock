#!/usr/bin/env python3
"""Read a bounded, stable UTF-8 file at the tool boundary. Print only its hash."""
import hashlib
import json
import os
import stat
import sys

MAX_BYTES = 512 * 1024


def signature(info):
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns


def expected_text(payload):
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return None
    result = payload.get("tool_response")
    result = result if isinstance(result, dict) else {}
    if result.get("userModified"):
        raise ValueError("tool output was edited")
    if payload.get("tool_name") == "Write":
        return tool_input.get("content")
    original = result.get("originalFile")
    if payload.get("tool_name") == "Edit" and isinstance(original, str):
        old, new = tool_input.get("old_string"), tool_input.get("new_string")
        replace_all = tool_input.get("replace_all", False)
        if not isinstance(old, str) or not old or not isinstance(new, str):
            return None
        if not isinstance(replace_all, bool):
            return None
        occurrences = original.count(old)
        if occurrences == 0 or (not replace_all and occurrences != 1):
            return None
        return original.replace(old, new, -1 if replace_all else 1)
    return None


def fingerprint(path, expected):
    if not isinstance(expected, str):
        return None
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as file:
        before = os.fstat(file.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_BYTES:
            return None
        data = file.read(MAX_BYTES + 1)
        after = os.fstat(file.fileno())
        current = os.stat(path, follow_symlinks=False)
    if len(data) != before.st_size or b"\x00" in data:
        return None
    if signature(before) != signature(after) or signature(after) != signature(current):
        return None
    # VS Code strips the UTF-8 BOM before returning the document text. Refuse
    # mixed representations rather than matching against a different version.
    if data.startswith(b"\xef\xbb\xbf"):
        return None
    text = data.decode("utf-8")
    if text != expected:
        return None
    return "sha256:" + hashlib.sha256(data).hexdigest()


if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        expected = expected_text(json.loads(raw)) if raw else None
        result = fingerprint(sys.argv[1], expected)
        if result is not None:
            print(result)
    except (OSError, ValueError, AttributeError):
        pass
