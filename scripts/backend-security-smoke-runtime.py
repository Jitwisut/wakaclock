#!/usr/bin/env python3
"""Run security smoke tests with two owned API processes and disposable databases.

Database containers are supplied by the caller. This runner never discovers or loads
production configuration, and terminates only the processes it creates.
"""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--binary', required=True, type=Path)
parser.add_argument('--clickhouse-test-url', required=True)
parser.add_argument('--postgres-test-url', required=True)
args = parser.parse_args()
for url in (args.clickhouse_test_url, args.postgres_test_url):
    if urllib.parse.urlparse(url).hostname not in ('localhost', '127.0.0.1', '::1'):
        parser.error('disposable databases must use loopback URLs')


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


urllib.request.urlopen(urllib.request.Request(args.clickhouse_test_url,
    data=b'CREATE DATABASE IF NOT EXISTS wakaclock'), timeout=10).read()
processes = []
with tempfile.TemporaryDirectory(prefix='wakaclock-security-smoke-') as directory:
    try:
        bases = []
        for index in range(2):
            port = free_port()
            base = f'http://127.0.0.1:{port}'
            env = {
                'PATH': os.environ['PATH'],
                'JWT_SECRET': 'disposable-smoke-test-jwt-secret-only',
                'CLICKHOUSE_URL': args.clickhouse_test_url,
                'CLICKHOUSE_DB': 'wakaclock',
                'POSTGRES_URL': args.postgres_test_url,
                'SERVER_HOST': '127.0.0.1',
                'SERVER_PORT': str(port),
                'RUST_LOG': 'warn',
            }
            log_path = Path(directory) / f'api-{index}.log'
            with log_path.open('w') as log:
                process = subprocess.Popen([str(args.binary.resolve())], env=env,
                    cwd=directory, stdout=log, stderr=log)
            processes.append(process)
            for _ in range(40):
                if process.poll() is not None:
                    raise RuntimeError(f'API startup failed: {log_path.read_text()[-4000:]}')
                try:
                    if urllib.request.urlopen(base + '/health', timeout=2).status == 200:
                        break
                except Exception:
                    time.sleep(1)
            else:
                raise RuntimeError('API readiness deadline exceeded')
            bases.append(base)
        subprocess.run(['python3', str(Path(__file__).with_name('backend-security-smoke.py')),
            '--api-a', bases[0], '--api-b', bases[1], '--postgres-test-url', args.postgres_test_url], check=True)
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
