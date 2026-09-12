import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
