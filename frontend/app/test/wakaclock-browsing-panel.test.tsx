import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BrowsingPanel } from '@/app/dashboard/(auth)/wakaclock/components/browsing-panel';

const api = vi.hoisted(() => ({ getDashboardAnalytics: vi.fn() }));
const store = vi.hoisted(() => ({ userId: 'user-1' as null | string }));
vi.mock('@/lib/wakaclock/endpoints', () => api);
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: typeof store) => unknown) => selector(store),
}));
vi.mock('@/hooks/use-wakaclock-range', () => ({
  useWakaclockRange: () => ({ end: '2026-10-06', start: '2026-10-01' }),
}));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BrowsingPanel />
    </QueryClientProvider>
  );
  return client;
}
afterEach(() => {
  vi.clearAllMocks();
  store.userId = 'user-1';
});
describe('BrowsingPanel', () => {
  it('renders measured union and each server-provided breakdown', async () => {
    api.getDashboardAnalytics.mockResolvedValue({
      browsing: {
        total_seconds: 600,
        calculation_version: 'browser_foreground_v1',
        domains: [{ name: 'example.com', seconds: 600 }],
        projects: [{ name: 'Docs', seconds: 600 }],
        daily: [{ name: '2026-10-06', seconds: 600 }],
      },
    });
    mount();
    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Projects' })).getByText('Docs')
    ).toBeInTheDocument();
    expect(screen.getByText('2026-10-06')).toBeInTheDocument();
    expect(screen.getByText(/separate from Coding/)).toBeInTheDocument();
  });
  it('shows onboarding for measured zero', async () => {
    api.getDashboardAnalytics.mockResolvedValue({
      browsing: { total_seconds: 0, domains: [], projects: [], daily: [] },
    });
    mount();
    expect(await screen.findByText(/Enable tracking/)).toBeInTheDocument();
  });
  it('tolerates older API deployments', async () => {
    api.getDashboardAnalytics.mockResolvedValue({});
    mount();
    expect(await screen.findByText(/unavailable on this server version/)).toBeInTheDocument();
  });
  it('renders request failure', async () => {
    api.getDashboardAnalytics.mockRejectedValue(new Error('network unavailable'));
    mount();
    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
  it('renders loading and makes no request without an account', async () => {
    store.userId = null;
    const options = Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...options,
      timeZone: '',
    });
    mount();
    await waitFor(() => expect(api.getDashboardAnalytics).not.toHaveBeenCalled());
  });
});
