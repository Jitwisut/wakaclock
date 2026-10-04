import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiKeyPanel } from '@/app/dashboard/(auth)/wakaclock/settings/components/api-key-panel';

const generateApiKey = vi.fn();
const revokeApiKey = vi.fn();
const getCurrentApiKey = vi.fn().mockResolvedValue({ data: { api_key: null, user_id: 'user-1' } });

vi.mock('@/lib/wakaclock/endpoints', () => ({
  generateApiKey: () => generateApiKey(),
  getCurrentApiKey: () => getCurrentApiKey(),
  revokeApiKey: () => revokeApiKey(),
}));

vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (s: { userId: string }) => unknown) =>
    selector({ userId: 'user-1' }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApiKeyPanel />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // Vitest resets mock implementations between tests. Keep the read query a valid
  // Promise in every case; individual tests override it when they need a stored key.
  getCurrentApiKey.mockResolvedValue({ data: { api_key: null, user_id: 'user-1' } });
});

describe('ApiKeyPanel', () => {
  it('shows the generated key so it can be copied', async () => {
    // The freshly generated key must appear immediately, without waiting for a refetch.
    generateApiKey.mockResolvedValue({
      data: { api_key: 'wcl_secret_value', user_id: 'user-1' },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /generate key/i }));
    await user.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('wcl_secret_value')).toBeInTheDocument();
    });
  });
});

describe('ApiKeyPanel inside the Settings tabs', () => {
  it('keeps the generated key visible after switching tabs and back', async () => {
    // Radix unmounts inactive TabsContent by default, which used to discard the key held
    // in this panel's state. Still guarded even though the key is now refetchable.
    generateApiKey.mockResolvedValue({
      data: { api_key: 'wcl_tab_value', user_id: 'user-1' },
    });
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    // Mirrors the real Settings page's tab wiring, so this fails if the forceMount
    // that keeps the key alive is ever dropped.
    const { Tabs, TabsContent, TabsList, TabsTrigger } = await import('@/components/ui/tabs');

    render(
      <QueryClientProvider client={client}>
        <Tabs defaultValue="api-key">
          <TabsList>
            <TabsTrigger value="api-key">API key</TabsTrigger>
            <TabsTrigger value="rules">Project rules</TabsTrigger>
          </TabsList>
          <TabsContent className="data-[state=inactive]:hidden" forceMount value="api-key">
            <ApiKeyPanel />
          </TabsContent>
          <TabsContent value="rules">rules</TabsContent>
        </Tabs>
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /generate key/i }));
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    await waitFor(() => expect(screen.getByDisplayValue('wcl_tab_value')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /project rules/i }));
    await user.click(screen.getByRole('tab', { name: /api key/i }));

    expect(screen.queryByDisplayValue('wcl_tab_value')).toBeInTheDocument();
  });
});

describe('ApiKeyPanel when the response has no key', () => {
  it.each([undefined, {}, { data: { user_id: 'user-1' } }])(
    'reports an error instead of a silent success for %j',
    async (response) => {
      // Generating replaces the old key server-side, so a "success" with nothing shown
      // would leave the account with a key nobody holds.
      generateApiKey.mockResolvedValue(response);
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByRole('button', { name: /generate key/i }));
      await user.click(screen.getByRole('button', { name: /^generate$/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(toast.success).not.toHaveBeenCalled();
    }
  );
});

describe('ApiKeyPanel on load', () => {
  it('shows a stored key from the read endpoint, hidden by default', async () => {
    // When the server holds a sealed copy it returns the key so the user can
    // paste it again after closing the tab — but it must not be on screen until
    // a deliberate reveal.
    getCurrentApiKey.mockResolvedValue({
      data: { api_key: 'wcl_already_stored', user_id: 'user-1' },
    });
    const user = userEvent.setup();
    renderPanel();

    const field = (await screen.findByDisplayValue('wcl_already_stored')) as HTMLInputElement;
    expect(field.type).toBe('password');
    expect(generateApiKey).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /reveal api key/i }));
    expect((screen.getByDisplayValue('wcl_already_stored') as HTMLInputElement).type).toBe('text');

    await user.click(screen.getByRole('button', { name: /hide api key/i }));
    expect((screen.getByDisplayValue('wcl_already_stored') as HTMLInputElement).type).toBe(
      'password'
    );
  });

  it('does not surface another user’s key from a stale cache', async () => {
    getCurrentApiKey.mockResolvedValue({
      data: { api_key: 'wcl_other_user', user_id: 'user-2' },
    });
    renderPanel();

    await waitFor(() => expect(getCurrentApiKey).toHaveBeenCalled());
    expect(screen.queryByDisplayValue('wcl_other_user')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate key/i })).toBeInTheDocument();
  });

  it('keeps a freshly generated key hidden until revealed', async () => {
    generateApiKey.mockResolvedValue({
      data: { api_key: 'wcl_fresh_value', user_id: 'user-1' },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /generate key/i }));
    await user.click(screen.getByRole('button', { name: /^generate$/i }));

    const field = (await screen.findByDisplayValue('wcl_fresh_value')) as HTMLInputElement;
    expect(field.type).toBe('password');
  });
});

describe('ApiKeyPanel actions', () => {
  it('copies the stored key to the clipboard', async () => {
    getCurrentApiKey.mockResolvedValue({
      data: { api_key: 'wcl_copy_me', user_id: 'user-1' },
    });
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderPanel();

    await screen.findByDisplayValue('wcl_copy_me');
    await user.click(screen.getByRole('button', { name: /copy api key/i }));

    expect(writeText).toHaveBeenCalledWith('wcl_copy_me');
  });

  it('revokes the key and clears it from the screen', async () => {
    getCurrentApiKey.mockResolvedValue({
      data: { api_key: 'wcl_to_revoke', user_id: 'user-1' },
    });
    revokeApiKey.mockResolvedValue({ status: 'ok' });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByDisplayValue('wcl_to_revoke');
    getCurrentApiKey.mockResolvedValue({ data: { api_key: null, user_id: 'user-1' } });
    await user.click(screen.getByRole('button', { name: /revoke key/i }));
    await user.click(screen.getByRole('button', { name: /^revoke$/i }));

    await waitFor(() =>
      expect(screen.queryByDisplayValue('wcl_to_revoke')).not.toBeInTheDocument()
    );
    expect(revokeApiKey).toHaveBeenCalled();
  });

  it('reports a failed generate request', async () => {
    generateApiKey.mockRejectedValue(new Error('boom'));
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /generate key/i }));
    await user.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
  });

  it('reports a failed revoke request', async () => {
    revokeApiKey.mockRejectedValue(new Error('nope'));
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /revoke key/i }));
    await user.click(screen.getByRole('button', { name: /^revoke$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nope'));
  });
});

describe('ApiKeyPanel quick setup', () => {
  it('copies the stdin CLI command, never the key itself', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderPanel();

    await user.click(screen.getByRole('button', { name: /copy cli command/i }));

    expect(writeText).toHaveBeenCalledWith('pbpaste | wakaclock config set-key --stdin');
  });

  it('reports a clipboard failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const { toast } = await import('sonner');
    renderPanel();

    await user.click(screen.getByRole('button', { name: /copy cli command/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not copy to the clipboard')
    );
  });

  it('switches to the VS Code steps', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: 'VS Code' }));

    expect(await screen.findByText('Run “AtoAxis: Set API Key”')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'VS Code' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ApiKeyPanel with reduced motion', () => {
  it('still copies, confirms and resets without animating', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const writeText = vi.spyOn(navigator.clipboard, 'writeText');
      renderPanel();

      await user.click(screen.getByRole('tab', { name: 'VS Code' }));
      await user.click(screen.getByRole('tab', { name: 'CLI' }));
      await user.click(screen.getByRole('button', { name: /copy cli command/i }));
      expect(writeText).toHaveBeenCalledTimes(1);

      // The check mark reverts to the copy icon once the confirmation window passes.
      await act(async () => {
        vi.advanceTimersByTime(1700);
      });
      expect(screen.getByRole('button', { name: /copy cli command/i })).toBeEnabled();
    } finally {
      vi.useRealTimers();
      window.matchMedia = original;
    }
  });
});
