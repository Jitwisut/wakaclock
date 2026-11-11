import { useEffect, useRef } from 'react';

import { WakaclockError } from './client';

/** A denied child request invalidates sibling billing views until a new Owner
 * check succeeds. This observes failure only; it never grants authorization. */
export async function reportTeamBillingAccessFailure<T>(
  request: Promise<T>,
  onAccessLost?: (error: unknown) => void
): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (isTeamBillingAccessLoss(error)) {
      onAccessLost?.(error);
    }
    throw error;
  }
}

function isTeamBillingAccessLoss(error: unknown): boolean {
  return error instanceof WakaclockError && [401, 403].includes(error.status ?? 0);
}

/** Query variant of `reportTeamBillingAccessFailure`. Queries report from their
 * settled error instead of capturing the callback in `queryFn`, so the query key
 * stays data-only. Each failed fetch yields a new error object and reports once. */
export function useTeamBillingAccessLossReport(
  error: unknown,
  onAccessLost?: (error: unknown) => void
): void {
  const latest = useRef(onAccessLost);
  useEffect(() => {
    latest.current = onAccessLost;
  });
  useEffect(() => {
    if (isTeamBillingAccessLoss(error)) latest.current?.(error);
  }, [error]);
}

/** Closed, metadata-only guidance. Unknown provider text is never echoed here. */
export function teamBillingRecoveryGuidance(code: null | string): null | string {
  if (!code) return null;
  switch (code) {
    case 'network':
    case 'provider_unavailable': {
      return 'The saved request is waiting for a provider connection. Keep the existing operation; the worker can retry after the service recovers.';
    }
    case 'rate_limited': {
      return 'The provider has requested a cooldown. The next eligible check is not a promised completion time; reloading does not bypass the cooldown.';
    }
    case 'auth_required':
    case 'permission_required': {
      return 'A service administrator must repair the provider credentials or permissions. Reload after they are fixed; keep the saved operation.';
    }
    case 'owner_authorization_changed': {
      return 'The previous owner authorization is no longer current. A current organization Owner must review and authorize checking the existing operation.';
    }
    case 'idempotency_window_unconfirmed': {
      return 'The original creation window cannot be confirmed. Use recovery to check the saved operation; do not create a replacement purchase or customer.';
    }
    case 'customer_not_found_unconfirmed':
    case 'checkout_not_found_unconfirmed':
    case 'checkout_session_identity_missing': {
      return 'The existing provider object has not been verified. A missing result does not prove that creation never happened; check the saved operation.';
    }
    case 'customer_candidates_ambiguous':
    case 'checkout_candidates_ambiguous': {
      return 'Several or conflicting provider matches need operator review. The system will not choose a replacement automatically.';
    }
    case 'checkout_lookup_limit': {
      return 'The bounded lookup could not establish a unique result. Ask a service administrator to review the saved operation; keep its original identity.';
    }
    case 'developer_capacity_changed': {
      return 'The current developer seats no longer fit the saved package. Review seats and package terms before continuing; members are not removed automatically.';
    }
    case 'quote_expired_before_attempt': {
      return 'The price preview expired before creation could start. Reload status and review the existing request before requesting an updated price.';
    }
    case 'checkout_scope_changed':
    case 'checkout_request_unconfirmed':
    case 'provider_scope_mismatch': {
      return 'The saved request or provider scope could not be confirmed. Reload status and request operator review if the problem remains; saved purchase terms are not rewritten.';
    }
    case 'subscription_unconfirmed': {
      return 'Subscription or payment evidence is still unconfirmed. Checking an existing Checkout does not activate paid access.';
    }
    case 'observation_changed': {
      return 'The provider state changed during verification. Keep the existing operation and reload after its next eligible check.';
    }
    case 'unsupported_contract': {
      return 'The provider response is outside the supported contract. A service administrator must review compatibility before this operation can continue.';
    }
    default: {
      return 'This saved operation needs review. Reload its status and contact a service administrator if it remains unconfirmed.';
    }
  }
}
