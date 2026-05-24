import { faker } from '@faker-js/faker';

export interface FakeEvent {
  allDay: boolean;
  attendees?: string[];
  color: string;
  description: string;
  end: string;
  id: string;
  location?: string;
  start: string;
  title: string;
}

const EVENT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function createFakeEvent(overrides?: Partial<FakeEvent>): FakeEvent {
  const start = faker.date.soon({ days: 30 });
  const durationHours = faker.number.int({ min: 1, max: 4 });
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  const isAllDay = faker.datatype.boolean({ probability: 0.2 });

  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    description: faker.lorem.paragraph(),
    start: start.toISOString(),
    end: end.toISOString(),
    color: faker.helpers.arrayElement(EVENT_COLORS),
    allDay: isAllDay,
    location: faker.datatype.boolean({ probability: 0.6 })
      ? faker.location.streetAddress()
      : undefined,
    attendees: faker.datatype.boolean({ probability: 0.5 })
      ? Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.internet.email())
      : undefined,
    ...overrides,
  };
}

export function createFakeEvents(count: number): FakeEvent[] {
  return Array.from({ length: count }, () => createFakeEvent());
}

export interface FakeTimelineItem {
  date: string;
  description: string;
  icon?: string;
  id: string;
  status: 'completed' | 'current' | 'upcoming';
  title: string;
  user?: {
    avatar: string;
    name: string;
  };
}

const TIMELINE_ICONS = [
  'check',
  'clock',
  'star',
  'flag',
  'bell',
  'mail',
  'file',
  'user',
  'settings',
];

export function createFakeTimelineItem(
  status?: 'completed' | 'current' | 'upcoming'
): FakeTimelineItem {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 6 }),
    description: faker.lorem.sentence({ min: 5, max: 15 }),
    date: faker.date.recent().toISOString(),
    icon: faker.helpers.arrayElement(TIMELINE_ICONS),
    status: status ?? faker.helpers.arrayElement(['completed', 'current', 'upcoming']),
    user: faker.datatype.boolean({ probability: 0.6 })
      ? {
          name: faker.person.fullName(),
          avatar: faker.image.avatar(),
        }
      : undefined,
  };
}

export function createFakeTimeline(count: number): FakeTimelineItem[] {
  const items = Array.from({ length: count }, () => createFakeTimelineItem());

  // Sort by date and assign statuses logically
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const midpoint = Math.floor(count / 2);
  items.forEach((item, index) => {
    if (index < midpoint) {
      item.status = 'completed';
    } else if (index === midpoint) {
      item.status = 'current';
    } else {
      item.status = 'upcoming';
    }
  });

  return items;
}

export interface FakeDateRange {
  from: string;
  to: string;
}

export function createFakeDateRange(daysSpan: number = 7): FakeDateRange {
  const from = faker.date.recent({ days: 30 });
  const to = new Date(from.getTime() + daysSpan * 24 * 3_600_000);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export interface FakeScheduleSlot {
  available: boolean;
  duration: number; // in minutes
  id: string;
  time: string;
}

export function createFakeScheduleSlot(): FakeScheduleSlot {
  const hour = faker.number.int({ min: 9, max: 17 });
  const minute = faker.helpers.arrayElement([0, 15, 30, 45]);

  return {
    id: faker.string.uuid(),
    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    available: faker.datatype.boolean({ probability: 0.6 }),
    duration: faker.helpers.arrayElement([15, 30, 45, 60]),
  };
}

export function createFakeScheduleSlots(count: number = 8): FakeScheduleSlot[] {
  return Array.from({ length: count }, () => createFakeScheduleSlot()).sort((a, b) =>
    a.time.localeCompare(b.time)
  );
}

export interface FakeReminder {
  date: string;
  enabled: boolean;
  id: string;
  repeat: 'daily' | 'monthly' | 'none' | 'weekly';
  time: string;
  title: string;
}

export function createFakeReminder(): FakeReminder {
  const date = faker.date.soon({ days: 14 });

  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    date: date.toISOString().split('T')[0],
    time: `${faker.number.int({ min: 8, max: 20 })}:${faker.helpers.arrayElement(['00', '15', '30', '45'])}`,
    repeat: faker.helpers.arrayElement(['none', 'daily', 'weekly', 'monthly']),
    enabled: faker.datatype.boolean({ probability: 0.8 }),
  };
}

export function createFakeReminders(count: number): FakeReminder[] {
  return Array.from({ length: count }, () => createFakeReminder());
}
