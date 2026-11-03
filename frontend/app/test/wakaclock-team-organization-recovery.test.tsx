import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { TeamOrganizationRecoveryPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-organization-recovery-panel';
import { WakaclockError } from '@/lib/wakaclock/client';
import type { OrganizationBirthRecovery } from '@/lib/wakaclock/team-organization-endpoints';

const api = vi.hoisted(() => ({ inspect: vi.fn(), confirm: vi.fn() }));
vi.mock('@/lib/wakaclock/team-organization-endpoints', () => ({
  inspectOrganizationBirth: api.inspect,
  confirmOrganizationBirth: api.confirm,
}));
function offer(org = 'org'): OrganizationBirthRecovery {
  return {
    schema: 1,
    organization_id: org,
    creation_id: crypto.randomUUID(),
    birth_digest: 'a'.repeat(64),
    observation: 'b'.repeat(64),
    disposition: 'confirmation_required',
    confirmation_id: null,
    confirmation_recorded: false,
    can_confirm: true,
    creates_organization: false,
    starts_trial: false,
  };
}
beforeEach(() => {
  api.inspect.mockReset().mockResolvedValue(offer());
  api.confirm.mockReset();
});
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (user = 'owner', org = 'org') => (
    <QueryClientProvider client={cache}>
      <TeamOrganizationRecoveryPanel
        key={`${user}:${org}`}
        userId={user}
        organizationId={org}
        sessionToken={`synthetic-${user}-session`}
      />
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
it('requires explicit Owner inspection and confirmation without starting a trial or creating a workspace', async () => {
  api.confirm.mockImplementation(async (_org, observed, id) => {
    const done = {
      ...observed,
      confirmation_id: id,
      confirmation_recorded: true,
      can_confirm: false,
      disposition: 'confirmed',
    };
    api.inspect.mockResolvedValue(done);
    return done;
  });
  mount();
  expect(api.inspect).not.toHaveBeenCalled();
  expect(api.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Verify organization creation (Owner)'));
  const button = await screen.findByText('Confirm existing creation');
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm existing organization birth'));
  fireEvent.click(button);
  await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
  expect(api.confirm.mock.calls[0][0]).toBe('org');
  expect(api.confirm.mock.calls[0][1]).toMatchObject({
    creates_organization: false,
    starts_trial: false,
  });
  await screen.findByText('Creation status: confirmed');
  expect(screen.queryByLabelText('Confirm existing organization birth')).not.toBeInTheDocument();
});
it('uses the same saved confirmation ID after a lost response and explicit readback', async () => {
  api.confirm.mockImplementationOnce(async (_org, observed, id) => {
    api.inspect.mockResolvedValue({
      ...observed,
      confirmation_id: id,
      disposition: 'confirmation_requested',
    });
    throw new WakaclockError('response lost', null);
  });
  api.confirm.mockImplementation(async (_org, observed, id) => {
    const done = {
      ...observed,
      confirmation_id: id,
      confirmation_recorded: true,
      can_confirm: false,
      disposition: 'confirmed',
    };
    api.inspect.mockResolvedValue(done);
    return done;
  });
  mount();
  fireEvent.click(screen.getByText('Verify organization creation (Owner)'));
  await screen.findByText('Confirm existing creation');
  fireEvent.click(screen.getByLabelText('Confirm existing organization birth'));
  fireEvent.click(screen.getByText('Confirm existing creation'));
  await screen.findByText(/The result is unconfirmed/);
  const original = api.confirm.mock.calls[0][2];
  fireEvent.click(screen.getByText('Reload creation verification'));
  await screen.findByText('Check saved creation confirmation');
  fireEvent.click(screen.getByLabelText('Confirm existing organization birth'));
  fireEvent.click(screen.getByText('Check saved creation confirmation'));
  await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(2));
  expect(api.confirm.mock.calls[1][2]).toBe(original);
  await screen.findByText('Creation status: confirmed');
});
it('failed Owner recheck hides old actionable data and keeps confirmation blocked', async () => {
  mount();
  fireEvent.click(screen.getByText('Verify organization creation (Owner)'));
  await screen.findByText('Confirm existing creation');
  api.inspect.mockRejectedValue(new WakaclockError('Owner authorization required', 403));
  fireEvent.click(screen.getByText('Reload creation verification'));
  await screen.findByText('Owner authorization required');
  expect(screen.queryByText('Confirm existing creation')).not.toBeInTheDocument();
  expect(api.confirm).not.toHaveBeenCalled();
});
it('late response from a previous account cannot expose its status in the new account', async () => {
  let resolve!: (value: OrganizationBirthRecovery) => void;
  api.inspect.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const ui = mount();
  fireEvent.click(screen.getByText('Verify organization creation (Owner)'));
  await waitFor(() => expect(api.inspect).toHaveBeenCalledTimes(1));
  ui.rerender(ui.view('other', 'other-org'));
  await act(async () => resolve(offer()));
  expect(screen.queryByText('Creation status: confirmation_required')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Confirm existing organization birth')).not.toBeInTheDocument();
  expect(api.confirm).not.toHaveBeenCalled();
});
