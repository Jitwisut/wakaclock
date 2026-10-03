"""Production Playwright checks with build binding and no zero-test/skip success."""
import json
import subprocess

from evidence_contract import run_evidence
from local_lab import ROOT, REPO, env, private_json
from runtime_binding import preflight


def completed_tests(report):
    tests = []
    def walk(suite):
        for spec in suite.get('specs', []):
            tests.extend(spec.get('tests', []))
        for nested in suite.get('suites', []):
            walk(nested)
    for suite in report.get('suites', []):
        walk(suite)
    return tests


def successful(report):
    tests = completed_tests(report)
    return len(tests) == 2 and not report.get('errors') and all(
        row.get('status') == 'expected' and row.get('expectedStatus') == 'passed'
        and len(row.get('results', [])) == 1 and row['results'][0].get('status') == 'passed'
        for row in tests)


def main():
    build = preflight()
    values = env()
    values['ATOAXIS_RECEIPT_LIVE_TEST'] = '1'
    output = ROOT / 'browser-run-private.json'
    with output.open('w') as log, (ROOT / 'browser-run-private.log').open('w') as errors:
        result = subprocess.run(['npx', 'playwright', 'test', '--config=playwright.receipt.config.ts',
                                 '--reporter=json'], cwd=REPO / 'frontend/app', env=values,
                                stdout=log, stderr=errors, timeout=180)
    output.chmod(0o600)
    report = json.loads(output.read_text())
    passed = result.returncode == 0 and successful(report)
    if preflight() != build:
        raise ValueError('build_changed_during_browser_checks')
    evidence = run_evidence(build, __file__, dict.fromkeys(
        ('evidence_over_25', 'owner_mismatch', 'outcome_withdrawal', 'export_snapshot_privacy'),
        'passed' if passed else 'failed'), sample_count=len(completed_tests(report)),
        evidence_origin='synthetic_integration')
    private_json(ROOT / 'evidence/browser-checks.json', evidence)
    print(json.dumps(evidence))
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
