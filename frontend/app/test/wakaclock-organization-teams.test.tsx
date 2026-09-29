import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationTeamsPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/organization-teams-panel';
import { WakaclockError } from '@/lib/wakaclock/client';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

import type {
  OrganizationMember,
  OrganizationTeam,
  OrganizationTeamMember,
} from '@/lib/wakaclock/measurement-types';

const api = vi.hoisted(() => ({
  add: vi.fn(),
  createTeam: vi.fn(),
  members: vi.fn(),
  remove: vi.fn(),
  teamMembers: vi.fn(),
  teams: vi.fn(),
}));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  addTeamMember: api.add,
  createOrganizationTeam: api.createTeam,
  listOrganizationMembers: api.members,
  listOrganizationTeams: api.teams,
  listTeamMembers: api.teamMembers,
  removeTeamMember: api.remove,
}));

const store = vi.hoisted(() => ({ userId: 'admin' as null | string }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: typeof store) => unknown) => selector(store),
}));

const squad: OrganizationTeam = {
  created_at: '2026-09-01T00:00:00Z',
  id: 'team-1',
  name: 'Squad',
  organization_id: 'org-1',
  slug: 'squad',
};
const platform: OrganizationTeam = { ...squad, id: 'team-2', name: 'Platform', slug: 'platform' };

function person(user_id: string, username: string, overrides: Partial<OrganizationMember> = {}) {
  return {
    deactivated_at: null,
    email: null,
    joined_at: '2026-09-01T00:00:00Z',
    role: 'member',
    seat_type: 'developer',
    user_id,
    username,
    ...overrides,
  } satisfies OrganizationMember;
}

function teammate(user_id: string, username: string, role: OrganizationTeamMember['role']) {
  return { joined_at: '2026-09-01T00:00:00Z', role, user_id, username };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationTeamsPanel organizationId="org-1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  store.userId = 'admin';
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('team query keys', () => {
  it('isolate every team query by user', () => {
    expect(wakaclockKeys.organizationTeams('u1', 'o')).toContain('u1');
    expect(wakaclockKeys.organizationMembers('u1', 'o')).toContain('u1');
    expect(wakaclockKeys.teamMembers('u1', 'o', 't')).toEqual(
      expect.arrayContaining(['u1', 'o', 't'])
    );
    expect(wakaclockKeys.teamMembers('u1', 'o', 't')).not.toEqual(
      wakaclockKeys.teamMembers('u2', 'o', 't')
    );
  });
});

describe('OrganizationTeamsPanel as an admin', () => {
  beforeEach(() => {
    api.teams.mockResolvedValue([squad, platform]);
    api.members.mockResolvedValue([
      person('admin', 'ada'),
      person('bo', 'bo'),
      person('cy', 'cy'),
      person('gone', 'gone', { deactivated_at: '2026-09-02T00:00:00Z' }),
    ]);
    api.teamMembers.mockImplementation(async (_org: string, teamId: string) =>
      teamId === 'team-1' ? [teammate('admin', 'ada', 'lead'), teammate('bo', 'bo', 'member')] : []
    );
  });

  it('adds an active organization member who is not on the team yet', async () => {
    api.add.mockResolvedValue(teammate('cy', 'cy', 'viewer'));
    renderPanel();

    const personSelect = await screen.findByRole('combobox', { name: 'Person to add' });
    await waitFor(() =>
      expect([...(personSelect as HTMLSelectElement).options].map((option) => option.text)).toEqual(
        ['Choose a person…', 'cy']
      )
    );
    expect(screen.getByRole('button', { name: /Add to team/ })).toBeDisabled();
    fireEvent.change(personSelect, { target: { value: 'cy' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role for the new member' }), {
      target: { value: 'viewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add to team/ }));

    await waitFor(() => expect(api.add).toHaveBeenCalledWith('org-1', 'team-1', 'cy', 'viewer'));
    await waitFor(() => expect(api.teamMembers).toHaveBeenCalledTimes(2));
  });

  it('changes a role and removes someone', async () => {
    api.add.mockResolvedValue(teammate('bo', 'bo', 'lead'));
    api.remove.mockResolvedValue(undefined);
    renderPanel();

    fireEvent.change(await screen.findByRole('combobox', { name: 'Role for bo' }), {
      target: { value: 'lead' },
    });
    await waitFor(() => expect(api.add).toHaveBeenCalledWith('org-1', 'team-1', 'bo', 'lead'));

    fireEvent.click(screen.getByRole('button', { name: 'Remove bo from Squad' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('org-1', 'team-1', 'bo'));
  });

  it('shows the server’s reason when a change is refused', async () => {
    api.remove.mockRejectedValue(new WakaclockError('team member not found', 404));
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove bo from Squad' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('team member not found');
  });

  it('falls back to a generic message for an error without text', async () => {
    api.add.mockRejectedValue(new Error(''));
    renderPanel();

    fireEvent.change(await screen.findByRole('combobox', { name: 'Role for bo' }), {
      target: { value: 'viewer' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the team.');
  });

  it('switches teams and says when everyone is already on it', async () => {
    api.members.mockResolvedValue([person('admin', 'ada')]);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Platform' }));
    expect(await screen.findByText('Nobody is on this team yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Platform' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Squad' }));
    const personSelect = await screen.findByRole('combobox', { name: 'Person to add' });
    await waitFor(() =>
      expect(personSelect).toHaveTextContent('Everyone in the organization is on this team')
    );
    fireEvent.submit(personSelect.closest('form')!);
    expect(api.add).not.toHaveBeenCalled();
  });

  it('creates a team and selects it', async () => {
    const created = { ...squad, id: 'team-3', name: 'Mobile', slug: 'mobile' };
    api.createTeam.mockResolvedValue(created);
    renderPanel();

    const form = await screen.findByRole('form', { name: 'Create a team' });
    const input = within(form).getByRole('textbox', { name: 'Team name' });
    fireEvent.submit(form);
    expect(api.createTeam).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '  Mobile  ' } });
    api.teams.mockResolvedValue([squad, platform, created]);
    fireEvent.click(within(form).getByRole('button', { name: 'Create team' }));

    await waitFor(() => expect(api.createTeam).toHaveBeenCalledWith('org-1', 'Mobile'));
    expect(await screen.findByRole('button', { name: 'Mobile' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('explains a failed team creation', async () => {
    api.createTeam.mockRejectedValueOnce(
      new WakaclockError('team name must contain 1-120 characters', 400)
    );
    renderPanel();

    const form = await screen.findByRole('form', { name: 'Create a team' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Team name' }), {
      target: { value: 'x' },
    });
    fireEvent.submit(form);
    expect(await within(form).findByRole('alert')).toHaveTextContent('team name must contain');

    api.createTeam.mockRejectedValueOnce('nope');
    fireEvent.submit(form);
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent('Could not create the team.')
    );
  });

  it('invites admins to create the first team', async () => {
    api.teams.mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText('Create the first team below.')).toBeInTheDocument();
  });
});

describe('OrganizationTeamsPanel as a member', () => {
  it('is read-only and does not retry the admin-only member list', async () => {
    api.teams.mockResolvedValue([squad]);
    api.teamMembers.mockResolvedValue([teammate('admin', 'ada', 'lead')]);
    api.members.mockRejectedValue(new WakaclockError('role does not permit this action', 403));
    renderPanel();

    expect(await screen.findByText('Lead')).toBeInTheDocument();
    expect(
      screen.getByText('Only organization owners and admins can change who is on a team.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Create a team' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    await waitFor(() => expect(api.members).toHaveBeenCalledTimes(1));
  });

  it('retries other member-list failures before giving up', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } });
    api.teams.mockResolvedValue([]);
    api.members.mockRejectedValue(new Error('PostgreSQL is not configured'));
    render(
      <QueryClientProvider client={client}>
        <OrganizationTeamsPanel organizationId="org-1" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('An organization admin can create teams.')).toBeInTheDocument();
    await waitFor(() => expect(api.members).toHaveBeenCalledTimes(3));
  });

  it('waits for a signed-in user', () => {
    store.userId = null;
    renderPanel();

    expect(api.teams).not.toHaveBeenCalled();
    expect(api.members).not.toHaveBeenCalled();
  });
});
