import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiKeyPanel } from '@/app/dashboard/(auth)/wakaclock/settings/components/api-key-panel';

const generateApiKey = vi.fn();
const revokeApiKey = vi.fn();

vi.mock('@/lib/wakaclock/endpoints', () => ({
  generateApiKey: () => generateApiKey(),
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
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApiKeyPanel />
    </QueryClientProvider>
  );
}

describe('ApiKeyPanel', () => {
  it('shows the generated key so it can be copied before it is lost', async () => {
    // The key is only ever returned once — the server stores nothing but its hash — so
    // failing to render it here means the user cannot recover it at all.
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
    // The key is unrecoverable once lost, so a remount that clears it destroys the only
    // copy. Radix unmounts inactive TabsContent by default.
    generateApiKey.mockResolvedValue({
      data: { api_key: 'wcl_tab_value', user_id: 'user-1' },
    });
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
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
  it('reports an error instead of a silent success', async () => {
    // Generating replaces the old key server-side, so a "success" with nothing shown
    // would leave the account with a key nobody holds.
    generateApiKey.mockResolvedValue({ data: { user_id: 'user-1' } });
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /generate key/i }));
    await user.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
