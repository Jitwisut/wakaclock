import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';

import { SendHeartbeatDialog } from '@/app/dashboard/(auth)/wakaclock/heartbeats/components/send-heartbeat-dialog';
import { sendHeartbeat, sendHeartbeatsBulk } from '@/lib/wakaclock/endpoints';

const state = vi.hoisted(() => ({ user: 'owner' as null | string }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: null | string }) => unknown) =>
    select({ userId: state.user }),
}));
vi.mock('@/lib/wakaclock/endpoints', () => ({
  sendHeartbeat: vi.fn(),
  sendHeartbeatsBulk: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  state.user = 'owner';
  vi.mocked(sendHeartbeat).mockResolvedValue({ status: 'ok', heartbeats_inserted: 1 });
  vi.mocked(sendHeartbeatsBulk).mockResolvedValue({ status: 'ok', heartbeats_inserted: 2 });
});
function setup(timezone: null | string = 'Asia/Bangkok') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = () => (
    <QueryClientProvider client={client}>
      <SendHeartbeatDialog date="2026-10-01" timezone={timezone} />
    </QueryClientProvider>
  );
  return { ...render(view()), view, invalidate: vi.spyOn(client, 'invalidateQueries') };
}

it('labels every input and sends the selected fields, then invalidates the selected local day', async () => {
  const view = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Send test heartbeat' }));
  fireEvent.change(screen.getByLabelText('Entity'), { target: { value: 'fixture.ts' } });
  fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'url' } });
  fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'Fixture' } });
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'TypeScript' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'debugging' } });
  fireEvent.click(screen.getByLabelText('is_write'));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() =>
    expect(sendHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'owner',
        entity: 'fixture.ts',
        entity_type: 'url',
        project: 'Fixture',
        language: 'TypeScript',
        category: 'debugging',
        is_write: false,
      }),
      expect.anything()
    )
  );
  expect(view.invalidate).toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalledWith('Heartbeat inserted (1)');
});

it('keeps rejected writes visible and disables a pending request', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(sendHeartbeat).mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Send test heartbeat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
  await act(async () => reject(new Error('offline')));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('offline'));
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('validates bulk JSON, reports server failures and submits a valid batch', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Send test heartbeat' }));
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Bulk JSON' }), {
    button: 0,
    ctrlKey: false,
  });
  const input = await screen.findByRole('textbox', { name: 'Heartbeat batch JSON' });
  fireEvent.change(input, { target: { value: '{}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send batch' }));
  expect(toast.error).toHaveBeenCalledWith('Expected a JSON array');
  fireEvent.change(input, { target: { value: 'not json' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send batch' }));
  expect(sendHeartbeatsBulk).not.toHaveBeenCalled();
  vi.mocked(sendHeartbeatsBulk).mockRejectedValueOnce(new Error('denied'));
  fireEvent.change(input, {
    target: { value: '[{"entity":"fixture.rs","entity_type":"file","time":1}]' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send batch' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Send batch' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Bulk insert: 2 heartbeats'));
});

it('disables entry when owner or timezone is unavailable', () => {
  state.user = null;
  const view = setup();
  expect(screen.getByRole('button', { name: 'Send test heartbeat' })).toBeDisabled();
  view.unmount();
  state.user = 'owner';
  setup(null);
  expect(screen.getByRole('button', { name: 'Send test heartbeat' })).toBeDisabled();
});
