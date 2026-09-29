import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MyOrganizationInvites,
  OrganizationInvitesPanel,
} from '@/app/dashboard/(auth)/wakaclock/teams/components/organization-invites';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

import type { OrganizationUserInvite } from '@/lib/wakaclock/measurement-types';

const api = vi.hoisted(() => ({
  accept: vi.fn(),
  decline: vi.fn(),
  invite: vi.fn(),
  list: vi.fn(),
  mine: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  acceptOrganizationInvite: api.accept,
  declineOrganizationInvite: api.decline,
  inviteOrganizationMember: api.invite,
  listMyOrganizationInvites: api.mine,
  listOrganizationInvites: api.list,
  revokeOrganizationInvite: api.revoke,
}));

const store = vi.hoisted(() => ({ userId: 'admin' as null | string }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: typeof store) => unknown) => selector(store),
}));

function invite(overrides: Partial<OrganizationUserInvite> = {}): OrganizationUserInvite {
  return {
    created_at: '2026-09-29T00:00:00Z',
    expires_at: '2026-10-13T00:00:00Z',
    id: 'inv-1',
    invited_by: 'ada',
    organization_id: 'org-1',
    organization_name: 'Acme',
    role: 'member',
    seat_type: 'developer',
    username: 'bo',
    ...overrides,
  };
}

function wrap(
  ui: React.ReactNode,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  store.userId = 'admin';
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('invite query keys', () => {
  it('are scoped to the signed-in user', () => {
    expect(wakaclockKeys.organizationInvites('u1', 'o')).toEqual(
      expect.arrayContaining(['u1', 'o'])
    );
    expect(wakaclockKeys.myOrganizationInvites('u1')).toContain('u1');
  });
});

describe('OrganizationInvitesPanel', () => {
  it('sends an invite with the chosen role and seat, then lists it', async () => {
    api.list.mockResolvedValueOnce([]).mockResolvedValue([invite({ role: 'admin' })]);
    api.invite.mockResolvedValue(invite({ role: 'admin' }));
    wrap(<OrganizationInvitesPanel organizationId="org-1" />);

    const form = await screen.findByRole('form', { name: 'Invite by username' });
    expect(within(form).getByRole('button', { name: 'Send invite' })).toBeDisabled();
    fireEvent.submit(form);
    expect(api.invite).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByRole('textbox', { name: 'Username' }), {
      target: { value: '  bo ' },
    });
    fireEvent.change(within(form).getByRole('combobox', { name: 'Organization role' }), {
      target: { value: 'admin' },
    });
    fireEvent.change(within(form).getByRole('combobox', { name: 'Seat type' }), {
      target: { value: 'viewer' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Send invite' }));

    await waitFor(() => expect(api.invite).toHaveBeenCalledWith('org-1', 'bo', 'admin', 'viewer'));
    expect(await screen.findByRole('status')).toHaveTextContent('Invite sent to bo.');
    expect(await screen.findByRole('list', { name: 'Pending invites' })).toHaveTextContent(
      'bo · Admin · expires'
    );
  });

  it('withdraws a pending invite and shows server errors', async () => {
    api.list.mockResolvedValue([invite()]);
    api.revoke
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new WakaclockError('invite not found', 404));
    wrap(<OrganizationInvitesPanel organizationId="org-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw the invite for bo' }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('org-1', 'inv-1'));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the invite for bo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invite not found');
  });

  it('falls back to a generic error message', async () => {
    api.list.mockResolvedValue([]);
    api.invite.mockRejectedValue(new Error(''));
    wrap(<OrganizationInvitesPanel organizationId="org-1" />);

    const form = await screen.findByRole('form', { name: 'Invite by username' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Username' }), {
      target: { value: 'ghost' },
    });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update invites.');
  });

  it('stays hidden for non-admins without retrying the 403', async () => {
    api.list.mockRejectedValue(new WakaclockError('role does not permit this action', 403));
    const { container } = wrap(<OrganizationInvitesPanel organizationId="org-1" />);

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('retries other failures before staying hidden', async () => {
    api.list.mockRejectedValue(new Error('PostgreSQL is not configured'));
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } });
    const { container } = wrap(<OrganizationInvitesPanel organizationId="org-1" />, client);

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(3));
    expect(container).toBeEmptyDOMElement();
  });

  it('waits for a signed-in user', () => {
    store.userId = null;
    wrap(<OrganizationInvitesPanel organizationId="org-1" />);

    expect(api.list).not.toHaveBeenCalled();
  });
});

describe('MyOrganizationInvites', () => {
  it('accepts an invite and refreshes the organization list', async () => {
    api.mine.mockResolvedValueOnce([invite()]).mockResolvedValue([]);
    api.accept.mockResolvedValue({
      organization_id: 'org-1',
      role: 'member',
      seat_type: 'developer',
    });
    const { client } = wrap(<MyOrganizationInvites />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText(/invited by ada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept the invite to Acme' }));

    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('inv-1', expect.anything()));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['organizations'] }));
    await waitFor(() => expect(screen.queryByText('Acme')).toBeNull());
  });

  it('declines an invite and explains failures', async () => {
    api.mine.mockResolvedValue([invite({ invited_by: null, role: 'viewer' })]);
    api.decline.mockResolvedValueOnce(undefined).mockRejectedValueOnce('nope');
    wrap(<MyOrganizationInvites />);

    expect(await screen.findByText(/· Viewer$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decline the invite to Acme' }));
    await waitFor(() => expect(api.decline).toHaveBeenCalledWith('inv-1', expect.anything()));

    fireEvent.click(screen.getByRole('button', { name: 'Decline the invite to Acme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not answer the invite.');
  });

  it('renders nothing without invites or before sign-in', async () => {
    api.mine.mockResolvedValue([]);
    const { container } = wrap(<MyOrganizationInvites />);
    await waitFor(() => expect(api.mine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();

    store.userId = null;
    api.mine.mockClear();
    wrap(<MyOrganizationInvites />);
    expect(api.mine).not.toHaveBeenCalled();
  });
});
