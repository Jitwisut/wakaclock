"""Execute release checks and emit build-bound metadata. Raw logs stay in ignored lab state."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import time

from build_manifest import file_digest
from evidence_contract import run_evidence
from local_lab import REPO, ROOT, private_json
from runtime_binding import artifacts_valid, manifest

FRONTEND = REPO / 'frontend/app'
CHECKS = {
    'typecheck': [(FRONTEND, ['npm', 'run', 'typecheck'])],
    'lint': [(FRONTEND, ['npm', 'run', 'lint:strict'])],
    'coverage': [(FRONTEND, ['npm', 'run', 'test:coverage'])],
    'rust': [(REPO, ['cargo', 'test', '--locked', '--offline', '--manifest-path',
                       'backend/api/Cargo.toml', '--workspace'])],
    'python': [(REPO, ['python3', '-m', 'unittest', 'discover', '-s', directory])
               for directory in ('scripts/work-sessions/tests', 'scripts/ai-coverage/tests')],
    'extension': [(REPO / 'extensions/vscode', ['npm', 'run', 'compile']),
                  (REPO / 'extensions/vscode', ['npm', 'test'])],
    'compatibility': [(REPO, ['node', 'scripts/verify-compatibility-manifest.mjs'])],
}


def coverage_values(output):
    values = {}
    for key in ('statements', 'branches', 'functions', 'lines'):
        matches = re.findall(r'^' + key + r'\s+:\s*([\d.]+)%\s*\(\s*(\d+)/(\d+)\s*\)',
                             output, re.MULTILINE | re.IGNORECASE)
        if len(matches) != 1:
            raise ValueError('coverage_summary_missing_or_ambiguous')
        percentage, covered, total = matches[0]
        if int(total) <= 0 or int(covered) > int(total):
            raise ValueError('coverage_counts_invalid')
        # Do not accept a rounded percentage of 100 with uncovered items.
        values[key] = 100 if covered == total else min(float(percentage), 99.999)
    return values


def sample_count(check, output):
    if check == 'python':
        matches = re.findall(r'Ran (\d+) tests?\b', output)
    elif check == 'rust':
        matches = re.findall(r'test result: ok\. (\d+) passed;', output)
    elif check in ('extension', 'coverage'):
        matches = re.findall(r'^\s*Tests\s+(\d+) passed', output, re.MULTILINE)
    else:
        return 1
    return sum(map(int, matches))


def result_for(check, returncodes, outputs):
    output = '\n'.join(outputs)
    count = sample_count(check, output)
    coverage = coverage_values(output) if check == 'coverage' else None
    passed = all(code == 0 for code in returncodes) and count > 0
    if check == 'python':
        passed = passed and len(re.findall(r'Ran (\d+) tests?\b', output)) == len(CHECKS['python'])
    if coverage is not None:
        passed = passed and all(value == 100 for value in coverage.values())
    return 'passed' if passed else 'failed', count, coverage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', choices=CHECKS, action='append')
    args = parser.parse_args()
    data, build = manifest()
    artifacts_valid(data)
    statuses, details, total = {}, [], 0
    coverage = None
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')
    log_root = ROOT / 'release-checks' / stamp
    log_root.mkdir(parents=True, mode=0o700)
    for check in dict.fromkeys(args.check or CHECKS):
        codes, outputs = [], []
        began = time.monotonic()
        for index, (cwd, command) in enumerate(CHECKS[check]):
            path = log_root / f'{check}-{index}.log'
            with path.open('w') as log:
                path.chmod(0o600)
                try:
                    result = subprocess.run(command, cwd=cwd, stdout=log, stderr=subprocess.STDOUT,
                                            timeout=1800, check=False)
                    codes.append(result.returncode)
                except (subprocess.TimeoutExpired, OSError):
                    codes.append(-1)
            outputs.append(path.read_text())
        try:
            status, count, metrics = result_for(check, codes, outputs)
        except ValueError:
            status, count, metrics = 'failed', 0, None
        total += count
        if metrics is not None:
            coverage = metrics
        statuses[check] = status
        detail = {'check': check, 'status': status, 'executed_samples': count,
                  'duration_seconds': round(time.monotonic() - began, 3),
                  'log_sha256': [file_digest(log_root / f'{check}-{i}.log') for i in range(len(outputs))]}
        details.append(detail)
        print(json.dumps(detail), flush=True)
    current, current_hash = manifest()
    artifacts_valid(current)
    if build != current_hash:
        raise ValueError('build_changed_during_release_checks')
    report = run_evidence(build, __file__, statuses, sample_count=total, checks=details,
                          coverage=coverage, generated_at=datetime.now(timezone.utc).isoformat())
    private_json(ROOT / 'evidence' / f'release-checks-{stamp}.json', report)
    raise SystemExit(0 if report['status'] == 'passed' else 1)


if __name__ == '__main__':
    main()
