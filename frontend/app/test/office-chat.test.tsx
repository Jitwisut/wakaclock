import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficeChat } from '@/components/presence/OfficeChat';
import { officeCommand, officeMessages } from '@/lib/wakaclock/office';
vi.mock('@/lib/wakaclock/office', () => ({ officeCommand: vi.fn(), officeMessages: vi.fn() }));
const message = {
  id: '01990000-0000-7000-8000-000000000001',
  user_id: 'user',
  username: 'Alice',
  body: 'Hello office',
  created_at: '2026-09-11T00:00:00Z',
};
beforeEach(() => {
  vi.mocked(officeMessages).mockReset().mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(officeCommand).mockReset().mockResolvedValue({ ok: true });
});
describe('Office chat', () => {
  it('renders server messages as text and loads older history', async () => {
    vi.mocked(officeMessages)
      .mockResolvedValueOnce({ items: [message], next_cursor: message.id })
      .mockResolvedValueOnce({
        items: [{ ...message, id: 'older', body: '<img src=x onerror=alert(1)>' }],
        next_cursor: null,
      });
    render(<OfficeChat roomId="room-a" />);
    expect(await screen.findByText('Hello office')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(officeMessages).toHaveBeenLastCalledWith('room-a', message.id);
  });
  it('retains an unsent message and reuses its request id after a network failure', async () => {
    vi.mocked(officeCommand).mockRejectedValueOnce(new Error('Network failed'));
    render(<OfficeChat roomId="room-a" />);
    await waitFor(() => expect(officeMessages).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network failed');
    expect(screen.getByLabelText('Message')).toHaveValue('Hello');
    const first = vi.mocked(officeCommand).mock.calls[0][1];
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(officeCommand).toHaveBeenCalledTimes(2));
    expect(vi.mocked(officeCommand).mock.calls[1][1]).toEqual(first);
    await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue(''));
  });
});

it('discards an old room history response after switching rooms', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof officeMessages>>) => void;
  vi.mocked(officeMessages)
    .mockResolvedValueOnce({ items: [message], next_cursor: 'older-cursor' })
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    )
    .mockResolvedValue({
      items: [{ ...message, id: 'new-room', body: 'Room B' }],
      next_cursor: null,
    });
  const view = render(<OfficeChat roomId="room-a" />);
  await screen.findByText('Hello office');
  fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
  view.rerender(<OfficeChat roomId="room-b" />);
  await screen.findByText('Room B');
  await act(async () =>
    resolve({
      items: [{ ...message, id: 'private-old', body: 'Old room private history' }],
      next_cursor: 'old-next',
    })
  );
  expect(screen.queryByText('Old room private history')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
});

afterEach(() => vi.useRealTimers());
it.each(['resolve', 'reject'])(
  'ignores a poll that completes after leaving the room: %s',
  async (completion) => {
    let resolve!: (value: Awaited<ReturnType<typeof officeMessages>>) => void;
    let reject!: (reason: Error) => void;
    vi.mocked(officeMessages).mockReturnValueOnce(
      new Promise((done, fail) => {
        resolve = done;
        reject = fail;
      })
    );
    const view = render(<OfficeChat roomId="room-a" />);
    view.rerender(<OfficeChat roomId="room-b" />);
    await waitFor(() => expect(officeMessages).toHaveBeenCalledWith('room-b'));
    await act(async () => {
      if (completion === 'resolve') resolve({ items: [message], next_cursor: 'old-cursor' });
      else reject(new Error('Old room failure'));
    });
    expect(screen.queryByText('Hello office')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
  }
);

it('preserves the older-history cursor across live polls and ignores repeated submits while sending', async () => {
  vi.useFakeTimers();
  vi.mocked(officeMessages)
    .mockResolvedValueOnce({ items: [message], next_cursor: 'initial-cursor' })
    .mockResolvedValue({ items: [message], next_cursor: null });
  let resolve!: (value: Awaited<ReturnType<typeof officeCommand>>) => void;
  vi.mocked(officeCommand).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  render(<OfficeChat roomId="room-a" />);
  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('button', { name: 'Load older messages' })).toBeEnabled();
  const input = screen.getByLabelText('Message');
  fireEvent.change(input, { target: { value: 'Hello again' } });
  fireEvent.submit(input.closest('form')!);
  fireEvent.submit(input.closest('form')!);
  expect(officeCommand).toHaveBeenCalledOnce();
  await act(async () => resolve({ ok: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
  await act(async () => {});
  expect(officeMessages).toHaveBeenLastCalledWith('room-a', 'initial-cursor');
});

it('skips hidden-tab polling, retries visible errors and cancels its timer on unmount', async () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const view = render(<OfficeChat roomId="room-a" />);
  expect(officeMessages).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  vi.mocked(officeMessages).mockRejectedValueOnce('offline');
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('alert')).toHaveTextContent('Chat unavailable');
  vi.mocked(officeMessages).mockRejectedValueOnce(new Error('Request failed'));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('alert')).toHaveTextContent('Request failed');
  vi.mocked(officeMessages).mockResolvedValueOnce({
    items: [message, { ...message, id: 'earlier', body: 'Earlier' }],
    next_cursor: null,
  });
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  view.unmount();
  const count = vi.mocked(officeMessages).mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(4000));
  expect(officeMessages).toHaveBeenCalledTimes(count);
  hidden.mockRestore();
});
it('reports older-history and send failures without replacing loaded messages', async () => {
  vi.mocked(officeMessages)
    .mockResolvedValueOnce({ items: [message], next_cursor: 'cursor' })
    .mockRejectedValueOnce(new Error('History failed'));
  vi.mocked(officeCommand).mockRejectedValueOnce('offline');
  render(<OfficeChat roomId="room-a" />);
  await screen.findByText('Hello office');
  fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('History failed');
  const input = screen.getByLabelText('Message');
  fireEvent.submit(input.closest('form')!);
  expect(officeCommand).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'New' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Message not sent. Retry.')
  );
  expect(screen.getByText('Hello office')).toBeVisible();
});

it('merges the send readback in ID order without duplicating an existing message', async () => {
  vi.mocked(officeMessages)
    .mockResolvedValueOnce({ items: [{ ...message, id: '002' }], next_cursor: null })
    .mockResolvedValueOnce({
      items: [
        { ...message, id: '003', body: 'Sent message' },
        { ...message, id: '002', body: 'Updated message' },
        { ...message, id: '001', body: 'Earlier message' },
      ],
      next_cursor: null,
    });
  render(<OfficeChat roomId="room-a" />);
  await screen.findByText('Hello office');
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: ' Sent message ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByText('Sent message');
  expect(officeCommand).toHaveBeenCalledWith(
    'room-a',
    expect.objectContaining({ body: 'Sent message', kind: 'message' })
  );
  expect(
    screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)
  ).toEqual(['Earlier message', 'Updated message', 'Sent message']);
  expect(screen.queryByText('Hello office')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('');
});
