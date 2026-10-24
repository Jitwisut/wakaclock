'use client';

import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamCheckout, recoverTeamCheckout } from '@/lib/wakaclock/team-billing-endpoints';

import { TeamHostedCheckoutLink } from './team-hosted-checkout-link';
import { TeamInvoiceEvidence } from './team-invoice-evidence';

export function TeamCheckoutStatusPanel(props: { organizationId: string; userId: string }) {
  return <CheckoutScope key={`${props.userId}:${props.organizationId}`} {...props} />;
}
function CheckoutScope({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const client = useQueryClient();
  const key = wakaclockKeys.teamBillingCheckout(userId, organizationId);
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getTeamCheckout(organizationId, signal),
    enabled: open && Boolean(userId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: open ? 15_000 : false,
  });
  const recovery = useMutation({
    mutationFn: (input: { operation: string; revision: number }) =>
      recoverTeamCheckout(organizationId, input.operation, input.revision),
    retry: false,
    onSuccess: async () => {
      setConfirmed('');
      await client.invalidateQueries({ queryKey: key });
    },
  });
  const available =
    status.isSuccess && !status.isFetching && !recovery.isPending && !recovery.isError;
  const data = available ? status.data : undefined;
  const confirmation = data ? `${data.operation_id}:${data.revision}` : '';
  return (
    <section aria-label="Existing Checkout status" className="space-y-2 rounded border p-3">
      <Button
        onClick={() => {
          setOpen(!open);
          setConfirmed('');
        }}
        variant="outline"
      >
        {open ? 'Close Checkout status' : 'Existing Checkout (Owner)'}
      </Button>
      {open && (
        <>
          <p>Review an existing purchase request. Invoice evidence and paid access are shown separately.</p>
          <Button
            disabled={status.isFetching || recovery.isPending}
            onClick={() => {
              recovery.reset();
              setConfirmed('');
              void status.refetch();
            }}
            variant="outline"
          >
            Reload Checkout status
          </Button>
          <QueryState
            error={status.error ?? recovery.error}
            isLoading={status.isLoading || status.isFetching || recovery.isPending}
          >
            {available && data === null && (
              <p>No existing purchase request was found for this organization.</p>
            )}
            {data && (
              <>
                <p>Checkout status: {data.disposition}</p>
                {data.disposition === 'session_open' &&
                  data.test_checkout_destination_available && (
                    <TeamHostedCheckoutLink
                      operation={data.operation_id}
                      organizationId={organizationId}
                      revision={data.revision}
                      userId={userId}
                    />
                  )}
                {data.disposition === 'bound' && (
                  <p>Subscription identity linked. This does not confirm payment or paid access.</p>
                )}
                {data.invoice_assessment && (
                  <TeamInvoiceEvidence evidence={data.invoice_assessment} />
                )}
                {data.lookup_only && (
                  <p>Read-only recovery: another Checkout will not be created.</p>
                )}
                {data.observed_at && <p>Last observation: {data.observed_at}</p>}
                {data.last_error_code && <p>Reason: {data.last_error_code}</p>}
                <p>Next eligible check: {data.retry_at}</p>
                {['owner_changed', 'recovery_required'].includes(data.disposition) && (
                  <>
                    <p>
                      Authorize checking the existing operation. Missing or ambiguous results stay
                      unconfirmed. This does not approve a new charge.
                    </p>
                    <label className="flex items-center gap-2">
                      <input
                        aria-label="Confirm existing Checkout recovery"
                        checked={confirmed === confirmation}
                        onChange={(e) => setConfirmed(e.target.checked ? confirmation : '')}
                        type="checkbox"
                      />
                      I authorize checking this operation as the organization owner.
                    </label>
                    <Button
                      disabled={confirmed !== confirmation}
                      onClick={() =>
                        recovery.mutate({ operation: data.operation_id, revision: data.revision })
                      }
                    >
                      Check existing Checkout
                    </Button>
                  </>
                )}
              </>
            )}
          </QueryState>
        </>
      )}
    </section>
  );
}
