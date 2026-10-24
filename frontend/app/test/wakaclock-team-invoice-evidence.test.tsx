import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TeamInvoiceEvidence } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-invoice-evidence';
import type { TeamInvoiceAssessment } from '@/lib/wakaclock/team-billing-endpoints';
const at = Date.parse('2026-10-16T08:00:00Z');
const evidence: TeamInvoiceAssessment = {
  livemode: false, state: 'settled', reason: 'matching_invoice_coverage', calculation_version: 1,
  observed_at: new Date(at).toISOString(), valid_until: new Date(at+300000).toISOString(),
  covered_until: new Date(at+86400000).toISOString(), package_seats: 10, access_granted: false,
};
afterEach(() => { vi.useRealTimers(); });
it('shows verified invoice coverage separately from activation and expires without a poll', () => {
  vi.useFakeTimers(); vi.setSystemTime(at);
  render(<TeamInvoiceEvidence evidence={evidence}/>);
  expect(screen.getByText('Invoice coverage: settled')).toBeInTheDocument();
  expect(screen.getByText(/Paid access has not been activated/)).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(300000); });
  expect(screen.getByText('Invoice coverage: unconfirmed')).toBeInTheDocument();
  expect(screen.queryByText(/Provider invoice settled/)).not.toBeInTheDocument();
});
it.each([
  { calculation_version: 2 }, { package_seats: 11 }, { valid_until: 'invalid' },
  { observed_at: new Date(at+1000).toISOString() }, { covered_until: new Date(at).toISOString() },
  { state: 'unconfirmed' as const, reason: 'reconciliation_pending' },
])('fails closed for invalid, pending or expired evidence %j', (change) => {
  vi.useFakeTimers(); vi.setSystemTime(at);
  render(<TeamInvoiceEvidence evidence={{...evidence,...change}}/>);
  expect(screen.getByText('Invoice coverage: unconfirmed')).toBeInTheDocument();
  expect(screen.queryByText(/Provider invoice settled/)).not.toBeInTheDocument();
});
it('replaces prior invoice coverage when the new observation is unpaid', () => {
  vi.useFakeTimers(); vi.setSystemTime(at);
  const view=render(<TeamInvoiceEvidence evidence={evidence}/>);
  view.rerender(<TeamInvoiceEvidence evidence={{...evidence,state:'unpaid',reason:'invoice_not_settled',package_seats:null,covered_until:null}}/>);
  expect(screen.getByText('Invoice coverage: unpaid')).toBeInTheDocument();
  expect(screen.queryByText(/Provider invoice settled/)).not.toBeInTheDocument();
});
