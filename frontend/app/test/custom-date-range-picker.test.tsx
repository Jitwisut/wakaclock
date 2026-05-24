import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';

it('renders a custom placeholder when starting empty', () => {
  render(
    <CalendarDateRangePicker defaultDateRange={null} labels={{ placeholder: 'Pick range' }} />
  );

  expect(screen.getByText('Pick range')).toBeInTheDocument();
});

it('renders preset labels overrides when provided', () => {
  render(
    <CalendarDateRangePicker
      defaultOpen
      labels={{
        presets: {
          today: 'Heute',
        },
      }}
    />
  );

  expect(screen.getAllByText('Heute').length).toBeGreaterThan(0);
});

it('formats a provided date range', () => {
  render(
    <CalendarDateRangePicker
      defaultDateRange={{
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 2),
      }}
    />
  );

  expect(screen.getByText('01 Jan 2024 - 02 Jan 2024')).toBeInTheDocument();
});

it('formats a partial range when only the start date is set', () => {
  render(
    <CalendarDateRangePicker
      defaultDateRange={{
        from: new Date(2024, 0, 1),
      }}
    />
  );

  expect(screen.getByRole('button', { name: '01 Jan 2024' })).toBeInTheDocument();
});

it('derives the initial range from the preset and now', () => {
  render(<CalendarDateRangePicker defaultPreset="today" now={new Date(2024, 0, 10, 12, 0, 0)} />);

  expect(screen.getByText('10 Jan 2024 - 10 Jan 2024')).toBeInTheDocument();
});

it('accepts a numeric now value', () => {
  render(
    <CalendarDateRangePicker
      defaultPreset="today"
      now={new Date(2024, 0, 10, 12, 0, 0).valueOf()}
    />
  );

  expect(screen.getByText('10 Jan 2024 - 10 Jan 2024')).toBeInTheDocument();
});

it('falls back to the placeholder when the preset is unknown', () => {
  render(
    <CalendarDateRangePicker
      defaultPreset={'unknown' as never}
      now={new Date(2024, 0, 10, 12, 0, 0)}
    />
  );

  expect(screen.getByText('Select date range')).toBeInTheDocument();
});

it('updates the range when selecting a preset', async () => {
  const user = userEvent.setup();

  render(<CalendarDateRangePicker defaultOpen now={new Date(2024, 0, 10, 12, 0, 0)} />);

  expect(screen.getByText('14 Dec 2023 - 10 Jan 2024')).toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: 'Today' }));

  expect(screen.getByText('10 Jan 2024 - 10 Jan 2024')).toBeInTheDocument();
});
