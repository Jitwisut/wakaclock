import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

const { useIsMobileMock } = vi.hoisted(() => ({
  useIsMobileMock: vi.fn<() => boolean>(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: useIsMobileMock,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    onMonthChange,
    onSelect,
  }: {
    onMonthChange?: (value: Date) => void;
    onSelect?: (value: { from?: Date; to?: Date } | undefined) => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onSelect?.({
            from: new Date(2024, 0, 5, 0, 0, 0),
          })
        }
        type="button"
      >
        Pick from
      </button>
      <button
        onClick={() =>
          onSelect?.({
            from: new Date(2024, 0, 5, 0, 0, 0),
            to: new Date(2024, 0, 6, 0, 0, 0),
          })
        }
        type="button"
      >
        Pick range
      </button>
      <button onClick={() => onSelect?.(undefined)} type="button">
        Clear calendar
      </button>
      <button onClick={() => onMonthChange?.(new Date(2024, 1, 1, 0, 0, 0))} type="button">
        Next month
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
  }) => (
    <div>
      <button onClick={() => onValueChange?.('thisYear')} type="button">
        Select this year
      </button>
      <button onClick={() => onValueChange?.('unknown')} type="button">
        Select unknown
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <div>{placeholder}</div>,
}));

import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';

it('renders the mobile trigger and placeholder when starting empty', () => {
  useIsMobileMock.mockReturnValue(true);

  render(
    <CalendarDateRangePicker defaultDateRange={null} labels={{ placeholder: 'Pick range' }} />
  );

  expect(screen.getByRole('button', { name: 'Pick range' })).toBeInTheDocument();
});

it('renders the non-mobile trigger and placeholder when starting empty', () => {
  useIsMobileMock.mockReturnValue(false);

  render(<CalendarDateRangePicker defaultDateRange={null} />);

  expect(screen.getByRole('button', { name: 'Select date range' })).toBeInTheDocument();
});

it('renders the mobile trigger with a derived range', () => {
  useIsMobileMock.mockReturnValue(true);

  render(<CalendarDateRangePicker defaultPreset="today" now={new Date(2024, 0, 10, 12, 0, 0)} />);

  expect(screen.getByRole('button', { name: '10 Jan 2024 - 10 Jan 2024' })).toBeInTheDocument();
});

it('renders a single-date label when only a start date exists', () => {
  useIsMobileMock.mockReturnValue(false);

  render(
    <CalendarDateRangePicker
      defaultDateRange={{
        from: new Date(2024, 0, 1, 0, 0, 0),
      }}
    />
  );

  expect(screen.getByRole('button', { name: '01 Jan 2024' })).toBeInTheDocument();
});

it.each([
  ['today', '10 Jan 2024 - 10 Jan 2024'],
  ['yesterday', '09 Jan 2024 - 09 Jan 2024'],
  ['thisWeek', '07 Jan 2024 - 10 Jan 2024'],
  ['last7Days', '04 Jan 2024 - 10 Jan 2024'],
  ['last28Days', '14 Dec 2023 - 10 Jan 2024'],
  ['thisMonth', '01 Jan 2024 - 10 Jan 2024'],
  ['lastMonth', '01 Dec 2023 - 31 Dec 2023'],
  ['thisYear', '01 Jan 2024 - 10 Jan 2024'],
] as const)('derives the initial range for preset %s', (preset, expected) => {
  useIsMobileMock.mockReturnValue(false);

  render(<CalendarDateRangePicker defaultPreset={preset} now={new Date(2024, 0, 10, 12, 0, 0)} />);

  expect(screen.getByRole('button', { name: expected })).toBeInTheDocument();
});

it('supports now as a number timestamp', () => {
  useIsMobileMock.mockReturnValue(false);

  render(
    <CalendarDateRangePicker
      defaultPreset="today"
      now={new Date(2024, 0, 10, 12, 0, 0).valueOf()}
    />
  );

  expect(screen.getByRole('button', { name: '10 Jan 2024 - 10 Jan 2024' })).toBeInTheDocument();
});

it('falls back to system time when now is omitted', () => {
  useIsMobileMock.mockReturnValue(false);

  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 0, 10, 12, 0, 0));

  try {
    render(<CalendarDateRangePicker defaultPreset="today" />);

    expect(screen.getByRole('button', { name: '10 Jan 2024 - 10 Jan 2024' })).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('updates via Select onValueChange and ignores unknown presets', async () => {
  useIsMobileMock.mockReturnValue(false);

  const user = userEvent.setup();

  render(
    <CalendarDateRangePicker
      defaultOpen
      labels={{ selectAriaLabel: 'Pick preset', selectPlaceholder: 'Preset' }}
      now={new Date(2024, 0, 10, 12, 0, 0)}
    />
  );

  expect(screen.getByRole('button', { name: '14 Dec 2023 - 10 Jan 2024' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Select this year' }));
  expect(screen.getByRole('button', { name: '01 Jan 2024 - 10 Jan 2024' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Select unknown' }));
  expect(screen.getByRole('button', { name: '01 Jan 2024 - 10 Jan 2024' })).toBeInTheDocument();
});

it('updates via ToggleGroup click', async () => {
  useIsMobileMock.mockReturnValue(false);

  const user = userEvent.setup();

  render(<CalendarDateRangePicker defaultOpen now={new Date(2024, 0, 10, 12, 0, 0)} />);

  await user.click(screen.getByRole('radio', { name: 'Yesterday' }));

  expect(screen.getByRole('button', { name: '09 Jan 2024 - 09 Jan 2024' })).toBeInTheDocument();
});

it('updates via Calendar onSelect and onMonthChange', async () => {
  useIsMobileMock.mockReturnValue(false);

  const user = userEvent.setup();

  render(<CalendarDateRangePicker defaultOpen />);

  await user.click(screen.getByRole('button', { name: 'Pick from' }));
  expect(screen.getByRole('button', { name: '05 Jan 2024' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Pick range' }));
  expect(screen.getByRole('button', { name: '05 Jan 2024 - 06 Jan 2024' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Clear calendar' }));
  expect(screen.getByRole('button', { name: 'Select date range' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Next month' }));
});
