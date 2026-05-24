import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { DateTimePicker } from '@/components/date-time-picker';

it('sets PM without overflowing hours', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();
  const date = new Date(2024, 0, 1, 11, 0, 0); // 11 AM

  render(<DateTimePicker date={date} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: 'PM' }));

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate.mock.calls[0]?.[0]?.getHours()).toBe(23);
});

it('sets AM from PM correctly', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();
  const date = new Date(2024, 0, 1, 23, 0, 0); // 11 PM

  render(<DateTimePicker date={date} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: 'AM' }));

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate.mock.calls[0]?.[0]?.getHours()).toBe(11);
});

it('updates the hour while preserving AM/PM', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();
  const date = new Date(2024, 0, 1, 23, 0, 0); // 11 PM

  render(<DateTimePicker date={date} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: '12' }));

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate.mock.calls[0]?.[0]?.getHours()).toBe(12);
});

it('updates the hour for AM without switching to PM', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();
  const date = new Date(2024, 0, 1, 11, 0, 0); // 11 AM

  render(<DateTimePicker date={date} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: '1' }));

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate.mock.calls[0]?.[0]?.getHours()).toBe(1);
});

it('updates the minutes', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();
  const date = new Date(2024, 0, 1, 9, 0, 0);

  render(<DateTimePicker date={date} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: '15' }));

  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate.mock.calls[0]?.[0]?.getMinutes()).toBe(15);
});

it('does not call setDate when date is undefined', async () => {
  const user = userEvent.setup();
  const setDate = vi.fn();

  render(<DateTimePicker date={undefined} setDate={setDate} />);

  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button', { name: 'PM' }));

  expect(setDate).not.toHaveBeenCalled();
});
