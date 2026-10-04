import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { RangePicker } from '@/components/wakaclock/range-picker';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';

it('displays selected calendar dates without shifting them across local midnight', () => {
  render(<RangePicker value={{ start: '2026-01-10', end: '2026-01-12' }} onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Jan 10 – Jan 12' })).toBeVisible();
});

it('changes a preset and ignores deselection of the active preset', () => {
  const onChange = vi.fn();
  const view = render(
    <RangePicker value={{ start: '2026-01-10', end: '2026-01-12' }} onChange={onChange} />
  );
  fireEvent.click(screen.getByRole('radio', { name: '7d' }));
  const range = { start: daysAgoDateString(6), end: todayDateString() };
  expect(onChange).toHaveBeenCalledExactlyOnceWith(range);
  view.rerender(<RangePicker value={range} onChange={onChange} />);
  fireEvent.click(screen.getByRole('radio', { name: '7d' }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('selects a custom calendar range and sends local date strings', () => {
  const onChange = vi.fn();
  render(<RangePicker value={{ start: '2026-01-10', end: '2026-01-12' }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Jan 10 – Jan 12' }));
  fireEvent.click(screen.getByRole('button', { name: /January 5th, 2026/ }));
  expect(onChange).toHaveBeenLastCalledWith({ start: '2026-01-05', end: '2026-01-12' });
});

it('clears a selected preset when navigation changes to a custom range', () => {
  const view = render(
    <RangePicker
      value={{ start: daysAgoDateString(6), end: todayDateString() }}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
  view.rerender(
    <RangePicker value={{ start: '2026-01-10', end: '2026-01-12' }} onChange={vi.fn()} />
  );
  expect(screen.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'false');
});
