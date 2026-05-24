'use client';

import type React from 'react';
import { useMemo } from 'react';

import { addDays, format, isToday } from 'date-fns';
import { Calendar } from 'lucide-react';

import { AgendaDaysToShow } from '../constants';
import { getAgendaEventsForDay } from '../utils';

import { EventItem } from './event-item';

import type { CalendarEvent } from '../types';

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventSelect: (event: CalendarEvent) => void;
}

export function AgendaView({ currentDate, events, onEventSelect }: AgendaViewProps) {
  // Show events for the next days based on constant
  const days = useMemo(() => {
    console.info('Agenda view updating with date:', currentDate.toISOString());
    return Array.from({ length: AgendaDaysToShow }, (_, i) => addDays(new Date(currentDate), i));
  }, [currentDate]);

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    console.info('Agenda view event clicked:', event);
    onEventSelect(event);
  };

  // Check if there are any days with events
  const hasEvents = days.some((day) => getAgendaEventsForDay(events, day).length > 0);

  return (
    <div className="border-border/70 border-t px-4">
      {!hasEvents ? (
        <div className="flex min-h-[70svh] flex-col items-center justify-center py-16 text-center">
          <Calendar className="text-muted-foreground/50 mb-2" size={32} />
          <h3 className="text-lg font-medium">No events found</h3>
          <p className="text-muted-foreground">
            There are no events scheduled for this time period.
          </p>
        </div>
      ) : (
        days.map((day) => {
          const dayEvents = getAgendaEventsForDay(events, day);

          if (dayEvents.length === 0) return null;

          return (
            <div className="border-border/70 relative my-12 border-t" key={day.toString()}>
              <span
                className="bg-background absolute -top-3 left-0 flex h-6 items-center pe-4 text-[10px] uppercase data-today:font-medium sm:pe-4 sm:text-xs"
                data-today={isToday(day) || undefined}
              >
                {format(day, 'd MMM, EEEE')}
              </span>
              <div className="mt-6 space-y-2">
                {dayEvents.map((event) => (
                  <EventItem
                    event={event}
                    key={event.id}
                    onClick={(e) => handleEventClick(event, e)}
                    view="agenda"
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
