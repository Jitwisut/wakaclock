import { cloneElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { KeystrokesPanel } from '@/app/dashboard/(auth)/wakaclock/keystrokes/components/keystrokes-panel';
import { DashboardPanelsProvider } from '@/components/dashboard-panels';
import { getKeystrokeStats } from '@/lib/wakaclock/endpoints';
import type { KeystrokeStatsData } from '@/lib/wakaclock/types';
vi.mock('@/lib/wakaclock/endpoints', () => ({ getKeystrokeStats: vi.fn() }));
const owner = vi.hoisted(() => ({ value: 'owner' as string | null }));
vi.mock('@/lib/wakaclock/user-store', () => ({ useWakaclockUserStore: () => owner.value }));
vi.mock('@/hooks/use-wakaclock-range', () => ({
  useWakaclockRange: () => ({ start: '2026-10-01', end: '2026-10-02', setRange: vi.fn() }),
}));
// Supply deterministic layout in jsdom; charts, axes and tick formatting are real.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({
    children,
  }: {
    children: ReactElement<{ width: number; height: number }>;
  }) => cloneElement(children, { width: 640, height: 220 }),
}));
const counts = {
  keystrokes: 10,
  chars_added: 10,
  chars_deleted: 1,
  copy_actions: 2,
  paste_actions: 1,
  copied_chars: 6,
  pasted_chars: 3,
  copied_lines: 2,
  pasted_lines: 1,
  paste_same_file_actions: 1,
  paste_same_workspace_actions: 0,
  paste_external_or_unknown_actions: 0,
};
const stats: KeystrokeStatsData = {
  total_keystrokes: 30,
  total_chars_added: 10,
  total_chars_deleted: 1,
  total_copy_actions: 2,
  total_paste_actions: 1,
  total_copied_chars: 6,
  total_pasted_chars: 3,
  total_copied_lines: 2,
  total_pasted_lines: 1,
  total_paste_same_file_actions: 1,
  total_paste_same_workspace_actions: 0,
  total_paste_external_or_unknown_actions: 0,
  days_with_activity: 1,
  clipboard_coverage: { percent: 50, supported_vscode_heartbeats: 1, total_vscode_heartbeats: 2 },
  projects: [
    { ...counts, name: 'Low' },
    { ...counts, name: 'High', keystrokes: 20 },
  ],
  daily: [{ ...counts, date: '2026-10-01' }],
};
function mount() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DashboardPanelsProvider>
        <KeystrokesPanel />
      </DashboardPanelsProvider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  owner.value = 'owner';
});
it('requests the selected owner and dates, sorts projects and renders local date ticks in all three charts', async () => {
  vi.mocked(getKeystrokeStats).mockResolvedValue({
    start: '2026-10-01',
    end: '2026-10-02',
    data: stats,
  });
  mount();
  const table = await screen.findByRole('table');
  expect(getKeystrokeStats).toHaveBeenCalledWith('owner', '2026-10-01', '2026-10-02');
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('High');
  expect(within(table).getAllByRole('row')[2]).toHaveTextContent('Low');
  expect(await screen.findAllByText('10-01')).toHaveLength(3);
  expect(screen.getByText(/Clipboard contents are never sent or stored/)).toBeVisible();
});
it('keeps failed requests distinct from an empty measured range', async () => {
  vi.mocked(getKeystrokeStats).mockRejectedValue(new Error('offline'));
  const view = mount();
  expect(await screen.findByText('Request failed')).toBeVisible();
  expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
  view.unmount();
  vi.mocked(getKeystrokeStats).mockResolvedValue({
    start: '2026-10-01',
    end: '2026-10-02',
    data: { ...stats, days_with_activity: 0 },
  });
  mount();
  expect(await screen.findByText('No data yet')).toBeVisible();
});
it('does not request account data before an owner is available', () => {
  owner.value = null;
  mount();
  expect(getKeystrokeStats).not.toHaveBeenCalled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
