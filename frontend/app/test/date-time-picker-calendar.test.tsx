import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (value: Date | undefined) => void }) => (
    <div>
      <button onClick={() => onSelect?.(new Date(2024, 0, 2, 0, 0, 0))} type="button">
        Pick date
      </button>
      <button onClick={() => onSelect?.(undefined)} type="button">
        Clear
      </button>
    </div>
  ),
}));

import { DateTimePicker } from '@/components/date-time-picker';

it('calls setDate when selecting a day in the calendar', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();

  render(<DateTimePicker date={new Date(2024, 0, 1, 0, 0, 0)} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: 'Pick date' }));

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate.mock.calls[0]?.[0]).toEqual(new Date(2024, 0, 2, 0, 0, 0));
});

it('does not call setDate when calendar selection is cleared', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();

  render(<DateTimePicker date={new Date(2024, 0, 1, 0, 0, 0)} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: 'Clear' }));

  expect(setDate).not.toHaveBeenCalled();
});
