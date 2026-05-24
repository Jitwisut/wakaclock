import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}));

import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';

it('uses an icon-only trigger on mobile while preserving the aria-label', () => {
  render(
    <CalendarDateRangePicker
      defaultDateRange={{
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 2),
      }}
    />
  );

  expect(screen.getByRole('button', { name: '01 Jan 2024 - 02 Jan 2024' })).toBeInTheDocument();
});
