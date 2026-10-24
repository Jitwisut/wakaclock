'use client';

import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { confirmTeamTestCheckout } from '@/lib/wakaclock/team-billing-endpoints';
import type { TeamPriceQuote } from '@/lib/wakaclock/team-billing-endpoints';
import { formatStripePrice } from '@/lib/wakaclock/team-billing-money';

export function TeamTestCheckoutConfirmation(props: {
  organizationId: string;
  quote: TeamPriceQuote;
  userId: string;
}) {
  return (
    <ConfirmationScope
      key={`${props.userId}:${props.organizationId}:${props.quote.id}`}
      {...props}
    />
  );
}
function ConfirmationScope({
  organizationId,
  userId,
  quote,
}: {
  organizationId: string;
  quote: TeamPriceQuote;
  userId: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const client = useQueryClient();
  const send = useMutation({
    mutationFn: () => confirmTeamTestCheckout(organizationId, quote.id),
    retry: false,
    onError: async (error) => {
      if (error instanceof WakaclockError && [400, 403, 404, 409].includes(error.status ?? 0)) {
        setConfirmed(false);
        await client.invalidateQueries({
          queryKey: wakaclockKeys.teamPriceQuote(userId, organizationId, quote.id),
        });
      }
    },
    onSuccess: async () => {
      setConfirmed(false);
      await client.invalidateQueries({
        queryKey: wakaclockKeys.teamBillingCheckout(userId, organizationId),
      });
    },
  });
  if (!quote.test_checkout_confirmation_available) return null;
  const amount = formatStripePrice(quote.amount_minor, quote.currency);
  const accepted = send.isSuccess && send.data.quote_id === quote.id;
  return (
    <section aria-label="Test Checkout confirmation" className="space-y-2 rounded border p-3">
      <p>
        Test mode only. This creates a test purchase request; no live charge or paid access is
        enabled.
      </p>
      {accepted ? (
        <p>
          Test request saved. Open Existing Checkout to follow delivery and verification. Payment
          remains unconfirmed.
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2">
            <input
              aria-label="Confirm test package"
              checked={confirmed}
              disabled={send.isPending}
              onChange={(e) => setConfirmed(e.target.checked)}
              type="checkbox"
            />
            I confirm {amount ?? 'unavailable price'} per month for {quote.package_seats} developers
            in test mode. Final tax and total must be reviewed in Checkout.
          </label>
          <Button
            disabled={
              !confirmed ||
              !amount ||
              send.isPending ||
              Date.parse(quote.expires_at) <= Date.now() ||
              !Number.isFinite(Date.parse(quote.expires_at))
            }
            onClick={() => send.mutate()}
          >
            {send.isError ? 'Retry same test request' : 'Prepare test Checkout'}
          </Button>
          <QueryState error={send.error} isLoading={send.isPending}>
            <span />
          </QueryState>
          {send.isError && (
            <p>Check Existing Checkout if the result is unclear. A retry uses the same quote.</p>
          )}
        </>
      )}
    </section>
  );
}
