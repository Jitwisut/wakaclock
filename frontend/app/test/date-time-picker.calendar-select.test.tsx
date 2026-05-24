import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@/components/ui/calendar', async () => {
  function Calendar({
    onSelect,
    selected,
  }: {
    onSelect?: (value: Date | undefined) => void;
    selected?: Date | undefined;
  }) {
    onSelect?.(selected);
    return <div data-testid="calendar" />;
  }

  return { Calendar };
});

import { DateTimePicker } from '@/components/date-time-picker';

it('applies calendar selections when defined', () => {
  const setDate = vi.fn();
  const date = new Date(2024, 0, 1, 9, 0, 0);

  render(<DateTimePicker date={date} defaultOpen setDate={setDate} />);

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate).toHaveBeenCalledWith(date);
});

it('ignores calendar selections when undefined', () => {
  const setDate = vi.fn();

  render(<DateTimePicker date={undefined} defaultOpen setDate={setDate} />);

  expect(setDate).not.toHaveBeenCalled();
});
