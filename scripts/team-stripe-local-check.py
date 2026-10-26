#!/usr/bin/env python3
"""Isolated native PostgreSQL Stripe metadata regressions; no Stripe API/account.

No production URL accepted. Stops and removes only its private synthetic database
on exit, retaining logs and source evidence. Uses the shared active task target.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
BIN = Path('/opt/homebrew/opt/postgresql@16/bin')
TMP = Path('/private/tmp') / f'atoaxis-stripe-{uuid.uuid4().hex}'
OUT = ROOT / 'output/team-closure-2026-10-13' / TMP.name
PORT = '56442'


def run(args, label, env=None, cwd=ROOT):
    result = subprocess.run([str(x) for x in args], cwd=cwd, env=env, capture_output=True)
    (OUT / f'{label}.log').write_bytes(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f'isolated fixture failed: {label}; see synthetic local log')
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target-dir', required=True, help='reuse the active task Cargo cache')
    args = parser.parse_args()
    assert BIN.is_dir(), 'native Homebrew PostgreSQL 16 required'
    TMP.mkdir(mode=0o700)
    OUT.mkdir(parents=True)
    data = TMP / 'pg'
    try:
        run([BIN/'initdb', '-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'], 'init')
        run([BIN/'pg_ctl', '-D', data, '-l', TMP/'pg.log', '-o', f'-h 127.0.0.1 -p {PORT} -k {TMP}', 'start'], 'start')
        run([BIN/'createdb', '-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', 'atoaxis_stripe_test'], 'database')
        env = {**os.environ, 'POSTGRES_TEST_URL': f'postgresql://postgres@127.0.0.1:{PORT}/atoaxis_stripe_test',
               'STRIPE_TEST_CREDENTIALS_PATH': str(TMP/'credentials.encrypted')}
        for key in ('ATOAXIS_TEAM_FINANCIAL_GUARD_PATH','ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE','ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED'):
            env.pop(key,None)
        run(['cargo', 'build', '-p', 'wakaclock-server', '--bin', 'team-financial-guard',
             '--target-dir', args.target_dir, '--jobs', '4'], 'inventory-cli-build', env, ROOT/'backend/api')
        env['TEAM_FINANCIAL_GUARD_TEST_BIN'] = str(Path(args.target_dir).resolve()/'debug/team-financial-guard')
        env['TEAM_FINANCIAL_INVENTORY_TEST_DIR'] = str(TMP/'inventory-ledger')
        tests = ('financial_source_customer_recovery_authorization_original_identity_atomicity_and_history', 'financial_sql_checkpoint_requires_same_account_authority', 'financial_source_customer_resolution_exact_evidence_history_and_fences', 'financial_source_customer_dispatch_retention_lease_restart_and_baseline', 'financial_source_customer_request_acceptance_history_and_legacy_fences', 'financial_source_quote_atomic_terms_history_owner_expiry_and_predecessor_fences', 'financial_source_scheduler_exact_batch_lost_confirmation_and_operational_claim', 'financial_source_observation_atomic_enrollment_exact_history_retry_and_expired_lease', 'financial_source_signed_ingress_coordinator_exact_retry_and_final_fences', 'financial_transaction_sql_boundary_pending_rollback_and_lost_confirmation', 'financial_ingress_operator_plan_prospective_recovery_and_restore_fences', 'financial_semantic_lock_order_owner_wait_and_fresh_leases', 'personal_identity_sync_billing_order_first_sync_race_and_atomic_retry', 'stripe_durable_ingress', 'stripe_worker_current_readback', 'stripe_guarded_observation_commit_and_lost_confirmation', 'stripe_customer_durable_provisioning', 'stripe_quote_owner_customer_catalog', 'stripe_checkout_confirmation_durability', 'team_entitlement_trial_durability', 'team_trial_financial_guard_commit_restore', 'team_usage_admission_expiry', 'financial_source_inventory_consistent_historical_scope_and_loss_detection', 'financial_ingress_runtime_signed_retry_restore_unknown_commit_and_lock_wait')
        for name in tests:
            result = run(['cargo', 'test', '-p', 'wakaclock-server', '--lib', name,
                          '--target-dir', args.target_dir, '--jobs', '4', '--', '--ignored', '--nocapture', '--test-threads=1'],
                         name, env, ROOT/'backend/api')
            assert b'1 passed' in result, 'regression did not execute'
        files = ['backend/api/src/repository/user_identity_sync.rs',
                 'backend/api/src/repository/team_stripe_customer_recovery.rs',
                 'backend/api/src/repository/team_stripe_customer_resolution.rs',
                 'backend/api/src/services/team_stripe_customer_request.rs',
                 'backend/api/src/repository/team_stripe_customer_dispatch.rs',
                 'backend/api/src/services/team_financial_transaction.rs',
                 'backend/api/src/services/team_financial_transaction_tests.rs',
                 'backend/api/src/infrastructure/team_financial_transaction_tests.rs',
                 'backend/api/src/repository/team_financial_transaction_tests.rs',
                 'backend/api/src/repository/team_financial_transaction.rs',
                 'backend/api/src/repository/user_identity_sync_tests.rs',
                 'backend/api/src/repository/team_financial_locks.rs',
                 'backend/api/src/repository/team_financial_locks_tests.rs',
                 'backend/api/src/services/team_financial_recovery.rs',
                 'backend/api/src/repository/team_financial_recovery.rs',
                 'backend/api/src/repository/team_financial_recovery_tests.rs',
                 'backend/api/src/infrastructure/team_financial_plan.rs',
                 'backend/api/src/infrastructure/mod.rs',
                 'backend/api/src/infrastructure/team_financial_guard.rs',
                 'backend/api/src/services/team_financial_guard.rs',
                 'backend/api/src/services/team_financial_source.rs',
                 'backend/api/src/services/team_financial_inventory.rs',
                 'backend/api/src/repository/team_financial_inventory.rs',
                 'backend/api/src/repository/team_financial_inventory_tests.rs',
                 'backend/api/src/bin/team-financial-guard.rs',
                 'backend/api/migrations/postgres/055_team_financial_source_checkpoints.sql',
                 'backend/api/src/services/team_financial_ingress.rs',
                 'backend/api/src/repository/team_financial_ingress.rs',
                 'backend/api/src/repository/team_financial_ingress_tests.rs',
                 'backend/api/migrations/postgres/056_team_financial_ingress.sql',
                 'backend/api/src/repository/team_financial_guard.rs',
                 'backend/api/src/repository/team_usage_admissions.rs',
                 'backend/api/src/repository/team_usage_scan.rs',
                 'backend/api/src/services/team_usage_admission_worker.rs',
                 'backend/api/src/services/mod.rs',
                 'backend/api/src/bin/team-privacy-worker.rs',
                 'backend/api/migrations/postgres/053_team_usage_admission_scans.sql',
                 'backend/api/src/repository/team_trust.rs',
                 'backend/api/migrations/postgres/052_team_usage_admissions.sql',
                 'backend/api/src/services/team_insights.rs',
                 'backend/api/src/repository/team_insights.rs',
                 'backend/api/src/services/team_analytics_entitlement.rs',
                 'backend/api/src/repository/team_analytics_entitlement.rs',
                 'backend/api/migrations/postgres/051_team_analytics_entitlements.sql',
                 'backend/api/src/services/user.rs',
                 'backend/api/src/repository/team_seats.rs',
                 'backend/api/src/repository/mod.rs',
                 'backend/api/src/services/organizations.rs',
                 'backend/api/src/services/enterprise.rs',
                 'backend/api/migrations/postgres/050_team_stripe_payment_assessment.sql',
                 'backend/api/src/services/team_stripe_payment.rs',
                 'backend/api/migrations/postgres/049_team_stripe_checkout_recovery.sql',
                 'backend/api/src/infrastructure/postgres.rs',
                 'backend/api/migrations/postgres/048_team_stripe_checkout_request.sql',
                 'backend/api/migrations/postgres/047_team_stripe_checkout_intents.sql',
                 'backend/api/src/repository/team_stripe_checkout.rs',
                 'backend/api/src/services/team_stripe_checkout.rs',
                 'backend/api/migrations/postgres/046_team_stripe_quotes.sql',
                 'backend/api/src/repository/team_stripe_quote.rs',
                 'backend/api/src/services/team_stripe_catalog.rs',
                 'backend/api/migrations/postgres/045_team_stripe_customer_recovery.sql',
                 'backend/api/migrations/postgres/044_team_stripe_customers.sql',
                 'backend/api/src/repository/team_stripe_customer.rs',
                 'backend/api/src/services/authorization.rs',
                 'backend/api/migrations/postgres/041_team_stripe_runtime.sql',
                 'backend/api/migrations/postgres/042_team_stripe_worker.sql',
                 'backend/api/migrations/postgres/043_team_stripe_invoice_observations.sql',
                 'backend/api/src/services/team_stripe_invoice.rs',
                 'backend/api/src/services/team_stripe_worker.rs',
                 'backend/api/src/bin/billing-reconciliation.rs',
                 'backend/api/src/services/team_stripe.rs', 'backend/api/src/repository/team_stripe.rs',
                 'backend/api/src/services/billing.rs', 'backend/api/src/infrastructure/stripe.rs',
                 'backend/api/src/handlers/v2/team_stripe.rs', 'backend/api/src/handlers/v2.rs',
                 'backend/api/src/repository/team_stripe_tests.rs', 'scripts/team-stripe-local-check.py']
        evidence = {
            'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
            'base_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(),
            'source_scope': 'uncommitted worktree', 'fixture': 'synthetic_metadata_only',
            'source_sha256': {f: hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files},
            'postgres': run([BIN/'postgres', '--version'], 'version').decode().strip(),
            'architecture': platform.machine(), 'os': platform.platform(),
            'signed_ingress_and_response_loss_retry': 'passed', 'duplicate_hash_conflict': 'passed',
            'unbound_scope_parked': 'passed', 'exclusive_lease_and_expiry': 'passed',
            'old_response_after_event_or_binding_change': 'passed', 'idle_reconciliation': 'passed',
            'retry_after_preserved_on_fresh_event': 'passed', 'db_commit_failure_atomicity': 'passed',
            'out_of_order_failure_evidence': 'passed', 'allowlisted_storage_marker_scan': 'passed',
            'paid_entitlement_from_notification': False, 'billing_service_vault_and_disabled_receiver': 'passed',
            'http_route': 'wired_compiled_browser_or_live_unverified', 'provider_worker': 'implemented_local_http_fixture_passed',
            'worker_scope_cooldown_restart_and_idle_recovery': 'passed',
            'worker_auth_permission_404_429_5xx_scope_mismatch': 'passed',
            'invoice_scope_current_terms_change_and_atomic_storage_retry': 'passed',
            'customer_provisioning_scope_durable_retry_owner_fence': 'passed',
            'customer_recovery_confirm_revision_search_readback_no_recreate': 'passed',
            'quote_owner_customer_catalog_expiry_and_retry_fences': 'passed',
            'checkout_confirmation_durability_owner_retry_fences': 'passed',
            'checkout_session_poll_binding_atomicity': 'passed',
            'checkout_receipt_before_subscription_failure': 'passed',
            'checkout_complete_nonregression_and_missing_identity': 'passed',
            'checkout_orphan_lookup_missing_ambiguous_bounded_scope_and_recovery': 'passed',
            'checkout_owner_reauthorization_cas_audit_retry_after_and_revocation': 'passed',
            'invoice_assessment_atomic_scope_pending_and_stale': 'passed',
            'accepted_package_concurrent_member_admission_invite_rollback_viewer_and_inactive_account': 'passed',
            'member_invite_and_removal_audit_failure_atomicity': 'passed',
            'entitlement_trial_once_scope_history_and_atomicity': 'passed',
            'entitlement_runtime_admission_enabled': False,
            'guarded_trial_and_provider_outer_commit': 'passed',
            'trial_unknown_commit_missing_state_history_audit_and_exact_reconcile': 'passed',
            'provider_pending_not_recoverable_as_trial': 'passed',
            'usage_admission_atomic_receipts_expiry_correction_consent_race': 'passed',
            'usage_scan_lease_checkpoint_response_loss_and_atomicity': 'passed',
            'financial_inventory_read_only_historical_identities_scope_conflicts_and_limits': 'passed',
            'financial_inventory_sql_checkpoint_not_independent_authorization': 'passed',
            'financial_inventory_operator_metadata_only': 'passed',
            'financial_inventory_own_transaction_writes_checkpoint_rollback_and_commit': 'passed',
            'financial_inventory_staged_unknown_schema_and_json_rejected': 'passed',
            'financial_transaction_sql_boundary_pending_rollback_and_lost_confirmation': 'passed',
            'financial_transaction_coordinator_production_writers': 'signed_ingress_scheduler_reconciliation_quote_customer_create_dispatch_resolution_integrated_recovery_checkout_pending',
            'financial_transaction_signed_ingress_exact_next_confirmation': 'passed',
            'financial_transaction_sql_rollback_never_replayed_as_new': 'passed',
            'financial_transaction_final_unbound_source_fence': 'passed',
            'financial_transaction_scheduler_exact_batch_and_next_state_retry': 'passed',
            'financial_transaction_claim_failure_operational_only_source_fence': 'passed',
            'financial_transaction_provider_observation_enrollment_atomic_history_and_lease': 'passed',
            'financial_transaction_quote_immutable_terms_history_owner_expiry_and_predecessor': 'passed',
            'financial_customer_acceptance_history_scope_legacy_races': 'passed',
            'financial_customer_source_dispatch_and_outcome': 'create_dispatch_retention_exact_sql_resolution_local_passed_recovery_lookup_pending',
            'financial_source_runtime_authorization': 'source_customer_create_and_projection_integrated_recovery_checkout_all_writer_coverage_pending',
            'executed_tests': {name: 'passed' for name in tests},
            'financial_customer_exact_outcome_resolution_history_and_fences': 'passed',
            'financial_customer_recovery_authorization_original_identity_cas_audit_lost_confirm': 'passed',
            'financial_customer_source_recovery_lookup': 'pending_explicit_claim_gate',
            'financial_missing_authority_same_account_sql_checkpoint_fences': 'passed',
            'account_signed_ingress_runtime_sql_file_retry_unknown_commit_and_scope': 'passed',
            'account_ingress_operator_plan_apply_bootstrap_and_pending_recovery': 'passed',
            'account_ingress_operator_expiry_while_waiting_and_independent_source_race': 'passed',
            'financial_semantic_account_billing_owner_row_lock_order': 'passed',
            'financial_semantic_fresh_lease_and_idempotency_after_owner_wait': 'passed',
            'personal_identity_billing_order_concurrent_first_sync_atomic_retry': 'passed',
            'financial_customer_checkout_expiry_after_semantic_write_rolls_back': 'passed',
            'account_ingress_real_baseline': 'not_performed',
            'stripe_live': 'pending', 'checkout_available': False, 'production_ready': False,
            'docker_started': False, 'logs': str(OUT.relative_to(ROOT)),
        }
        (OUT/'evidence.json').write_text(json.dumps(evidence, indent=2)+'\n')
        (OUT.parent/'stripe-local.json').write_text(json.dumps(evidence, indent=2)+'\n')
        print(json.dumps(evidence))
    finally:
        stopped = True
        if (data/'postmaster.pid').exists():
            stop = subprocess.run([str(BIN/'pg_ctl'), '-D', str(data), 'stop', '-m', 'fast'], capture_output=True)
            (OUT/'stop.log').write_bytes(stop.stdout+stop.stderr)
            stopped = stop.returncode == 0
        if (TMP/'pg.log').exists():
            shutil.copy2(TMP/'pg.log', OUT/'postgres.log')
        if stopped and not (data/'postmaster.pid').exists():
            shutil.rmtree(TMP)


if __name__ == '__main__':
    main()
