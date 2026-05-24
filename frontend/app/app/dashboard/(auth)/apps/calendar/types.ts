export type CalendarView = 'agenda' | 'day' | 'month' | 'week';

export interface CalendarEvent {
  allDay?: boolean;
  color?: EventColor;
  description?: string;
  end: Date;
  id: string;
  location?: string;
  start: Date;
  title: string;
}

export type EventColor = 'amber' | 'emerald' | 'orange' | 'rose' | 'sky' | 'violet';
