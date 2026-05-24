'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { differenceInCalendarDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker, useDayPicker, type DayPickerProps } from 'react-day-picker';

/**
 * Calendar component props
 *
 * @description Props for the Calendar component.
 * Extends react-day-picker's DayPickerProps with additional customization.
 *
 * @see https://react-day-picker.js.org/
 */
export type CalendarProps = DayPickerProps & {
  /**
   * Custom test ID for testing
   * @default 'calendar'
   */
  testId?: string;
  /**
   * In the year view, the number of years to display at once.
   * @default 12
   */
  yearRange?: number;

  /**
   * Whether to show the year switcher in the caption.
   * @default true
   */
  showYearSwitcher?: boolean;

  /** Tailwind class for months container */
  monthsClassName?: string;
  /** Tailwind class for month caption wrapper */
  monthCaptionClassName?: string;
  /** Tailwind class for weekdays row container */
  weekdaysClassName?: string;
  /** Tailwind class for individual weekday header */
  weekdayClassName?: string;
  /** Tailwind class for month container */
  monthClassName?: string;
  /** Tailwind class for caption container */
  captionClassName?: string;
  /** Tailwind class for caption label text */
  captionLabelClassName?: string;
  /** Tailwind class for next navigation button */
  buttonNextClassName?: string;
  /** Tailwind class for previous navigation button */
  buttonPreviousClassName?: string;
  /** Tailwind class for navigation container */
  navClassName?: string;
  /** Tailwind class for month grid table */
  monthGridClassName?: string;
  /** Tailwind class for week row container */
  weekClassName?: string;
  /** Tailwind class for day cell container */
  dayClassName?: string;
  /** Tailwind class for day button element */
  dayButtonClassName?: string;
  /** Tailwind class for range selection start day */
  rangeStartClassName?: string;
  /** Tailwind class for range selection end day */
  rangeEndClassName?: string;
  /** Tailwind class for selected day */
  selectedClassName?: string;
  /** Tailwind class for today's date */
  todayClassName?: string;
  /** Tailwind class for days outside current month */
  outsideClassName?: string;
  /** Tailwind class for disabled days */
  disabledClassName?: string;
  /** Tailwind class for days in middle of range selection */
  rangeMiddleClassName?: string;
  /** Tailwind class for hidden days */
  hiddenClassName?: string;
};

/** NavView type - calendar navigation view mode */
type NavView = 'days' | 'years';

/**
 * Calendar component - Date picker built on react-day-picker
 *
 * @description
 * A full-featured calendar component for date selection.
 * Supports single date, multiple dates, and date ranges.
 *
 * ## Features
 * - **Date Selection**: Single, multiple, or range modes
 * - **Year Navigation**: Quick year picker view
 * - **Customizable**: Extensive className props for styling
 * - **Localization**: Supports date-fns locales
 * - **Accessibility**: Keyboard navigation and ARIA support
 *
 * @example
 * ```tsx
 * // Single date selection
 * const [date, setDate] = useState<Date>();
 * <Calendar
 *   mode="single"
 *   selected={date}
 *   onSelect={setDate}
 * />
 *
 * // Date range selection
 * const [range, setRange] = useState<DateRange>();
 * <Calendar
 *   mode="range"
 *   selected={range}
 *   onSelect={setRange}
 *   numberOfMonths={2}
 * />
 *
 * // With disabled dates
 * <Calendar
 *   mode="single"
 *   disabled={[{ before: new Date() }]}
 *   selected={date}
 *   onSelect={setDate}
 * />
 * ```
 *
 * @see https://react-day-picker.js.org/
 */
const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (
    {
      className,
      showOutsideDays = true,
      showYearSwitcher = true,
      yearRange = 12,
      numberOfMonths,
      testId = 'calendar',
      ...props
    },
    ref
  ) => {
    const [navView, setNavView] = React.useState<NavView>('days');
    const [displayYears, setDisplayYears] = React.useState<{
      from: number;
      to: number;
    }>(
      React.useMemo(() => {
        const currentYear = new Date().getFullYear();
        return {
          from: currentYear - Math.floor(yearRange / 2 - 1),
          to: currentYear + Math.ceil(yearRange / 2),
        };
      }, [yearRange])
    );

    const { onPrevClick, startMonth, endMonth } = props;

    const columnsDisplayed = navView === 'years' ? 1 : numberOfMonths;

    const _monthsClassName = cn('relative flex', props.monthsClassName);
    const _monthCaptionClassName = cn(
      'relative mx-10 flex h-7 items-center justify-center',
      props.monthCaptionClassName
    );
    const _weekdaysClassName = cn('flex flex-row', props.weekdaysClassName);
    const _weekdayClassName = cn(
      'text-muted-foreground w-8 text-sm font-normal',
      props.weekdayClassName
    );
    const _monthClassName = cn('w-full', props.monthClassName);
    const _captionClassName = cn(
      'relative flex items-center justify-center pt-1',
      props.captionClassName
    );
    const _captionLabelClassName = cn('truncate text-sm font-medium', props.captionLabelClassName);
    const buttonNavClassName = buttonVariants({
      variant: 'outline',
      className: 'absolute h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
    });
    const _buttonNextClassName = cn(buttonNavClassName, 'right-0', props.buttonNextClassName);
    const _buttonPreviousClassName = cn(
      buttonNavClassName,
      'left-0',
      props.buttonPreviousClassName
    );
    const _navClassName = cn('flex items-start', props.navClassName);
    const _monthGridClassName = cn('mx-auto mt-4', props.monthGridClassName);
    const _weekClassName = cn('mt-2 flex w-max items-start', props.weekClassName);
    const _dayClassName = cn(
      'flex size-8 flex-1 items-center justify-center p-0 text-sm',
      props.dayClassName
    );
    const _dayButtonClassName = cn(
      buttonVariants({ variant: 'ghost' }),
      'size-8 rounded-md p-0 font-normal transition-none aria-selected:opacity-100',
      props.dayButtonClassName
    );
    const buttonRangeClassName =
      'bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground';
    const _rangeStartClassName = cn(
      buttonRangeClassName,
      'day-range-start rounded-s-md',
      props.rangeStartClassName
    );
    const _rangeEndClassName = cn(
      buttonRangeClassName,
      'day-range-end rounded-e-md',
      props.rangeEndClassName
    );
    const _rangeMiddleClassName = cn(
      'bg-accent !text-foreground [&>button]:!text-foreground [&>button]:hover:!text-foreground [&>button]:bg-transparent [&>button]:hover:bg-transparent',
      props.rangeMiddleClassName
    );
    const _selectedClassName = cn(
      '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
      props.selectedClassName
    );
    const _todayClassName = cn(
      '[&>button]:bg-accent [&>button]:text-accent-foreground',
      props.todayClassName
    );
    const _outsideClassName = cn(
      'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground opacity-50 aria-selected:opacity-30',
      props.outsideClassName
    );
    const _disabledClassName = cn('text-muted-foreground opacity-50', props.disabledClassName);
    const _hiddenClassName = cn('invisible flex-1', props.hiddenClassName);

    return (
      <div ref={ref} data-slot="calendar" data-testid={testId}>
        <DayPicker
          showOutsideDays={showOutsideDays}
          className={cn('p-3', className)}
          style={{
            width: 248.8 * (columnsDisplayed ?? 1) + 'px',
          }}
          classNames={{
            months: _monthsClassName,
            month_caption: _monthCaptionClassName,
            weekdays: _weekdaysClassName,
            weekday: _weekdayClassName,
            month: _monthClassName,
            caption: _captionClassName,
            caption_label: _captionLabelClassName,
            button_next: _buttonNextClassName,
            button_previous: _buttonPreviousClassName,
            nav: _navClassName,
            month_grid: _monthGridClassName,
            week: _weekClassName,
            day: _dayClassName,
            day_button: _dayButtonClassName,
            range_start: _rangeStartClassName,
            range_middle: _rangeMiddleClassName,
            range_end: _rangeEndClassName,
            selected: _selectedClassName,
            today: _todayClassName,
            outside: _outsideClassName,
            disabled: _disabledClassName,
            hidden: _hiddenClassName,
          }}
          components={{
            Chevron: ({ orientation }) => {
              const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
              return <Icon className="h-4 w-4" />;
            },
            Nav: ({ className }) => (
              <Nav
                className={className}
                displayYears={displayYears}
                navView={navView}
                setDisplayYears={setDisplayYears}
                startMonth={startMonth}
                endMonth={endMonth}
                onPrevClick={onPrevClick}
              />
            ),
            CaptionLabel: (props) => (
              <CaptionLabel
                showYearSwitcher={showYearSwitcher}
                navView={navView}
                setNavView={setNavView}
                displayYears={displayYears}
                {...props}
              />
            ),
            MonthGrid: ({ className, children, ...props }) => (
              <MonthGrid
                children={children}
                className={className}
                displayYears={displayYears}
                startMonth={startMonth}
                endMonth={endMonth}
                navView={navView}
                setNavView={setNavView}
                {...props}
              />
            ),
          }}
          numberOfMonths={columnsDisplayed}
          {...props}
        />
      </div>
    );
  }
);
Calendar.displayName = 'Calendar';

/** NavProps - props for calendar navigation component */
type NavProps = {
  className?: string;
  navView: NavView;
  startMonth?: Date;
  endMonth?: Date;
  displayYears: { from: number; to: number };
  setDisplayYears: React.Dispatch<React.SetStateAction<{ from: number; to: number }>>;
  onPrevClick?: (date: Date) => void;
  onNextClick?: (date: Date) => void;
};

/** Nav component - calendar navigation with previous/next buttons */
const Nav = React.forwardRef<HTMLElement, NavProps>(
  (
    {
      className,
      navView,
      startMonth,
      endMonth,
      displayYears,
      setDisplayYears,
      onPrevClick,
      onNextClick,
    },
    ref
  ) => {
    const { nextMonth, previousMonth, goToMonth, labels } = useDayPicker();

    const isPreviousDisabled = (() => {
      if (navView === 'years') {
        return (
          (startMonth &&
            differenceInCalendarDays(new Date(displayYears.from - 1, 0, 1), startMonth) < 0) ||
          (endMonth &&
            differenceInCalendarDays(new Date(displayYears.from - 1, 0, 1), endMonth) > 0)
        );
      }
      return !previousMonth;
    })();

    const isNextDisabled = (() => {
      if (navView === 'years') {
        return (
          (startMonth &&
            differenceInCalendarDays(new Date(displayYears.to + 1, 0, 1), startMonth) < 0) ||
          (endMonth && differenceInCalendarDays(new Date(displayYears.to + 1, 0, 1), endMonth) > 0)
        );
      }
      return !nextMonth;
    })();

    const handlePreviousClick = React.useCallback(() => {
      if (!previousMonth) return;
      if (navView === 'years') {
        setDisplayYears((prev) => ({
          from: prev.from - (prev.to - prev.from + 1),
          to: prev.to - (prev.to - prev.from + 1),
        }));
        onPrevClick?.(new Date(displayYears.from - (displayYears.to - displayYears.from), 0, 1));
        return;
      }
      goToMonth(previousMonth);
      onPrevClick?.(previousMonth);
    }, [previousMonth, goToMonth]);

    const handleNextClick = React.useCallback(() => {
      if (!nextMonth) return;
      if (navView === 'years') {
        setDisplayYears((prev) => ({
          from: prev.from + (prev.to - prev.from + 1),
          to: prev.to + (prev.to - prev.from + 1),
        }));
        onNextClick?.(new Date(displayYears.from + (displayYears.to - displayYears.from), 0, 1));
        return;
      }
      goToMonth(nextMonth);
      onNextClick?.(nextMonth);
    }, [goToMonth, nextMonth]);
    return (
      <nav
        ref={ref}
        aria-label={labels.labelNav()}
        className={cn('flex items-center', className)}
        data-slot="calendar-nav"
        data-testid="calendar-nav"
      >
        <Button
          variant="outline"
          className="absolute left-0 h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"
          type="button"
          tabIndex={isPreviousDisabled ? undefined : -1}
          disabled={isPreviousDisabled}
          aria-label={
            navView === 'years'
              ? `Go to the previous ${displayYears.to - displayYears.from + 1} years`
              : labels.labelPrevious(previousMonth)
          }
          onClick={handlePreviousClick}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          variant="outline"
          className="absolute right-0 h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"
          type="button"
          tabIndex={isNextDisabled ? undefined : -1}
          disabled={isNextDisabled}
          aria-label={
            navView === 'years'
              ? `Go to the next ${displayYears.to - displayYears.from + 1} years`
              : labels.labelNext(nextMonth)
          }
          onClick={handleNextClick}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </nav>
    );
  }
);
Nav.displayName = 'Nav';

/** CaptionLabelProps - props for caption label component */
type CaptionLabelProps = {
  showYearSwitcher?: boolean;
  navView: NavView;
  setNavView: React.Dispatch<React.SetStateAction<NavView>>;
  displayYears: { from: number; to: number };
} & React.HTMLAttributes<HTMLSpanElement>;

/** CaptionLabel component - displays current month/year with optional switcher */
const CaptionLabel = React.forwardRef<HTMLSpanElement, CaptionLabelProps>(
  ({ children, showYearSwitcher, navView, setNavView, displayYears, ...props }, ref) => {
    if (!showYearSwitcher)
      return (
        <span ref={ref} data-slot="calendar-caption" data-testid="calendar-caption" {...props}>
          {children}
        </span>
      );
    return (
      <Button
        className="h-7 w-full truncate text-sm font-medium"
        variant="ghost"
        size="sm"
        onClick={() => setNavView((prev) => (prev === 'days' ? 'years' : 'days'))}
        data-slot="calendar-caption"
        data-testid="calendar-caption"
      >
        {navView === 'days' ? children : displayYears.from + ' - ' + displayYears.to}
      </Button>
    );
  }
);
CaptionLabel.displayName = 'CaptionLabel';

/** MonthGridProps - props for month grid component */
type MonthGridProps = {
  className?: string;
  children: React.ReactNode;
  displayYears: { from: number; to: number };
  startMonth?: Date;
  endMonth?: Date;
  navView: NavView;
  setNavView: React.Dispatch<React.SetStateAction<NavView>>;
} & React.TableHTMLAttributes<HTMLTableElement>;

/** MonthGrid component - displays days grid or year grid based on view */
const MonthGrid = React.forwardRef<HTMLTableElement, MonthGridProps>(
  (
    { className, children, displayYears, startMonth, endMonth, navView, setNavView, ...props },
    ref
  ) => {
    if (navView === 'years') {
      return (
        <YearGrid
          displayYears={displayYears}
          startMonth={startMonth}
          endMonth={endMonth}
          setNavView={setNavView}
          navView={navView}
          className={className}
          {...props}
        />
      );
    }
    return (
      <table
        ref={ref}
        className={className}
        data-slot="calendar-month-grid"
        data-testid="calendar-month-grid"
        {...props}
      >
        {children}
      </table>
    );
  }
);
MonthGrid.displayName = 'MonthGrid';

/** YearGridProps - props for year grid component */
type YearGridProps = {
  className?: string;
  displayYears: { from: number; to: number };
  startMonth?: Date;
  endMonth?: Date;
  setNavView: React.Dispatch<React.SetStateAction<NavView>>;
  navView: NavView;
} & React.HTMLAttributes<HTMLDivElement>;

/** YearGrid component - displays grid of selectable years */
const YearGrid = React.forwardRef<HTMLDivElement, YearGridProps>(
  ({ className, displayYears, startMonth, endMonth, setNavView, navView, ...props }, ref) => {
    const { goToMonth, selected } = useDayPicker();

    return (
      <div
        ref={ref}
        className={cn('grid grid-cols-4 gap-y-2', className)}
        data-slot="calendar-year-grid"
        data-testid="calendar-year-grid"
        {...props}
      >
        {Array.from({ length: displayYears.to - displayYears.from + 1 }, (_, i) => {
          const year = displayYears.from + i;
          const isBefore = differenceInCalendarDays(new Date(year, 11, 31), startMonth!) < 0;

          const isAfter = differenceInCalendarDays(new Date(year, 0, 0), endMonth!) > 0;

          const isDisabled = isBefore || isAfter;
          return (
            <Button
              key={`year-${year}`}
              className={cn(
                'text-foreground h-7 w-full text-sm font-normal',
                displayYears.from + i === new Date().getFullYear() &&
                  'bg-accent text-accent-foreground font-medium'
              )}
              variant="ghost"
              onClick={() => {
                setNavView('days');
                goToMonth(new Date(year, (selected as Date | undefined)?.getMonth() ?? 0));
              }}
              disabled={navView === 'years' ? isDisabled : undefined}
            >
              {year}
            </Button>
          );
        })}
      </div>
    );
  }
);
YearGrid.displayName = 'YearGrid';

export { Calendar };

// Export types for external consumption (CalendarProps already exported above)
