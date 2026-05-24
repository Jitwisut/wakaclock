'use client';

import * as React from 'react';

import { CalendarIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * DateTimePicker component props
 *
 * @description Props for the combined date and time picker component.
 */
export interface DateTimePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Currently selected date and time */
  date: Date | undefined;
  /** Whether the popover is initially open */
  defaultOpen?: boolean;
  /** Format string for displaying the selected date/time */
  displayFormat?: string;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Callback to update the selected date/time */
  setDate: (value: Date | undefined) => void;
  /**
   * Custom test ID for testing
   * @default 'date-time-picker'
   */
  testId?: string;
}

/**
 * DateTimePicker component - Combined date and time selection
 *
 * @description
 * A comprehensive date and time picker that combines a calendar for date
 * selection with scrollable selectors for hours, minutes, and AM/PM.
 *
 * ## Features
 * - **Calendar Selection**: Full calendar for intuitive date picking
 * - **Time Selection**: Hour, minute, and AM/PM scrollable selectors
 * - **Custom Formats**: Configurable display format using date-fns
 * - **Responsive**: Adapts layout for different screen sizes
 *
 * ## Use Cases
 * - Appointment scheduling systems
 * - Event creation forms
 * - Booking and reservation interfaces
 * - Task deadline selection
 * - Meeting time coordination
 *
 * ## vs Calendar
 * Use DateTimePicker when you need both date AND time selection.
 * Use Calendar alone when only date selection is required.
 *
 * ## Accessibility
 * - Keyboard navigable calendar
 * - Screen reader compatible selectors
 * - Clear visual feedback for selections
 * - Focusable time selection buttons
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [date, setDate] = useState<Date>();
 * <DateTimePicker date={date} setDate={setDate} />
 *
 * // With custom format
 * <DateTimePicker
 *   date={date}
 *   setDate={setDate}
 *   displayFormat="yyyy-MM-dd HH:mm"
 *   placeholder="YYYY-MM-DD HH:mm"
 * />
 *
 * // Initially open
 * <DateTimePicker
 *   date={date}
 *   setDate={setDate}
 *   defaultOpen
 * />
 * ```
 *
 * @see https://date-fns.org/docs/format - Format patterns reference
 */
const DateTimePicker = React.forwardRef<HTMLDivElement, DateTimePickerProps>(
  (
    {
      className,
      date,
      defaultOpen = false,
      displayFormat = 'MM/dd/yyyy hh:mm aa',
      placeholder = 'MM/DD/YYYY hh:mm aa',
      setDate,
      testId = 'date-time-picker',
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const handleDateSelect = (selectedDate: Date | undefined) => {
      if (selectedDate) {
        setDate(selectedDate);
      }
    };

    const handleTimeChange = (type: 'ampm' | 'hour' | 'minute', value: string) => {
      if (date) {
        const newDate = new Date(date);
        if (type === 'hour') {
          newDate.setHours((Number.parseInt(value, 10) % 12) + (newDate.getHours() >= 12 ? 12 : 0));
        } else if (type === 'minute') {
          newDate.setMinutes(Number.parseInt(value, 10));
        } else {
          const currentHours = newDate.getHours();
          newDate.setHours((currentHours % 12) + (value === 'PM' ? 12 : 0));
        }
        setDate(newDate);
      }
    };

    return (
      <div
        className={cn(className)}
        data-slot="date-time-picker"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <Popover modal onOpenChange={setIsOpen} open={isOpen}>
          <PopoverTrigger asChild>
            <Button
              className={cn(
                'w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
              variant="outline"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, displayFormat) : <span>{placeholder}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <div className="sm:flex">
              <Calendar initialFocus mode="single" onSelect={handleDateSelect} selected={date} />
              <div className="flex h-[300px] flex-col divide-y border-s sm:flex-row sm:divide-x sm:divide-y-0">
                <ScrollArea className="w-64 sm:w-auto">
                  <div className="flex p-2 sm:flex-col">
                    {hours.reverse().map((hour) => (
                      <Button
                        className="aspect-square shrink-0 sm:w-full"
                        key={hour}
                        onClick={() => handleTimeChange('hour', hour.toString())}
                        size="icon"
                        variant={date && date.getHours() % 12 === hour % 12 ? 'default' : 'ghost'}
                      >
                        {hour}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar className="sm:hidden" orientation="horizontal" />
                </ScrollArea>
                <ScrollArea className="w-64 sm:w-auto">
                  <div className="flex p-2 sm:flex-col">
                    {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                      <Button
                        className="aspect-square shrink-0 sm:w-full"
                        key={minute}
                        onClick={() => handleTimeChange('minute', minute.toString())}
                        size="icon"
                        variant={date && date.getMinutes() === minute ? 'default' : 'ghost'}
                      >
                        {minute}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar className="sm:hidden" orientation="horizontal" />
                </ScrollArea>
                <ScrollArea className="">
                  <div className="flex p-2 sm:flex-col">
                    {['AM', 'PM'].map((ampm) => (
                      <Button
                        className="aspect-square shrink-0 sm:w-full"
                        key={ampm}
                        onClick={() => handleTimeChange('ampm', ampm)}
                        size="icon"
                        variant={
                          date &&
                          ((ampm === 'AM' && date.getHours() < 12) ||
                            (ampm === 'PM' && date.getHours() >= 12))
                            ? 'default'
                            : 'ghost'
                        }
                      >
                        {ampm}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);
DateTimePicker.displayName = 'DateTimePicker';

export { DateTimePicker };
