"""Explicit reviewed gates with evidence digests; a missing check stays not_run."""
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from local_lab import ROOT, private_json
from build_manifest import file_digest
from evidence_contract import REQUIRED, evidence_errors

NAMES = ('capture_identity', 'retry_revision', 'time_union', 'owner_scope', 'account_deletion',
         'production_browser', 'flag_rollback', 'receipt_limits', 'release_checks')
STATES = ('not_run', 'failed', 'blocked', 'passed')


def report_errors(report, build_hash, root=ROOT):
    if not isinstance(report, dict) or report.get('schema_version') != 3 or report.get('build_manifest_sha256') != build_hash:
        return ['checks_schema_or_build_mismatch']
    if not isinstance(report.get('checks'), dict):
        return ['checks_entries_missing']
    errors = []
    for name in NAMES:
        item = report.get('checks', {}).get(name, {})
        if not isinstance(item, dict) or item.get('status') != 'passed' or item.get('reviewed') is not True:
            errors.append(name + ':not_reviewed_or_passed')
            continue
        reference = item.get('evidence', '')
        errors.extend(name + ':' + reason for reason in evidence_errors(
            {'path': reference, 'sha256': item.get('sha256')}, name, build_hash, root / 'evidence'))
    return errors


def validate_report(report, build_hash, root=ROOT):
    return not report_errors(report, build_hash, root)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', choices=NAMES)
    parser.add_argument('--status', choices=STATES, default='not_run')
    parser.add_argument('--evidence', type=Path)
    parser.add_argument('--reviewed', action='store_true')
    args = parser.parse_args()
    build_hash = file_digest(ROOT / 'evidence/build-manifest.json')
    path = ROOT / 'evidence/checks.json'
    report = json.loads(path.read_text()) if path.exists() else {}
    if report.get('schema_version') != 3 or report.get('build_manifest_sha256') != build_hash:
        if report:
            private_json(ROOT / 'evidence/check-history' / (file_digest(path) + '.json'), report)
        report = {'schema_version': 3, 'build_manifest_sha256': build_hash,
                  'checks': {name: {'status': 'not_run', 'reviewed': False} for name in NAMES}}
    if args.check:
        item = {'status': args.status, 'reviewed': args.reviewed}
        if args.evidence:
            evidence = args.evidence.resolve()
            if not evidence.is_relative_to((ROOT / 'evidence').resolve()):
                raise ValueError('evidence_must_be_local_lab_artifact')
            item.update({'evidence': str(evidence.relative_to(ROOT / 'evidence')),
                         'sha256': file_digest(evidence)})
        if args.status == 'passed' and (not args.reviewed or not args.evidence):
            raise ValueError('passed_requires_reviewed_evidence')
        if args.status == 'passed':
            errors = evidence_errors({'path': item['evidence'], 'sha256': item['sha256']},
                                     args.check, build_hash, ROOT / 'evidence')
            if errors:
                raise ValueError(';'.join(errors))
        report['checks'][args.check] = item
    report['generated_at'] = datetime.now(timezone.utc).isoformat()
    private_json(path, report)
    print(json.dumps({'checks': {k: v['status'] for k, v in report['checks'].items()},
                      'ready': validate_report(report, build_hash),
                      'blockers': report_errors(report, build_hash)}))


if __name__ == '__main__':
    main()
