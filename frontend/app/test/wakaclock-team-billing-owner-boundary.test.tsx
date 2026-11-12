import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import {
  TeamBillingOwnerBoundary,
  useOptionalTeamBillingOwnerBoundary,
  useTeamBillingOwnerBoundary,
} from '@/app/dashboard/(auth)/wakaclock/teams/components/team-billing-owner-boundary';

function Probe({ read }: { read: () => Promise<{ isSuccess: boolean }> }) {
  const boundary = useTeamBillingOwnerBoundary();
  return (
    <>
      <p>
        {boundary.error ? `denied: ${String(boundary.error)}` : 'clear'} / revision{' '}
        {boundary.revision}
      </p>
      <button onClick={() => boundary.report('owner required')} type="button">
        report
      </button>
      <button onClick={() => void boundary.reload(read)} type="button">
        reload
      </button>
    </>
  );
}
function Optional() {
  return <p>{useOptionalTeamBillingOwnerBoundary() ? 'inside' : 'outside'}</p>;
}

it('refuses to run an Owner-scoped panel outside the boundary', () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Probe read={async () => ({ isSuccess: true })} />)).toThrow(
    'Billing Owner boundary missing'
  );
  quiet.mockRestore();
  render(<Optional />);
  expect(screen.getByText('outside')).toBeInTheDocument();
});
it('keeps a denial until an explicit reload succeeds', async () => {
  const read = vi.fn().mockResolvedValue({ isSuccess: false });
  render(
    <TeamBillingOwnerBoundary>
      <Probe read={read} />
    </TeamBillingOwnerBoundary>
  );
  expect(screen.getByText('clear / revision 0')).toBeInTheDocument();
  fireEvent.click(screen.getByText('report'));
  expect(screen.getByText('denied: owner required / revision 1')).toBeInTheDocument();
  fireEvent.click(screen.getByText('reload'));
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  expect(screen.getByText('denied: owner required / revision 1')).toBeInTheDocument();
  read.mockResolvedValue({ isSuccess: true });
  fireEvent.click(screen.getByText('reload'));
  expect(await screen.findByText('clear / revision 2')).toBeInTheDocument();
});
it('does not let a reload clear a denial reported while it was in flight', async () => {
  let finish!: (value: { isSuccess: boolean }) => void;
  const read = () =>
    new Promise<{ isSuccess: boolean }>((resolve) => {
      finish = resolve;
    });
  render(
    <TeamBillingOwnerBoundary>
      <Probe read={read} />
    </TeamBillingOwnerBoundary>
  );
  fireEvent.click(screen.getByText('reload'));
  fireEvent.click(screen.getByText('report'));
  finish({ isSuccess: true });
  await Promise.resolve();
  expect(await screen.findByText('denied: owner required / revision 1')).toBeInTheDocument();
});
