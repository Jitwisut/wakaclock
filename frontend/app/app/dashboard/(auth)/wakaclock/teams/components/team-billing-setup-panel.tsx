'use client';

import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  getTeamCustomer,
  prepareTeamCustomer,
  recoverTeamCustomer,
} from '@/lib/wakaclock/team-billing-endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { TeamCheckoutStatusPanel } from './team-checkout-status-panel';
import { TeamPriceQuotePanel } from './team-price-quote-panel';

export function TeamBillingSetupPanel({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  return (
    <BillingScope
      key={`${userId}:${organizationId}`}
      organizationId={organizationId}
      userId={userId}
    />
  );
}
function BillingScope({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const client = useQueryClient();
  const key = wakaclockKeys.teamBillingCustomer(userId, organizationId);
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getTeamCustomer(organizationId, signal),
    enabled: open && Boolean(userId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: open ? 15_000 : false,
  });
  const change = useMutation({
    mutationFn: async (
      action: { kind: 'prepare' } | { kind: 'recover'; operation: string; revision: number }
    ) => {
      if (action.kind === 'prepare') await prepareTeamCustomer(organizationId);
      else await recoverTeamCustomer(organizationId, action.operation, action.revision);
    },
    onSuccess: async () => {
      setConfirmed('');
      await client.invalidateQueries({ queryKey: key });
    },
    retry: false,
  });
  const available = status.isSuccess && !status.isFetching && !change.isPending && !change.isError;
  const data = available ? status.data : undefined;
  const confirmation = data ? `${data.operation_id}:${data.revision}` : '';
  return (
    <section aria-label="Billing customer setup" className="space-y-2 rounded border p-3">
      <Button onClick={() => setOpen(!open)} variant="outline">
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
            onClick={() => {
              change.reset();
              setConfirmed('');
              void status.refetch();
            }}
            variant="outline"
          >
            Reload billing status
          </Button>
          <QueryState
            error={status.error ?? change.error}
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
                {data.last_error_code && <p>Reason: {data.last_error_code}</p>}
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
          <TeamCheckoutStatusPanel organizationId={organizationId} userId={userId} />
          <TeamPriceQuotePanel
            customer={data?.disposition === 'verified' ? confirmation : undefined}
            organizationId={organizationId}
            userId={userId}
          />
        </>
      )}
    </section>
  );
}
