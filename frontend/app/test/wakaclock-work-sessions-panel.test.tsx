import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { WorkSessionsPanel } from '@/components/wakaclock/work-sessions-panel';
import { getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { getWorkSessions } from '@/lib/wakaclock/work-sessions';

const state = vi.hoisted(() => ({
  user: 'owner-a' as null | string,
  enabled: true,
  params: 'keep=yes',
  start: '2026-10-01',
  end: '2026-10-02',
  replace: vi.fn(),
  setRange: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wakaclock/ai',
  useSearchParams: () => new URLSearchParams(state.params),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('@/hooks/use-capabilities', () => ({
  useCapabilities: () => ({ featureAvailability: { work_session_receipts: state.enabled } }),
}));
vi.mock('@/hooks/use-wakaclock-range', () => ({
  useWakaclockRange: () => ({ start: state.start, end: state.end, setRange: state.setRange }),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (value: { userId: null | string }) => unknown) =>
    select({ userId: state.user }),
}));
vi.mock('@/lib/wakaclock/endpoints', () => ({ getProjectAnalytics: vi.fn() }));
vi.mock('@/lib/wakaclock/work-sessions', async (original) => ({
  ...(await original<object>()),
  getWorkSessions: vi.fn(),
}));
vi.mock('@/components/wakaclock/range-picker', () => ({
  RangePicker: ({ onChange }: { onChange: (range: { start: string; end: string }) => void }) => (
    <button onClick={() => onChange({ start: '2026-09-01', end: '2026-09-02' })}>
      Change range
    </button>
  ),
}));
vi.mock('@/components/wakaclock/work-session-receipt', () => ({
  WorkSessionReceiptDrawer: ({
    id,
    userId,
    onClose,
  }: {
    id: string;
    userId: string;
    onClose: () => void;
  }) => (
    <button onClick={onClose}>
      {userId}:{id}:close
    </button>
  ),
}));
const empty = { items: [], has_more: false, next_cursor: null };
const row = {
  id: 'first',
  agent: 'codex',
  first_observed_at: 1,
  last_observed_at: 2,
  identity_status: 'scoped',
  usage_events: 1,
};
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = () => (
    <QueryClientProvider client={client}>
      <WorkSessionsPanel />
    </QueryClientProvider>
  );
  return { ...render(view()), view, client };
}
beforeEach(() => {
  Object.assign(state, {
    user: 'owner-a',
    enabled: true,
    params: 'keep=yes',
    start: '2026-10-01',
    end: '2026-10-02',
  });
  vi.mocked(getWorkSessions).mockResolvedValue(empty);
  vi.mocked(getProjectAnalytics).mockResolvedValue({
    items: [{ project_id: 'project-a', name: 'Project A' }],
    next_cursor: null,
  } as Awaited<ReturnType<typeof getProjectAnalytics>>);
});

it('does not fetch or render when signed out or the feature is disabled', () => {
  state.user = null;
  const view = setup();
  expect(screen.queryByText('Work sessions')).not.toBeInTheDocument();
  state.user = 'owner-a';
  state.enabled = false;
  view.rerender(view.view());
  expect(getWorkSessions).not.toHaveBeenCalled();
});

it('shows loading then an honest empty state', async () => {
  let finish!: (value: typeof empty) => void;
  vi.mocked(getWorkSessions).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  setup();
  expect(screen.getByRole('status')).toHaveTextContent('Loading sessions');
  await act(async () => finish(empty));
  expect(await screen.findByText('No received usage sessions in this range.')).toBeVisible();
});

it('retries failed sessions and explains a failed project filter request', async () => {
  vi.mocked(getWorkSessions).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(empty);
  vi.mocked(getProjectAnalytics).mockRejectedValue(new Error('offline'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load sessions');
  expect(await screen.findByText('Project filters could not be loaded.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No received usage sessions in this range.')).toBeVisible();
});

it('uses filters and cursors, opens the URL, and clears a selected session without losing other parameters', async () => {
  vi.mocked(getWorkSessions).mockImplementation(async (_filters, cursor) =>
    cursor
      ? { ...empty, items: [{ ...row, id: 'second', agent: 'claude-code' }] }
      : { items: [row], next_cursor: 'signed-cursor', has_more: true }
  );
  const view = setup();
  fireEvent.click(await screen.findByRole('button', { name: /codex.*received usage events/ }));
  expect(state.replace).toHaveBeenLastCalledWith('/dashboard/wakaclock/ai?keep=yes&session=first', {
    scroll: false,
  });
  fireEvent.click(screen.getByRole('button', { name: 'More sessions' }));
  expect(
    await screen.findByRole('button', { name: /claude-code.*received usage events/ })
  ).toBeVisible();
  expect(getWorkSessions).toHaveBeenLastCalledWith(
    expect.objectContaining({ start: '2026-10-01', end: '2026-10-02' }),
    'signed-cursor'
  );
  fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'claude-code' } });
  fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'project-a' } });
  await waitFor(() =>
    expect(getWorkSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ agent: 'claude-code', project_id: 'project-a' }),
      undefined
    )
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change range' }));
  expect(state.setRange).toHaveBeenCalledWith({ start: '2026-09-01', end: '2026-09-02' });
  state.params = 'keep=yes&session=first';
  view.rerender(view.view());
  fireEvent.click(screen.getByRole('button', { name: 'owner-a:first:close' }));
  expect(state.replace).toHaveBeenLastCalledWith('/dashboard/wakaclock/ai?keep=yes', {
    scroll: false,
  });
});

it('does not display the previous owner sessions while the new account loads', async () => {
  vi.mocked(getWorkSessions).mockResolvedValue({ ...empty, items: [row] });
  const view = setup();
  expect(await screen.findByRole('button', { name: /codex.*received usage events/ })).toBeVisible();
  vi.mocked(getWorkSessions).mockReturnValue(new Promise(() => {}));
  state.user = 'owner-b';
  view.rerender(view.view());
  expect(
    screen.queryByRole('button', { name: /codex.*received usage events/ })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading sessions');
});

it('starts a new first page when the date range changes and never reuses the old cursor', async () => {
  vi.mocked(getWorkSessions).mockImplementation(async (filters, cursor) => {
    if (filters.start === '2026-09-01')
      return { ...empty, items: [{ ...row, agent: 'september' }] };
    return cursor
      ? { ...empty, items: [{ ...row, id: 'page-two', agent: 'old-page-two' }] }
      : { items: [row], has_more: true, next_cursor: 'october-cursor' };
  });
  const view = setup();
  await screen.findByRole('button', { name: /codex.*received usage events/ });
  fireEvent.click(screen.getByRole('button', { name: 'More sessions' }));
  await screen.findByRole('button', { name: /old-page-two.*received usage events/ });
  state.start = '2026-09-01';
  state.end = '2026-09-02';
  view.rerender(view.view());
  expect(
    await screen.findByRole('button', { name: /september.*received usage events/ })
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /old-page-two.*received usage events/ })
  ).not.toBeInTheDocument();
  expect(getWorkSessions).toHaveBeenLastCalledWith(
    expect.objectContaining({ start: state.start, end: state.end }),
    undefined
  );
  expect(getProjectAnalytics).toHaveBeenLastCalledWith(
    expect.objectContaining({ start: state.start, end: state.end })
  );
  expect(screen.queryByRole('button', { name: 'More sessions' })).not.toBeInTheDocument();
});
