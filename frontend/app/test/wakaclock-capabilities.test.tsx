import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';
import { unwrapV2, wakaclockV2Client } from '@/lib/wakaclock/client-v2';
import { setCurrentToken, setUnauthorizedHandler } from '@/lib/wakaclock/session';

import type { AxiosResponse } from 'axios';

const getCapabilities = vi.hoisted(() => vi.fn());

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ getCapabilities }));

function renderGated() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <RequiresPostgres feature="Goals">
        <p>goal list</p>
      </RequiresPostgres>
    </QueryClientProvider>
  );
}

describe('unwrapV2', () => {
  it('returns the payload without the envelope', () => {
    const response = {
      data: {
        data: { postgres_enabled: true },
        meta: {
          coverage: null,
          data_freshness: 'realtime',
          generated_at: '2026-08-23T00:00:00Z',
          request_id: 'r1',
          timezone: 'UTC',
        },
      },
    } as AxiosResponse<{ data: { postgres_enabled: boolean }; meta: never }>;

    expect(unwrapV2(response)).toEqual({ postgres_enabled: true });
  });
});

describe('RequiresPostgres', () => {
  it('renders the feature when the server has a transactional store', async () => {
    getCapabilities.mockResolvedValue({ postgres_enabled: true });

    renderGated();

    expect(await screen.findByText('goal list')).toBeInTheDocument();
  });

  /**
   * A ClickHouse-only server is a supported configuration, not a failure — so the page
   * has to explain that rather than render a wall of failed requests.
   */
  it('explains the feature is unavailable instead of rendering it', async () => {
    getCapabilities.mockResolvedValue({ postgres_enabled: false });

    renderGated();

    expect(await screen.findByText(/needs a transactional store/i)).toBeInTheDocument();
    expect(screen.queryByText('goal list')).not.toBeInTheDocument();
  });

  /**
   * Unknown is not unavailable. Showing the notice while the answer is in flight would
   * flash it on every page load for the deployments that do have Postgres.
   */
  it('shows neither the feature nor the notice while the answer is unknown', () => {
    getCapabilities.mockReturnValue(new Promise(() => {}));

    const { container } = renderGated();

    expect(screen.queryByText('goal list')).not.toBeInTheDocument();
    expect(screen.queryByText(/needs a transactional store/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });
});

describe('wakaclockV2Client', () => {
  it('attaches the session token the v1 client already uses', async () => {
    setCurrentToken('token-abc');

    const config = await Promise.resolve(
      // @ts-expect-error — reaching into the interceptor is the point of the test.
      wakaclockV2Client.interceptors.request.handlers[0].fulfilled({ headers: {} })
    );

    expect(config.headers.Authorization).toBe('Bearer token-abc');
    setCurrentToken(null);
  });

  /**
   * v2 shares the session with v1, so a rejected token has to end the session here too.
   * Without this, a stale token would leave the v2 pages failing forever while the rest
   * of the app had already sent the visitor back to sign in.
   */
  it('ends the session when the server rejects the token', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    // @ts-expect-error — as above.
    const rejected = wakaclockV2Client.interceptors.response.handlers[0].rejected({
      config: { url: '/me/goals' },
      response: { data: { error: 'authentication required' }, status: 401 },
    });

    await expect(rejected).rejects.toMatchObject({
      message: 'authentication required',
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    setUnauthorizedHandler(null);
  });
});
