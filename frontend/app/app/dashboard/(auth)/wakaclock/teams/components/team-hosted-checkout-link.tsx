'use client';

import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { getTeamCheckoutDestination } from '@/lib/wakaclock/team-billing-endpoints';

interface Props {
  operation: string;
  organizationId: string;
  revision: number;
  userId: string;
}
export function TeamHostedCheckoutLink(props: Props) {
  return (
    <LinkScope
      key={`${props.userId}:${props.organizationId}:${props.operation}:${props.revision}`}
      {...props}
    />
  );
}
function LinkScope({ organizationId, operation, revision }: Props) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const request = useMutation({
    mutationFn: async () => {
      const data = await getTeamCheckoutDestination(organizationId, operation, revision);
      if (
        data.operation_id !== operation ||
        !isCheckoutUrl(data.url) ||
        !Number.isFinite(Date.parse(data.expires_at)) ||
        Date.parse(data.expires_at) <= Date.now()
      ) {
        throw new WakaclockError('Checkout destination unavailable; reload status', 409);
      }
      return data;
    },
    retry: false,
    gcTime: 0,
    onSuccess: (data) => {
      setNow(Date.now());
      setUntil(Math.min(Date.parse(data.expires_at), Date.now() + 30_000));
    },
  });
  const { reset } = request;
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) {
        reset();
        setUntil(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until, reset]);
  const link = request.isSuccess && now < until ? request.data.url : undefined;
  return (
    <section aria-label="Stripe test Checkout link" className="space-y-2">
      <Button
        disabled={request.isPending}
        onClick={() => {
          setUntil(0);
          request.reset();
          request.mutate();
        }}
      >
        Get test Checkout link
      </Button>
      <QueryState error={request.error} isLoading={request.isPending}>
        {link && (
          <a href={link} referrerPolicy="no-referrer" rel="noopener noreferrer" target="_blank">
            Open Stripe test Checkout
          </a>
        )}
      </QueryState>
      <p>
        The link is shown briefly after a fresh check. Returning from Stripe does not confirm
        payment; reload Checkout status.
      </p>
    </section>
  );
}

function isCheckoutUrl(raw: string): boolean {
  const prefix = 'https://checkout.stripe.com/c/pay/cs_test_';
  if (typeof raw !== 'string' || raw.length > 8192 || !raw.startsWith(prefix)) return false;
  if ([...raw].some((c) => (c.codePointAt(0) ?? 0) < 33 || (c.codePointAt(0) ?? 0) > 126))
    {return false;}
  const id = raw.slice(prefix.length).split('#', 1)[0];
  return /^\w+$/.test(id);
}
