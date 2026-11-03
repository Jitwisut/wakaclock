import { describe, expect, it, vi } from 'vitest';

import { WakaclockError } from '@/lib/wakaclock/client';
import {
  reportTeamBillingAccessFailure,
  teamBillingRecoveryGuidance,
} from '@/lib/wakaclock/team-billing-recovery';

describe('billing recovery guidance', () => {
  it.each([
    ['network', 'saved request'],
    ['provider_unavailable', 'saved request'],
    ['rate_limited', 'cooldown'],
    ['auth_required', 'administrator'],
    ['permission_required', 'administrator'],
    ['owner_authorization_changed', 'Owner'],
    ['idempotency_window_unconfirmed', 'original creation window'],
    ['customer_not_found_unconfirmed', 'does not prove'],
    ['checkout_not_found_unconfirmed', 'does not prove'],
    ['checkout_session_identity_missing', 'does not prove'],
    ['customer_candidates_ambiguous', 'operator review'],
    ['checkout_candidates_ambiguous', 'operator review'],
    ['checkout_lookup_limit', 'bounded lookup'],
    ['developer_capacity_changed', 'not removed automatically'],
    ['quote_expired_before_attempt', 'expired'],
    ['checkout_scope_changed', 'scope'],
    ['checkout_request_unconfirmed', 'scope'],
    ['provider_scope_mismatch', 'scope'],
    ['subscription_unconfirmed', 'does not activate paid access'],
    ['observation_changed', 'state changed'],
    ['unsupported_contract', 'supported contract'],
  ])('explains the allowed metadata code %s without a payment grant', (code, text) => {
    expect(teamBillingRecoveryGuidance(code)).toContain(text);
  });
  it('does not echo unknown provider text or invent an issue without a code', () => {
    expect(teamBillingRecoveryGuidance(null)).toBeNull();
    expect(teamBillingRecoveryGuidance('')).toBeNull();
    const unsafe = 'PRIVATE_PROVIDER_BODY_CREDENTIAL_MARKER';
    expect(teamBillingRecoveryGuidance(unsafe)).not.toContain(unsafe);
    expect(teamBillingRecoveryGuidance(unsafe)).toContain('needs review');
  });
  it('propagates only session/Owner denial to siblings and never treats a success as reauthorization', async () => {
    const lost = vi.fn();
    const data = { operation: 'same-operation' };
    expect(await reportTeamBillingAccessFailure(Promise.resolve(data), lost)).toBe(data);
    expect(lost).not.toHaveBeenCalled();
    for (const status of [401, 403, 404, 409, 429, 503, null]) {
      lost.mockClear();
      const failure = new WakaclockError('safe failure', status);
      await expect(reportTeamBillingAccessFailure(Promise.reject(failure), lost)).rejects.toBe(
        failure
      );
      expect(lost).toHaveBeenCalledTimes(status === 401 || status === 403 ? 1 : 0);
    }
    lost.mockClear();
    const unknown = new Error('unconfirmed');
    await expect(reportTeamBillingAccessFailure(Promise.reject(unknown), lost)).rejects.toBe(
      unknown
    );
    expect(lost).not.toHaveBeenCalled();
    const denied = new WakaclockError('Owner required', 403);
    await expect(reportTeamBillingAccessFailure(Promise.reject(denied))).rejects.toBe(denied);
  });
});
