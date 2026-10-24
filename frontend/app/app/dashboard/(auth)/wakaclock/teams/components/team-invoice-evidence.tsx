'use client';

import { useEffect, useState } from 'react';

import type { TeamInvoiceAssessment } from '@/lib/wakaclock/team-billing-endpoints';

export function TeamInvoiceEvidence({ evidence }: { evidence: TeamInvoiceAssessment }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const observed = Date.parse(evidence.observed_at);
  const until = Date.parse(evidence.valid_until);
  const covered = evidence.covered_until ? Date.parse(evidence.covered_until) : Number.NaN;
  const fresh =
    evidence.calculation_version === 1 &&
    observed <= now &&
    now < Math.min(until, observed + 5 * 60_000);
  const settled =
    fresh &&
    evidence.state === 'settled' &&
    now < covered &&
    [10, 25, 50, 100].includes(evidence.package_seats ?? 0);
  let state = 'unconfirmed';
  if (settled) {
    state = 'settled';
  } else if (fresh && evidence.state === 'unpaid') {
    state = 'unpaid';
  }
  let mode = 'unconfirmed';
  if (evidence.livemode === false) {
    mode = 'test';
  } else if (evidence.livemode === true) {
    mode = 'live';
  }
  return (
    <section aria-label="Invoice coverage evidence">
      <p>Invoice coverage: {state}</p>
      <p>Billing mode: {mode}</p>
      <p>Evidence reason: {fresh ? evidence.reason : 'Fresh invoice evidence required'}</p>
      <p>Invoice checked at: {evidence.observed_at}</p>
      {settled && (
        <p>
          Provider invoice settled for {evidence.package_seats} developer seats through{' '}
          {evidence.covered_until}.
        </p>
      )}
      <p>This is invoice evidence only. Paid access has not been activated.</p>
    </section>
  );
}
