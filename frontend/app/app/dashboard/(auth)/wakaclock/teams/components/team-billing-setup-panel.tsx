'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  getTeamCustomer,
  prepareTeamCustomer,
  recoverTeamCustomer,
} from '@/lib/wakaclock/team-billing-endpoints';
import {
  reportTeamBillingAccessFailure,
  teamBillingRecoveryGuidance,
} from '@/lib/wakaclock/team-billing-recovery';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import {
  TeamBillingOwnerBoundary,
  useTeamBillingOwnerBoundary,
} from './team-billing-owner-boundary';
import { TeamCancellationPanel } from './team-cancellation-panel';
import { TeamCheckoutStatusPanel } from './team-checkout-status-panel';
import { TeamPortalLink } from './team-portal-link';
import { TeamPriceQuotePanel } from './team-price-quote-panel';
import { TeamTrialPanel } from './team-trial-panel';

export function TeamBillingSetupPanel({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  return (
    <TeamBillingOwnerBoundary key={`${userId}:${organizationId}`}>
      <TeamTrialPanel organizationId={organizationId} userId={userId} />
      <BillingScope organizationId={organizationId} userId={userId} />
    </TeamBillingOwnerBoundary>
  );
}
function BillingScope({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const boundary = useTeamBillingOwnerBoundary();
  const reportAccessFailure = boundary.report;
  const [ownerObservation, setOwnerObservation] = useState(0);
  const reportedError = useRef<unknown>(null);
  const onAccessLost = useCallback(
    (error: unknown) => {
      setConfirmed('');
      reportAccessFailure(error);
    },
    [reportAccessFailure]
  );
  const client = useQueryClient();
  const key = wakaclockKeys.teamBillingCustomer(userId, organizationId);
  const status = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const result = await getTeamCustomer(organizationId, signal);
      // A monotonic local observation avoids reusing a confirmation when two
      // successful checks share a millisecond or the wall clock moves backward.
      setOwnerObservation((n) => n + 1);
      return result;
    },
    enabled: open && Boolean(userId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: open ? 15_000 : false,
  });
  useEffect(() => {
    if (status.error !== reportedError.current) {
      reportedError.current = status.error;
      if (status.error instanceof WakaclockError && [401, 403].includes(status.error.status ?? 0)) {
        onAccessLost(status.error);
      }
    }
  }, [status.error, onAccessLost]);
  const change = useMutation({
    mutationFn: async (
      action: { kind: 'prepare' } | { kind: 'recover'; operation: string; revision: number }
    ) => {
      if (action.kind === 'prepare') {
        await reportTeamBillingAccessFailure(prepareTeamCustomer(organizationId), onAccessLost);
      } else {
        await reportTeamBillingAccessFailure(
          recoverTeamCustomer(organizationId, action.operation, action.revision),
          onAccessLost
        );
      }
    },
    onSuccess: async () => {
      setConfirmed('');
      await client.invalidateQueries({ queryKey: key });
    },
    retry: false,
  });
  const available =
    !boundary.error &&
    status.isSuccess &&
    !status.isFetching &&
    !change.isPending &&
    !change.isError;
  const data = available ? status.data : undefined;
  const confirmation = data
    ? `${data.operation_id}:${data.revision}:${ownerObservation}:${boundary.revision}`
    : '';
  return (
    <section aria-label="Billing customer setup" className="space-y-2 rounded border p-3">
      <Button
        onClick={() => {
          setOpen(!open);
          setConfirmed('');
        }}
        variant="outline"
      >
        {open ? 'Close billing setup' : 'Billing setup (Owner)'}
      </Button>
      {open && (
        <>
          <p>
            Prepare the organization’s billing customer. Checkout and paid access remain
            unavailable.
          </p>
          <Button
            disabled={status.isFetching || change.isPending}
            onClick={async () => {
              change.reset();
              setConfirmed('');
              await boundary.reload(() => status.refetch());
            }}
            variant="outline"
          >
            Reload billing status
          </Button>
          <QueryState
            error={boundary.error ?? status.error ?? change.error}
            isLoading={status.isLoading || status.isFetching || change.isPending}
          >
            {available && data === null && (
              <Button onClick={() => change.mutate({ kind: 'prepare' })}>
                Prepare billing customer
              </Button>
            )}
            {data && (
              <>
                <p>Status: {data.disposition}</p>
                {data.disposition === 'verified' && (
                  <p>
                    Customer creation verified. Subscription and payment are not confirmed by this
                    result.
                  </p>
                )}
                {data.disposition === 'pending' && (
                  <p>
                    {data.lookup_only
                      ? 'Checking the existing customer.'
                      : 'Customer request saved; waiting for the worker.'}{' '}
                    Next eligible attempt: {data.retry_at}
                  </p>
                )}
                {data.last_error_code && <p>{teamBillingRecoveryGuidance(data.last_error_code)}</p>}
                {data.observed_at && <p>Last observation: {data.observed_at}</p>}
                {(data.disposition === 'owner_changed' ||
                  data.disposition === 'recovery_required') && (
                  <>
                    <p>
                      Check the existing operation. Missing or ambiguous results remain unconfirmed;
                      this action will not create another customer.
                    </p>
                    <label className="flex items-center gap-2">
                      <input
                        aria-label="Confirm existing customer recovery"
                        checked={confirmed === confirmation}
                        onChange={(e) => setConfirmed(e.target.checked ? confirmation : '')}
                        type="checkbox"
                      />
                      I authorize checking this operation as the organization owner.
                    </label>
                    <Button
                      disabled={confirmed !== confirmation}
                      onClick={() =>
                        change.mutate({
                          kind: 'recover',
                          operation: data.operation_id,
                          revision: data.revision,
                        })
                      }
                    >
                      Check existing customer
                    </Button>
                  </>
                )}
              </>
            )}
          </QueryState>
          <TeamCheckoutStatusPanel
            authority={{ available, observation: `${ownerObservation}:${boundary.revision}` }}
            onAccessLost={onAccessLost}
            organizationId={organizationId}
            userId={userId}
          />
          <TeamPortalLink
            customer={
              data?.disposition === 'verified' ? `${data.operation_id}:${data.revision}` : undefined
            }
            onAccessLost={onAccessLost}
            organizationId={organizationId}
            userId={userId}
          />
          <TeamCancellationPanel
            authority={{ available, observation: `${ownerObservation}:${boundary.revision}` }}
            onAccessLost={onAccessLost}
            organizationId={organizationId}
            userId={userId}
          />
          <TeamPriceQuotePanel
            customer={
              data?.disposition === 'verified' ? `${data.operation_id}:${data.revision}` : undefined
            }
            onAccessLost={onAccessLost}
            organizationId={organizationId}
            userId={userId}
          />
        </>
      )}
    </section>
  );
}
