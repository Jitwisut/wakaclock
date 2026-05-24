import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeDateRange,
  createFakeEvent,
  createFakeEvents,
  createFakeReminders,
  createFakeScheduleSlots,
  createFakeTimeline,
} from '../_factories/event.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_EVENTS = '/api/events';
const API_EVENT_BY_ID = '/api/events/:id';
const API_TIMELINE = '/api/timeline';
const API_SCHEDULE = '/api/schedule';
const API_REMINDERS = '/api/reminders';
const API_REMINDER_BY_ID = '/api/reminders/:id';
const API_DATE_RANGE = '/api/date-range';

// Default success handlers
export const eventHandlers = [
  // GET /api/events - List events
  http.get(API_EVENTS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    await delay(faker.number.int({ min: 200, max: 500 }));

    const events = createFakeEvents(limit);

    return HttpResponse.json({
      events,
      total: faker.number.int({ min: limit, max: 100 }),
      dateRange: start && end ? { start, end } : createFakeDateRange(),
    });
  }),

  // GET /api/events/:id - Get single event
  http.get(API_EVENT_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 150, max: 400 }));
    const event = createFakeEvent({ id: params.id as string });
    return HttpResponse.json(event);
  }),

  // POST /api/events - Create event
  http.post(API_EVENTS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 300, max: 600 }));
    const event = createFakeEvent({
      ...(body as object),
      id: faker.string.uuid(),
    });
    return HttpResponse.json(event, { status: HTTP_STATUS.CREATED });
  }),

  // PATCH /api/events/:id - Update event
  http.patch(API_EVENT_BY_ID, async ({ request, params }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 500 }));
    const event = createFakeEvent({
      ...(body as object),
      id: params.id as string,
    });
    return HttpResponse.json(event);
  }),

  // DELETE /api/events/:id - Delete event
  http.delete(API_EVENT_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/timeline - Get timeline items
  http.get(API_TIMELINE, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      items: createFakeTimeline(limit),
      hasMore: faker.datatype.boolean({ probability: 0.7 }),
    });
  }),

  // GET /api/schedule - Get schedule slots
  http.get(API_SCHEDULE, async ({ request }) => {
    const url = new URL(request.url);
    const slots = Number(url.searchParams.get('slots') ?? 8);
    const date = url.searchParams.get('date');

    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      slots: createFakeScheduleSlots(slots),
      date: date ?? new Date().toISOString().split('T')[0],
    });
  }),

  // GET /api/reminders - Get reminders
  http.get(API_REMINDERS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 5);

    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      reminders: createFakeReminders(limit),
    });
  }),

  // POST /api/reminders - Create reminder
  http.post(API_REMINDERS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json(
      {
        ...(body as object),
        id: faker.string.uuid(),
      },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // DELETE /api/reminders/:id - Delete reminder
  http.delete(API_REMINDER_BY_ID, async () => {
    await delay(faker.number.int({ min: 150, max: 300 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/date-range - Get date range
  http.get(API_DATE_RANGE, async ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? 7);

    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json(createFakeDateRange(days));
  }),
];

// Status-specific handlers for stories
export const eventStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: eventHandlers,

  created: [
    http.post(API_EVENTS, async ({ request }) => {
      const body = await request.json();
      await delay(faker.number.int({ min: 300, max: 600 }));
      const event = createFakeEvent({
        ...(body as object),
        id: faker.string.uuid(),
      });
      return HttpResponse.json(event, { status: HTTP_STATUS.CREATED });
    }),
  ],

  // ============ LOADING STATES ============
  loading: [
    http.get(API_EVENTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_TIMELINE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SCHEDULE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_EVENTS, async () => {
      await delay(5000);
      return HttpResponse.json({
        events: createFakeEvents(10),
        total: 10,
        dateRange: createFakeDateRange(),
      });
    }),
    http.get(API_TIMELINE, async () => {
      await delay(5000);
      return HttpResponse.json({
        items: createFakeTimeline(10),
        hasMore: true,
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATE_RANGE',
          i18n.t('handler.event.invalidDateRangeSpecified', 'Invalid date range specified'),
          API_EVENTS,
          {
            start: i18n.t('handler.event.startDateIsRequired', 'Start date is required'),
            end: i18n.t('handler.event.endDateMustBeAfter', 'End date must be after start date'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_EVENT',
          i18n.t('handler.event.eventDataIsInvalid', 'Event data is invalid'),
          API_EVENTS,
          {
            title: i18n.t('handler.event.titleIsRequired', 'Title is required'),
            start: i18n.t('handler.event.startTimeIsRequired', 'Start time is required'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.event.authenticationRequiredToViewEvents',
            'Authentication required to view events'
          ),
          API_EVENTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.event.yourSessionHasExpired', 'Your session has expired'),
          API_EVENTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.event.youDoNotHavePermission',
            'You do not have permission to view this calendar'
          ),
          API_EVENTS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.delete(API_EVENT_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.event.cannotDeleteRecurringEventWithout',
            'Cannot delete recurring event without permission'
          ),
          `/api/events/${params.id}`
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_EVENT_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Event ${params.id} not found`,
          `/api/events/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.patch(API_EVENT_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Event ${params.id} does not exist`,
          `/api/events/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SCHEDULE_CONFLICT',
          i18n.t(
            'handler.event.thisTimeSlotConflictsWith',
            'This time slot conflicts with an existing event'
          ),
          API_EVENTS,
          {
            conflictingEventId: faker.string.uuid(),
            conflictingTime: new Date().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.event.eventValidationFailed', 'Event validation failed'),
          API_EVENTS,
          {
            end: i18n.t(
              'handler.event.endTimeCannotBeBefore',
              'End time cannot be before start time'
            ),
            attendees: i18n.t(
              'handler.event.maximum50AttendeesAllowed',
              'Maximum 50 attendees allowed'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.event.calendarApiRateLimitExceeded', 'Calendar API rate limit exceeded'),
          API_EVENTS,
          {
            limit: '500/hour',
            remaining: '0',
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CALENDAR_ERROR',
          i18n.t('handler.event.failedToFetchEvents', 'Failed to fetch events'),
          API_EVENTS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CREATE_ERROR',
          i18n.t('handler.event.failedToCreateEvent', 'Failed to create event'),
          API_EVENTS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.event.calendarSyncServiceUnavailable',
            'Calendar sync service unavailable'
          ),
          API_EVENTS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.event.calendarServiceIsUnderMaintenance',
            'Calendar service is under maintenance'
          ),
          API_EVENTS,
          {
            retryAfter: '1800',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.event.calendarSyncTimedOut', 'Calendar sync timed out'),
          API_EVENTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  networkError: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_TIMELINE, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_SCHEDULE, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.post(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json({
        events: [],
        total: 0,
        dateRange: createFakeDateRange(),
      });
    }),
    http.get(API_TIMELINE, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
        hasMore: false,
      });
    }),
    http.get(API_SCHEDULE, async () => {
      await delay(300);
      return HttpResponse.json({
        slots: [],
        date: new Date().toISOString().split('T')[0],
      });
    }),
  ],

  // Alias for backward compatibility
  get empty() {
    return this.emptyData;
  },

  partialData: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json({
        events: createFakeEvents(3),
        total: 10,
        dateRange: createFakeDateRange(),
        warning: i18n.t('handler.event.someEventsCouldNotBe', 'Some events could not be synced'),
      });
    }),
  ],

  allDayEvents: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      const events = createFakeEvents(5).map((event) => ({
        ...event,
        allDay: true,
      }));
      return HttpResponse.json({
        events,
        total: 5,
        dateRange: createFakeDateRange(),
      });
    }),
  ],

  recurringEvents: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      const events = createFakeEvents(5).map((event, index) => ({
        ...event,
        recurring: index % 2 === 0,
        recurrenceRule: index % 2 === 0 ? 'FREQ=WEEKLY;COUNT=10' : undefined,
      }));
      return HttpResponse.json({
        events,
        total: 5,
        dateRange: createFakeDateRange(),
      });
    }),
  ],

  timelineWithCurrent: [
    http.get(API_TIMELINE, async () => {
      await delay(300);
      const items = createFakeTimeline(10);
      const midpoint = Math.floor(items.length / 2);
      items.forEach((item, index) => {
        if (index < midpoint) item.status = 'completed';
        else if (index === midpoint) item.status = 'current';
        else item.status = 'upcoming';
      });
      return HttpResponse.json({
        items,
        hasMore: true,
        currentIndex: midpoint,
      });
    }),
  ],

  noAvailableSlots: [
    http.get(API_SCHEDULE, async () => {
      await delay(300);
      const slots = createFakeScheduleSlots(8).map((slot) => ({
        ...slot,
        available: false,
      }));
      return HttpResponse.json({
        slots,
        date: new Date().toISOString().split('T')[0],
        message: i18n.t(
          'handler.event.noAvailableSlotsForThis',
          'No available slots for this date'
        ),
      });
    }),
  ],
};
