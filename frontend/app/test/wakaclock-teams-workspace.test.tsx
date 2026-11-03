import * as React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TeamsPage from '@/app/dashboard/(auth)/wakaclock/teams/page';
import {
  humanize,
  statusTone,
} from '@/app/dashboard/(auth)/wakaclock/teams/components/team-overview';
import { isTeamSection } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-sections';
import { WakaclockError } from '@/lib/wakaclock/client';

const mocks = vi.hoisted(() => ({
  organizations: vi.fn(),
  health: vi.fn(),
  insights: vi.fn(),
}));
const { stub } = vi.hoisted(() => ({
  stub: (name: string) =>
    function Stub() {
      return <div data-testid={name} />;
    },
}));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizations: mocks.organizations }));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({ getTeamMeasurementHealth: mocks.health }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (s: (value: { token: string; userId: string }) => unknown) =>
    s({ token: 'token', userId: 'alice' }),
}));
vi.mock('@/components/wakaclock/require-user', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/wakaclock/requires-postgres', () => ({
  RequiresPostgres: ({ children }: { children: React.ReactNode }) => children,
}));

// The URL is the navigation state. History calls notify a tiny store so the mocked
// `useSearchParams` re-renders the way Next.js does for native History API calls.
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const search = React.useSyncExternalStore(
      (notify) => {
        window.addEventListener('test:navigate', notify);
        return () => window.removeEventListener('test:navigate', notify);
      },
      () => window.location.search
    );
    return new URLSearchParams(search);
  },
}));

vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/organization-invites', () => ({
  MyOrganizationInvites: stub('my-invites'),
  OrganizationInvitesPanel: stub('invites'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/organization-teams-panel', () => ({
  OrganizationTeamsPanel: stub('teams'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-actions-panel', () => ({
  TeamActionsPanel: stub('actions'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-billing-setup-panel', () => ({
  TeamBillingSetupPanel: stub('billing'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-comparison-panel', () => ({
  TeamComparisonPanel: stub('comparison'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-github-panel', () => ({
  TeamGithubPanel: stub('github'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-insights-panel', () => ({
  TeamInsightsPanel: (props: { end: string; start: string }) => {
    mocks.insights(props);
    return <div data-testid="insights">{`${props.start}..${props.end}`}</div>;
  },
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-onboarding-panel', () => ({
  TeamOnboardingPanel: stub('onboarding'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-organization-create-panel', () => ({
  TeamOrganizationCreatePanel: stub('create'),
}));
vi.mock(
  '@/app/dashboard/(auth)/wakaclock/teams/components/team-organization-recovery-panel',
  () => ({
    TeamOrganizationRecoveryPanel: stub('recovery'),
  })
);
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-summary-panel', () => ({
  TeamSummaryPanel: stub('summary'),
}));
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-trust-panel', () => ({
  TeamTrustPanel: stub('trust'),
}));

const state = (status: string, reason = 'snapshot') => ({ status, reason, updated_at: null });
const health = {
  capabilities: { improvement_actions: true, weekly_comparison: true, weekly_summary: true },
  checked_at: '2026-11-03T08:30:00Z',
  own: { capture: state('healthy', 'events_flowing'), delivery: state('pending') },
  report_timezone: 'Asia/Bangkok',
  restore: state('failed'),
  team: {
    capture: state('withheld'),
    delivery: state('withheld'),
    integration: state('unconfirmed'),
    retention: state('healthy'),
  },
};
const ORGS = [
  { id: 'org-a', name: 'Northwind Labs', slug: 'northwind' },
  { id: 'org-b', name: 'Acme', slug: 'acme' },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TeamsPage />
    </QueryClientProvider>
  );
}

const nav = () => screen.getByRole('navigation', { name: 'Teams' });

beforeEach(() => {
  window.history.replaceState(null, '', '/dashboard/wakaclock/teams');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args) => {
      original(...args);
      window.dispatchEvent(new Event('test:navigate'));
    });
  }
  mocks.organizations.mockResolvedValue(ORGS);
  mocks.health.mockResolvedValue(health);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Teams workspace', () => {
  it('opens the first organization on its overview with health at a glance', async () => {
    renderPage();
    expect(await screen.findByText('@northwind', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeInTheDocument();
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const glance = await screen.findByRole('group', { name: 'Data health at a glance' });
    await waitFor(() => expect(within(glance).getByText('Events flowing')).toBeInTheDocument());
    expect(within(glance).getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Asia/Bangkok')).toBeInTheDocument();
    for (const id of ['onboarding', 'recovery', 'trust', 'my-invites']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('billing')).not.toBeInTheDocument();
  });

  it('moves between sections through the URL and back', async () => {
    renderPage();
    await screen.findByText('@northwind', { selector: 'p' });
    fireEvent.click(within(nav()).getByRole('button', { name: 'People' }));
    expect(window.location.search).toBe('?org=org-a&section=people');
    expect(await screen.findByTestId('teams')).toBeInTheDocument();
    expect(screen.getByTestId('invites')).toBeInTheDocument();
    expect(within(nav()).getByRole('button', { name: 'People' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: /Billing/ }));
    expect(await screen.findByTestId('billing')).toBeInTheDocument();

    fireEvent.click(within(nav()).getByRole('button', { name: 'Integrations' }));
    expect(await screen.findByTestId('github')).toBeInTheDocument();

    // The phone back button returns to the list.
    fireEvent.click(screen.getByRole('button', { name: 'Teams' }));
    expect(window.location.search).toBe('?org=org-a');
  });

  it('jumps to a section from an overview shortcut and scrolls the window into view', async () => {
    renderPage();
    await screen.findByText('@northwind', { selector: 'p' });
    const shell = screen.getByRole('complementary').parentElement as HTMLElement;
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({ top: -200 } as DOMRect);
    const shortcuts = screen.getByRole('navigation', { name: 'Organization shortcuts' });
    fireEvent.click(within(shortcuts).getByRole('button', { name: /Insights/ }));
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(await screen.findByTestId('insights')).toBeInTheDocument();
  });

  it('reads completed weeks in the organization timezone and lets the visitor pick one', async () => {
    window.history.replaceState(null, '', '?org=org-b&section=insights');
    renderPage();
    const picker = await screen.findByRole('combobox', { name: 'Completed report week' });
    expect(screen.getByText(/Weeks close in Asia\/Bangkok/)).toBeInTheDocument();
    for (const id of ['comparison', 'summary', 'actions']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    const options = within(picker).getAllByRole('option') as HTMLOptionElement[];
    fireEvent.change(picker, { target: { value: options[1]?.value } });
    await waitFor(() =>
      expect(mocks.insights).toHaveBeenLastCalledWith(
        expect.objectContaining({ start: options[1]?.value })
      )
    );
  });

  it('explains that reports wait for a completed week when health has no timezone', async () => {
    mocks.health.mockResolvedValue({ ...health, capabilities: undefined, report_timezone: '' });
    window.history.replaceState(null, '', '?section=insights');
    renderPage();
    expect(
      await screen.findByText('Reports appear here once the organization has a completed week.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('filters sections from the search field and opens the first match on Enter', async () => {
    renderPage();
    await screen.findByText('@northwind', { selector: 'p' });
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'github' } });
    expect(
      within(nav())
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Integrations']);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByTestId('github')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No settings match “zzz”.')).toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).toHaveValue('');
  });

  it('switches organization from the account card', async () => {
    renderPage();
    await screen.findByText('@northwind', { selector: 'p' });
    const trigger = screen.getByRole('button', { name: /Switch organization/ });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Acme/ }));
    expect(window.location.search).toBe('?org=org-b');
    expect(await screen.findByText('@acme', { selector: 'p' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: /Switch organization/ }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: /New Organization/ }));
    expect(await screen.findByTestId('create')).toBeInTheDocument();
  });

  it('welcomes a visitor without an organization and offers only creation', async () => {
    mocks.organizations.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Bring your team together')).toBeInTheDocument();
    expect(screen.getByTestId('create')).toBeInTheDocument();
    expect(
      within(nav())
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['New Organization']);
    // Nothing to go back to.
    expect(screen.queryByRole('button', { name: 'Teams' })).not.toBeInTheDocument();
    expect(mocks.health).not.toHaveBeenCalled();
  });

  it('shows the request error instead of organizations', async () => {
    mocks.organizations.mockRejectedValue(new WakaclockError('organizations offline', 503));
    renderPage();
    expect(await screen.findByText('organizations offline')).toBeInTheDocument();
  });

  it('keeps panels behind a loading state until the organization list settles', async () => {
    let resolve: (value: typeof ORGS) => void = () => undefined;
    mocks.organizations.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    expect(await screen.findByTestId('teams-loading')).toBeInTheDocument();
    await act(async () => resolve(ORGS));
    expect(await screen.findByText('@northwind', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('Teams helpers', () => {
  it('maps server health words onto tones', () => {
    expect(statusTone(undefined)).toBe('idle');
    expect(statusTone('Failed')).toBe('bad');
    expect(statusTone('not_configured')).toBe('idle');
    expect(statusTone('synced')).toBe('good');
    expect(statusTone('observed')).toBe('warn');
    expect(humanize('events_flowing')).toBe('Events flowing');
  });

  it('recognises only known section ids', () => {
    expect(isTeamSection('people')).toBe(true);
    expect(isTeamSection('nope')).toBe(false);
    expect(isTeamSection(null)).toBe(false);
  });
});
