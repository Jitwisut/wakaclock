import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@/components/ui/select', async () => {
  function PassThrough({ children }: { children?: any }) {
    return <div>{children}</div>;
  }

  function Select({
    children,
    onValueChange,
  }: {
    children?: any;
    onValueChange?: (value: string) => void;
  }) {
    onValueChange?.('unknown');
    return <div>{children}</div>;
  }

  return {
    Select,
    SelectContent: PassThrough,
    SelectItem: PassThrough,
    SelectTrigger: PassThrough,
    SelectValue: PassThrough,
  };
});

import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';

it('ignores unknown select values defensively', () => {
  render(<CalendarDateRangePicker now={new Date(2024, 0, 10, 12, 0, 0)} />);

  expect(screen.getByText('14 Dec 2023 - 10 Jan 2024')).toBeInTheDocument();
});
