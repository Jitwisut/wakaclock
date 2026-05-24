'use client';

import * as React from 'react';

import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

import type { DateRange } from 'react-day-picker';

const DATE_FORMAT = 'dd MMM yyyy';

/** Available date filter preset options */
const dateFilterPresets = [
  { name: 'Today', value: 'today' },
  { name: 'Yesterday', value: 'yesterday' },
  { name: 'This Week', value: 'thisWeek' },
  { name: 'Last 7 Days', value: 'last7Days' },
  { name: 'Last 28 Days', value: 'last28Days' },
  { name: 'This Month', value: 'thisMonth' },
  { name: 'Last Month', value: 'lastMonth' },
  { name: 'This Year', value: 'thisYear' },
] as const;

/** Date filter preset value type */
export type DateFilterPreset = (typeof dateFilterPresets)[number]['value'];

/** Labels configuration for CalendarDateRangePicker component */
export interface CalendarDateRangePickerLabels {
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Custom labels for preset options */
  presets?: Partial<Record<DateFilterPreset, string>>;
  /** Aria label for the select element */
  selectAriaLabel?: string;
  /** Placeholder for the select element */
  selectPlaceholder?: string;
}

/**
 * CalendarDateRangePicker component props
 *
 * @description Props for the date range picker with presets component.
 */
export interface CalendarDateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Initial date range selection */
  defaultDateRange?: DateRange | null;
  /** Whether the popover is initially open */
  defaultOpen?: boolean;
  /** Default preset to apply */
  defaultPreset?: DateFilterPreset;
  /** Custom labels configuration */
  labels?: CalendarDateRangePickerLabels;
  /** Reference date for preset calculations */
  now?: Date | number;
  /**
   * Custom test ID for testing
   * @default 'calendar-date-range-picker'
   */
  testId?: string;
}

/**
 * CalendarDateRangePicker component - Date range picker with presets
 *
 * @description
 * A sophisticated date range picker with built-in preset options like
 * "Today", "Last 7 Days", "This Month", etc. Combines a calendar for
 * custom range selection with quick-access presets.
 *
 * ## Features
 * - **Preset Options**: 8 common date range presets
 * - **Calendar Range**: Click-drag range selection on calendar
 * - **Responsive**: Toggle group on desktop, select on mobile
 * - **Custom Labels**: Full i18n support for presets and placeholders
 * - **Reference Date**: Configurable "now" for testing
 *
 * ## Use Cases
 * - Dashboard date filters
 * - Analytics and reporting tools
 * - Data export date selection
 * - Financial period selection
 * - Activity log filtering
 *
 * ## Presets Available
 * - Today, Yesterday, This Week
 * - Last 7 Days, Last 28 Days
 * - This Month, Last Month, This Year
 *
 * ## vs DateTimePicker
 * Use CalendarDateRangePicker for selecting a DATE RANGE.
 * Use DateTimePicker when you need a single date WITH time.
 *
 * ## Accessibility
 * - Keyboard navigable presets and calendar
 * - ARIA labels for screen readers
 * - Mobile-friendly touch targets
 * - Tooltip shows current selection on mobile
 *
 * @example
 * ```tsx
 * // Basic usage with default preset
 * <CalendarDateRangePicker />
 *
 * // With custom initial range
 * <CalendarDateRangePicker
 *   defaultDateRange={{ from: new Date('2024-01-01'), to: new Date('2024-01-31') }}
 * />
 *
 * // With custom labels (i18n)
 * <CalendarDateRangePicker
 *   labels={{
 *     placeholder: 'Select period',
 *     presets: { today: 'Today', last7Days: 'Past week' },
 *   }}
 * />
 *
 * // For testing with fixed "now" date
 * <CalendarDateRangePicker now={new Date('2024-06-15')} />
 * ```
 *
 * @see https://date-fns.org - Date manipulation library
 */
const CalendarDateRangePicker = React.forwardRef<HTMLDivElement, CalendarDateRangePickerProps>(
  (
    {
      className,
      defaultDateRange,
      defaultOpen = false,
      defaultPreset = 'last28Days',
      labels,
      now,
      testId = 'calendar-date-range-picker',
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile();
    const placeholder = labels?.placeholder ?? 'Select date range';
    const selectAriaLabel = labels?.selectAriaLabel ?? 'Select a value';
    const selectPlaceholder = labels?.selectPlaceholder ?? 'Last 28 Days';

    const getNow = () => {
      if (now instanceof Date) return now;
      if (typeof now === 'number') return new Date(now);
      return new Date();
    };

    const getPresetRange = (preset: DateFilterPreset, baseNow: Date) => {
      switch (preset) {
        case 'today': {
          return { from: startOfDay(baseNow), to: endOfDay(baseNow) };
        }
        case 'yesterday': {
          const yesterday = subDays(baseNow, 1);
          return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
        }
        case 'thisWeek': {
          const startOfCurrentWeek = startOfWeek(baseNow);
          return { from: startOfDay(startOfCurrentWeek), to: endOfDay(baseNow) };
        }
        case 'last7Days': {
          const sevenDaysAgo = subDays(baseNow, 6);
          return { from: startOfDay(sevenDaysAgo), to: endOfDay(baseNow) };
        }
        case 'last28Days': {
          const last28Start = subDays(baseNow, 27); // 27 days ago + today = 28 days
          return { from: startOfDay(last28Start), to: endOfDay(baseNow) };
        }
        case 'thisMonth': {
          return { from: startOfMonth(baseNow), to: endOfDay(baseNow) };
        }
        case 'lastMonth': {
          const lastMonth = subMonths(baseNow, 1);
          return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        }
        case 'thisYear': {
          const startOfCurrentYear = startOfYear(baseNow);
          return { from: startOfDay(startOfCurrentYear), to: endOfDay(baseNow) };
        }
        default: {
          return null;
        }
      }
    };

    const [date, setDate] = React.useState<DateRange | undefined>(() => {
      if (defaultDateRange === null) return undefined;
      if (defaultDateRange) return defaultDateRange;

      const baseNow = getNow();
      const range = getPresetRange(defaultPreset, baseNow);
      return range ? { from: range.from, to: range.to } : undefined;
    });
    const [open, setOpen] = React.useState(defaultOpen);
    const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
      const baseNow = getNow();
      return new Date(baseNow.valueOf());
    });

    const handleQuickSelect = (from: Date, to: Date) => {
      setDate({ from, to });
      setCurrentMonth(from);
    };

    const changeHandle = (preset: DateFilterPreset) => {
      const baseNow = getNow();
      const range = getPresetRange(preset, baseNow);

      if (!range) return;
      handleQuickSelect(range.from, range.to);
    };

    const formatDateRangeText = () => {
      if (!date?.from) return placeholder;
      if (date.to) {
        return `${format(date.from, DATE_FORMAT)} - ${format(date.to, DATE_FORMAT)}`;
      }
      return format(date.from, DATE_FORMAT);
    };

    const formatDateRange = () => {
      if (!date?.from) {
        return <span>{placeholder}</span>;
      }
      if (date.to) {
        return (
          <>
            {format(date.from, DATE_FORMAT)} - {format(date.to, DATE_FORMAT)}
          </>
        );
      }
      return format(date.from, DATE_FORMAT);
    };

    return (
      <div
        className={cn('grid gap-2', className)}
        data-slot="calendar-date-range-picker"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            {isMobile ? (
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={formatDateRangeText()}
                        className={cn(
                          'justify-start text-left font-normal',
                          !date && 'text-muted-foreground'
                        )}
                        id="date"
                        variant="outline"
                      >
                        <CalendarIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{formatDateRange()}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <Button
                aria-label={formatDateRangeText()}
                className={cn(
                  'justify-start text-left font-normal',
                  !date && 'text-muted-foreground'
                )}
                id="date"
                variant="outline"
              >
                <CalendarIcon />
                {formatDateRange()}
              </Button>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <div className="flex flex-col lg:flex-row">
              <div className="me-0 lg:me-4">
                <ToggleGroup
                  className="hidden w-28 flex-col lg:block"
                  defaultValue={defaultPreset}
                  type="single"
                >
                  {dateFilterPresets.map((item) => (
                    <ToggleGroupItem
                      asChild
                      className="text-muted-foreground w-full"
                      key={item.value}
                      onClick={() => changeHandle(item.value)}
                      value={item.value}
                    >
                      <Button className="justify-start rounded-md">
                        {labels?.presets?.[item.value] ?? item.name}
                      </Button>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Select
                  defaultValue={defaultPreset}
                  onValueChange={(value) => changeHandle(value as DateFilterPreset)}
                >
                  <SelectTrigger
                    aria-label={selectAriaLabel}
                    className="mb-4 flex w-full lg:hidden"
                    size="sm"
                  >
                    <SelectValue placeholder={selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFilterPresets.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {labels?.presets?.[item.value] ?? item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Calendar
                className="border-s-0 py-0! ps-0! pe-0! lg:border-s lg:ps-4!"
                mode="range"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                onSelect={(newDate) => {
                  setDate(newDate);
                  if (newDate?.from) {
                    setCurrentMonth(newDate.from);
                  }
                }}
                selected={date}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);
CalendarDateRangePicker.displayName = 'CalendarDateRangePicker';

export { CalendarDateRangePicker, dateFilterPresets };
