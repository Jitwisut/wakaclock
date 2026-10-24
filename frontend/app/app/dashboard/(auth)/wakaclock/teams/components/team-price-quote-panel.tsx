'use client';

import { useEffect, useState } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { createTeamPriceQuote, getTeamPriceQuote } from '@/lib/wakaclock/team-billing-endpoints';
import { formatStripePrice } from '@/lib/wakaclock/team-billing-money';

import { TeamTestCheckoutConfirmation } from './team-test-checkout-confirmation';

type Intent = { customer: string; id: string; seats: number };
export function TeamPriceQuotePanel({
  customer,
  organizationId,
  userId,
}: {
  customer: string | undefined;
  organizationId: string;
  userId: string;
}) {
  const [seats, setSeats] = useState(10);
  const [intent, setIntent] = useState<Intent>();
  const [now, setNow] = useState(() => Date.now());
  const create = useMutation({
    mutationFn: (request: Intent) =>
      createTeamPriceQuote(organizationId, request.id, request.seats),
    retry: false,
  });
  const matches = Boolean(customer && intent?.customer === customer && intent?.seats === seats);
  const id = matches && create.isSuccess && create.variables === intent ? create.data.id : '';
  const quote = useQuery({
    queryKey: wakaclockKeys.teamPriceQuote(userId, organizationId, id),
    queryFn: ({ signal }) => getTeamPriceQuote(organizationId, id, signal),
    enabled: Boolean(customer && id),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: customer && id ? 15_000 : false,
  });
  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [id]);
  if (!customer) return null;
  const data =
    quote.isSuccess && !quote.isFetching && !create.isPending && matches ? quote.data : undefined;
  const expired = data
    ? Date.parse(data.expires_at) <= now || !Number.isFinite(Date.parse(data.expires_at))
    : false;
  const amount = data && !expired ? formatStripePrice(data.amount_minor, data.currency) : null;
  return (
    <section aria-label="Package price preview" className="space-y-2 rounded border p-3">
      <label>
        Developer seats
        <select
          aria-label="Developer seats"
          disabled={create.isPending}
          onChange={(e) => setSeats(Number(e.target.value))}
          value={seats}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={create.isPending || quote.isFetching}
        onClick={() => {
          // Retrying a lost response reuses the request ID. A new package or expired quote gets a new ID.
          const rejected =
            create.error instanceof WakaclockError &&
            [400, 403, 404, 409].includes(create.error.status ?? 0);
          const next =
            matches && intent && create.isError && !rejected
              ? intent
              : { customer, id: crypto.randomUUID(), seats };
          setIntent(next);
          setNow(Date.now());
          create.mutate(next);
        }}
      >
        View package price
      </Button>
      <QueryState
        error={matches ? (create.error ?? quote.error) : null}
        isLoading={create.isPending || (Boolean(id) && (quote.isLoading || quote.isFetching))}
      >
        {expired && <p>Price preview expired. Request an updated price.</p>}
        {data && !expired && (
          <>
            <p>
              Package price: {amount ?? 'Unavailable'} per month for {data.package_seats}{' '}
              developers.
            </p>
            <p>{taxDescription(data.tax_behavior)}</p>
            <p>
              Total due: unavailable. Final taxes, discounts and payment terms have not been
              confirmed.
            </p>
            <p>
              Price checked: {data.observed_at}. Expires: {data.expires_at}.
            </p>
            {data.test_checkout_confirmation_available && amount ? (
              <TeamTestCheckoutConfirmation
                key={`${userId}:${organizationId}:${customer}:${data.id}`}
                organizationId={organizationId}
                quote={data}
                userId={userId}
              />
            ) : (
              <p>Preview only. Purchasing is not available.</p>
            )}
          </>
        )}
      </QueryState>
    </section>
  );
}

function taxDescription(behavior: string) {
  if (behavior === 'inclusive') return 'Listed price includes tax.';
  if (behavior === 'exclusive') return 'Tax is additional to the listed price.';
  return 'Tax treatment is not yet confirmed.';
}
