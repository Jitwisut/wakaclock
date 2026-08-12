'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { WakaclockRange } from '@/hooks/use-wakaclock-range';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';

import type { DateRange } from 'react-day-picker';

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

interface RangePickerProps {
  onChange: (range: WakaclockRange) => void;
  value: WakaclockRange;
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  const activePreset = PRESETS.find(
    (p) => value.start === daysAgoDateString(p.days - 1) && value.end === todayDateString()
  )?.label;

  const calendarRange: DateRange = {
    from: new Date(value.start),
    to: new Date(value.end),
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToggleGroup
        onValueChange={(preset) => {
          const days = PRESETS.find((p) => p.label === preset)?.days;
          if (!days) return;
          onChange({ start: daysAgoDateString(days - 1), end: todayDateString() });
        }}
        size="sm"
        type="single"
        value={activePreset}
        variant="outline"
      >
        {PRESETS.map((preset) => (
          <ToggleGroupItem className="px-3" key={preset.label} value={preset.label}>
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Popover>
        <PopoverTrigger asChild>
          <Button className="gap-1.5" size="sm" variant="outline">
            <CalendarIcon className="size-3.5" />
            {format(new Date(value.start), 'MMM d')} – {format(new Date(value.end), 'MMM d')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            defaultMonth={calendarRange.from}
            mode="range"
            numberOfMonths={2}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange({
                  start: format(range.from, 'yyyy-MM-dd'),
                  end: format(range.to, 'yyyy-MM-dd'),
                });
              }
            }}
            selected={calendarRange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
