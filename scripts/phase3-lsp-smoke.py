#!/usr/bin/env python3
"""Process-level smoke for wakaclock-ls: LSP didOpen must reach a fake heartbeat API."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import queue
import select
import subprocess
import sys
import tempfile
import threading
import time


REQUESTS: queue.Queue[dict] = queue.Queue()
DELIVERY_STATUS: queue.Queue[dict] = queue.Queue()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        request = {"path": self.path, "payload": payload, "authorization": self.headers.get("Authorization")}
        # Delivery diagnostics are independent of document activity. Keep unexpected
        # endpoints in REQUESTS so they still fail the heartbeat contract assertions.
        destination = DELIVERY_STATUS if self.path == "/api/v2/me/delivery-status" else REQUESTS
        destination.put(request)
        body = b'{"status":"ok","heartbeats_inserted":1}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *_args):
        pass


def lsp_message(payload: dict) -> bytes:
    body = json.dumps(payload, separators=(",", ":")).encode()
    return f"Content-Length: {len(body)}\r\n\r\n".encode() + body


def read_lsp_message(stream, timeout: float = 5.0) -> dict:
    ready, _, _ = select.select([stream], [], [], timeout)
    if not ready:
        raise TimeoutError("timed out waiting for LSP response")
    headers = {}
    while True:
        line = stream.readline()
        if not line:
            raise RuntimeError("LSP server closed stdout")
        if line in (b"\r\n", b"\n"):
            break
        name, value = line.decode().split(":", 1)
        headers[name.lower()] = value.strip()
    length = int(headers["content-length"])
    return json.loads(stream.read(length))


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    binary = repo / "backend/api/target/debug/wakaclock-ls"
    if sys.platform == "win32":
        binary = binary.with_suffix(".exe")
    if not binary.exists():
        print(f"missing {binary}; run cargo build -p wakaclock-ls first", file=sys.stderr)
        return 2

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with tempfile.TemporaryDirectory() as directory:
        home = Path(directory)
        config_dir = home / ".wakaclock"
        config_dir.mkdir()
        config_dir.joinpath("config.toml").write_text(
            'user_id = "019c91f4-4c3e-7b31-a102-3a5f9d0b7e11"\n'
            f'server_url = "http://127.0.0.1:{server.server_port}"\n'
            'api_key = "wcl_phase3_smoke"\n'
        )
        source = home / "example.rs"
        source.write_text("fn main() {}\n")

        process = subprocess.Popen(
            [str(binary)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={"HOME": str(home), "PATH": str(Path(binary).parent)},
        )
        assert process.stdin is not None
        try:
            process.stdin.write(
                lsp_message(
                    {
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "initialize",
                        "params": {
                            "capabilities": {},
                            "rootUri": source.parent.as_uri(),
                            "processId": None,
                        },
                    }
                )
            )
            process.stdin.flush()
            initialize_response = read_lsp_message(process.stdout)
            assert initialize_response.get("id") == 1, initialize_response
            assert "result" in initialize_response, initialize_response
            sync = initialize_response["result"]["capabilities"].get("textDocumentSync")
            assert isinstance(sync, dict), sync
            assert sync.get("openClose") is True, sync
            assert sync.get("change") == 1, sync  # TextDocumentSyncKind.FULL
            assert sync.get("save") is True, sync
            process.stdin.write(lsp_message({"jsonrpc": "2.0", "method": "initialized", "params": {}}))
            process.stdin.write(
                lsp_message(
                    {
                        "jsonrpc": "2.0",
                        "method": "textDocument/didOpen",
                        "params": {
                            "textDocument": {
                                "uri": source.as_uri(),
                                "languageId": "rust",
                                "version": 1,
                                "text": "fn main() {}\n",
                            }
                        },
                    }
                )
            )
            process.stdin.flush()

            request = REQUESTS.get(timeout=10)
            assert request["path"] == "/api/v1/heartbeats", request
            assert request["authorization"] == "Bearer wcl_phase3_smoke", request
            heartbeat = request["payload"]
            assert heartbeat["entity"] == str(source), heartbeat
            assert heartbeat["editor"] == "Zed", heartbeat
            assert heartbeat["category"] == "coding", heartbeat
            assert heartbeat["language"] == "Rust", heartbeat
            assert heartbeat["is_write"] is False, heartbeat

            # Changes are buffered; they must not produce a request on every keystroke.
            process.stdin.write(
                lsp_message(
                    {
                        "jsonrpc": "2.0",
                        "method": "textDocument/didChange",
                        "params": {
                            "textDocument": {"uri": source.as_uri(), "version": 2},
                            "contentChanges": [{"text": "fn main() {\n    println!(\"saved\");\n}\n"}],
                        },
                    }
                )
            )
            process.stdin.flush()
            try:
                unexpected = REQUESTS.get(timeout=0.25)
            except queue.Empty:
                unexpected = None
            assert unexpected is None, f"didChange sent an immediate heartbeat: {unexpected}"

            # Save must be advertised and must flush the current in-memory document as a write.
            process.stdin.write(
                lsp_message(
                    {
                        "jsonrpc": "2.0",
                        "method": "textDocument/didSave",
                        "params": {"textDocument": {"uri": source.as_uri()}},
                    }
                )
            )
            process.stdin.flush()
            saved = REQUESTS.get(timeout=10)
            saved_heartbeat = saved["payload"]
            assert saved["path"] == "/api/v1/heartbeats", saved
            assert saved_heartbeat["entity"] == str(source), saved_heartbeat
            assert saved_heartbeat["is_write"] is True, saved_heartbeat
            assert saved_heartbeat["lines"] == 3, saved_heartbeat

            delivery = DELIVERY_STATUS.get(timeout=10)
            assert delivery["authorization"] == "Bearer wcl_phase3_smoke", delivery
            assert delivery["payload"]["schema_version"] == 1, delivery
            assert "entity" not in delivery["payload"], delivery

            # Non-file buffers may exist in Zed but must never leave the machine as heartbeats.
            process.stdin.write(
                lsp_message(
                    {
                        "jsonrpc": "2.0",
                        "method": "textDocument/didOpen",
                        "params": {
                            "textDocument": {
                                "uri": "untitled:Untitled-1",
                                "languageId": "rust",
                                "version": 1,
                                "text": "secret scratch buffer",
                            }
                        },
                    }
                )
            )
            process.stdin.flush()
            try:
                unexpected = REQUESTS.get(timeout=0.5)
            except queue.Empty:
                unexpected = None
            assert unexpected is None, f"untitled buffer leaked a heartbeat: {unexpected}"

            process.stdin.write(lsp_message({"jsonrpc": "2.0", "id": 2, "method": "shutdown", "params": None}))
            process.stdin.write(lsp_message({"jsonrpc": "2.0", "method": "exit", "params": None}))
            process.stdin.flush()
            # Delivery-status reports are metadata-only: none of them may carry the file
            # path, not just the first one checked above.
            reports = [delivery]
            while True:
                try:
                    reports.append(DELIVERY_STATUS.get_nowait())
                except queue.Empty:
                    break
            for report in reports:
                assert str(source) not in json.dumps(report["payload"]), report
            print(f"wakaclock-ls process smoke passed ({len(reports)} delivery-status reports)")
            return 0
        finally:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
