'use client';
import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { WakaclockError } from '@/lib/wakaclock/client';
import { reportTeamBillingAccessFailure } from '@/lib/wakaclock/team-billing-recovery';
import { getTeamPortalDestination, isTeamPortalUrl } from '@/lib/wakaclock/team-portal-endpoints';

interface Props {
  customer: string | undefined;
  onAccessLost?: (error: unknown) => void;
  organizationId: string;
  userId: string;
}
export function TeamPortalLink(props: Props) {
  return props.customer ? (
    <PortalScope key={`${props.userId}:${props.organizationId}:${props.customer}`} {...props} />
  ) : null;
}
function PortalScope({ organizationId, onAccessLost }: Props) {
  const [intent, setIntent] = useState<{ at: number; id: string }>();
  const [display, setDisplay] = useState({ from: 0, until: 0 });
  const [now, setNow] = useState(() => Date.now());
  const request = useMutation({
    mutationFn: async (input: { at: number; id: string }) => {
      const result = await reportTeamBillingAccessFailure(
        getTeamPortalDestination(organizationId, input.id),
        onAccessLost
      );
      if (
        result.request_id !== input.id ||
        !isTeamPortalUrl(result.url) ||
        result.provider_expires_at !== null ||
        result.payment_or_access_confirmed !== false ||
        !Array.isArray(result.purposes) ||
        result.purposes.length === 0 ||
        result.purposes.some(
          (p) => !['customer_update', 'invoice_history', 'payment_method_update'].includes(p)
        ) ||
        !Number.isFinite(Date.parse(result.observed_at)) ||
        !Number.isFinite(Date.parse(result.display_until)) ||
        Date.parse(result.display_until) - Date.parse(result.observed_at) !== 30_000 ||
        Date.parse(result.display_until) <= Date.now()
      ) {
        throw new WakaclockError('Portal destination unavailable; reload billing status', 409);
      }
      return result;
    },
    retry: false,
    gcTime: 0,
    onSuccess: (result) => {
      const at = Date.now();
      setNow(at);
      setDisplay({ from: at, until: Math.min(Date.parse(result.display_until), at + 30_000) });
    },
  });
  const { reset } = request;
  useEffect(() => {
    if (!display.until) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time < display.from || time >= display.until) {
        reset();
        setDisplay({ from: 0, until: 0 });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [display, reset]);
  const link =
    request.isSuccess && display.from <= now && now < display.until ? request.data.url : undefined;
  return (
    <section aria-label="Billing portal" className="space-y-2 rounded border p-3">
      <p>
        Manage billing details, payment methods and invoice history in Stripe. Package changes use
        the separate Team purchase flow.
      </p>
      <Button
        disabled={request.isPending}
        onClick={() => {
          const at = Date.now();
          const rejected =
            request.error instanceof WakaclockError &&
            [400, 401, 403, 404, 409].includes(request.error.status ?? 0);
          const next =
            request.isError && !rejected && intent && intent.at <= at && at - intent.at < 60_000
              ? intent
              : { id: crypto.randomUUID(), at };
          setIntent(next);
          setDisplay({ from: 0, until: 0 });
          request.reset();
          request.mutate(next);
        }}
      >
        {request.isError ? 'Retry portal check' : 'Get billing portal link'}
      </Button>
      <QueryState error={request.error} isLoading={request.isPending}>
        {link && (
          <a href={link} referrerPolicy="no-referrer" rel="noopener noreferrer" target="_blank">
            Open Stripe billing portal
          </a>
        )}
      </QueryState>
      <p>
        The app hides this link after 30 seconds. Stripe controls its actual expiration; hiding it
        does not revoke a link already copied. Opening the portal does not confirm payment or
        analytics access.
      </p>
    </section>
  );
}
