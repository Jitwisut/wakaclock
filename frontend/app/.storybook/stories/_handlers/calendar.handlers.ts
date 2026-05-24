import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeEvent,
  createFakeEvents,
  createFakeScheduleSlots,
  createFakeTimeline,
} from '../_factories/event.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_EVENTS = '/api/events';
const API_EVENT_BY_ID = '/api/events/:id';
const API_TIMELINE = '/api/timeline';
const API_SCHEDULE_SLOTS = '/api/schedule/slots';
const API_SCHEDULE_BOOK = '/api/schedule/book';

// Default success handlers
export const calendarHandlers = [
  // GET /api/events
  http.get(API_EVENTS, async ({ request }) => {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    await delay(faker.number.int({ min: 300, max: 800 }));

    return HttpResponse.json({
      events: createFakeEvents(faker.number.int({ min: 5, max: 15 })),
      meta: { start, end },
    });
  }),

  // GET /api/events/:id
  http.get(API_EVENT_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({ ...createFakeEvent(), id: params.id });
  }),

  // POST /api/events
  http.post(API_EVENTS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json(
      { ...(body as object), id: faker.string.uuid() },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // PATCH /api/events/:id
  http.patch(API_EVENT_BY_ID, async ({ request, params }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({ ...(body as object), id: params.id });
  }),

  // DELETE /api/events/:id
  http.delete(API_EVENT_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/timeline
  http.get(API_TIMELINE, async () => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    return HttpResponse.json({ items: createFakeTimeline(faker.number.int({ min: 5, max: 10 })) });
  }),

  // GET /api/schedule/slots
  http.get(API_SCHEDULE_SLOTS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({ slots: createFakeScheduleSlots(12) });
  }),

  // POST /api/schedule/book
  http.post(API_SCHEDULE_BOOK, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 300, max: 700 }));
    return HttpResponse.json({
      success: true,
      booking: {
        id: faker.string.uuid(),
        ...(body as object),
        confirmedAt: new Date().toISOString(),
      },
    });
  }),
];

// Status-specific handlers for stories
export const calendarStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: calendarHandlers,

  created: [
    http.post(API_EVENTS, async ({ request }) => {
      const body = await request.json();
      await delay(400);
      return HttpResponse.json(
        { ...createFakeEvent(), ...(body as object), id: faker.string.uuid() },
        { status: HTTP_STATUS.CREATED }
      );
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
          i18n.t('handler.calendar.invalidDateRangeSpecified', 'Invalid date range specified'),
          API_EVENTS,
          {
            start: i18n.t('handler.calendar.startDateIsRequired', 'Start date is required'),
            end: i18n.t('handler.calendar.endDateMustBeAfter', 'End date must be after start date'),
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
          i18n.t('handler.calendar.eventDataIsInvalid', 'Event data is invalid'),
          API_EVENTS,
          {
            title: i18n.t('handler.calendar.titleIsRequired', 'Title is required'),
            start: i18n.t('handler.calendar.startTimeIsRequired', 'Start time is required'),
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
          i18n.t('handler.calendar.pleaseLogInToView', 'Please log in to view events'),
          API_EVENTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.patch(API_EVENT_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.calendar.youCannotEditThisEvent', 'You cannot edit this event'),
          API_EVENT_BY_ID
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.delete(API_EVENT_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.calendar.youCannotDeleteThisEvent', 'You cannot delete this event'),
          API_EVENT_BY_ID
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
          'EVENT_NOT_FOUND',
          `Event ${params.id} not found`,
          `${API_EVENTS}/${params.id}`
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
          'TIME_CONFLICT',
          i18n.t(
            'handler.calendar.eventConflictsWithAnExisting',
            'Event conflicts with an existing event'
          ),
          API_EVENTS,
          {
            conflictingEventId: faker.string.uuid(),
            conflictingTime: faker.date.soon().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
    http.post(API_SCHEDULE_BOOK, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SLOT_TAKEN',
          i18n.t('handler.calendar.thisTimeSlotIsNo', 'This time slot is no longer available'),
          API_SCHEDULE_BOOK
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
          i18n.t('handler.calendar.eventValidationFailed', 'Event validation failed'),
          API_EVENTS,
          {
            title: i18n.t(
              'handler.calendar.titleMustBeAtLeast',
              'Title must be at least 3 characters'
            ),
            description: i18n.t(
              'handler.calendar.descriptionIsTooLongMax',
              'Description is too long (max 500 characters)'
            ),
            end: i18n.t('handler.calendar.endTimeMustBeAfter', 'End time must be after start time'),
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
          i18n.t(
            'handler.calendar.calendarApiRateLimitExceeded',
            'Calendar API rate limit exceeded'
          ),
          API_EVENTS,
          {
            limit: '100/hour',
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
          i18n.t('handler.calendar.calendarServiceError', 'Calendar service error'),
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
            'handler.calendar.calendarSyncServiceUnavailable',
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
            'handler.calendar.calendarServiceUnderMaintenance',
            'Calendar service under maintenance'
          ),
          API_EVENTS,
          {
            retryAfter: '600',
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
          i18n.t('handler.calendar.calendarSyncTimedOut', 'Calendar sync timed out'),
          API_EVENTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_EVENTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_EVENTS, async () => {
      await delay(5000);
      return HttpResponse.json({
        events: createFakeEvents(10),
      });
    }),
  ],

  networkError: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  empty: [
    http.get(API_EVENTS, async () => {
      await delay(300);
      return HttpResponse.json({ events: [] });
    }),
  ],

  manyEvents: [
    http.get(API_EVENTS, async () => {
      await delay(500);
      return HttpResponse.json({
        events: createFakeEvents(50),
      });
    }),
  ],

  noAvailableSlots: [
    http.get(API_SCHEDULE_SLOTS, async () => {
      await delay(300);
      return HttpResponse.json({
        slots: createFakeScheduleSlots(8).map((slot) => ({ ...slot, available: false })),
      });
    }),
  ],
};
