import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS CALENDAR HANDLERS
// Enterprise-grade MSW handlers for calendar application page
// ============================================================================

// API Endpoints
const API_CALENDAR = '/api/apps/calendar';
const API_CALENDAR_EVENTS = '/api/apps/calendar/events';
const API_CALENDAR_CREATE = '/api/apps/calendar/create';
const API_CALENDAR_UPDATE = '/api/apps/calendar/update';
const API_CALENDAR_DELETE = '/api/apps/calendar/delete';
const API_CALENDAR_CALENDARS = '/api/apps/calendar/calendars';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsCalendarHandlers = [
  http.get(API_CALENDAR, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalEvents: faker.number.int({ min: 20, max: 200 }),
      upcomingEvents: faker.number.int({ min: 5, max: 30 }),
      todayEvents: faker.number.int({ min: 0, max: 10 }),
      calendars: faker.number.int({ min: 1, max: 5 }),
    });
  }),

  http.get(API_CALENDAR_EVENTS, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start') || new Date().toISOString();

    const events = Array.from({ length: faker.number.int({ min: 5, max: 20 }) }, () => {
      const start = faker.date.soon({ days: 30 });
      const duration = faker.number.int({ min: 30, max: 240 });
      const end = new Date(start.getTime() + duration * 60_000);

      return {
        id: faker.string.uuid(),
        title: faker.helpers.arrayElement([
          i18n.t('handler.appsCalendar.teamMeeting', 'Team Meeting'),
          i18n.t('handler.appsCalendar.projectReview', 'Project Review'),
          i18n.t('handler.appsCalendar.clientCall', 'Client Call'),
          '1:1 with Manager',
          i18n.t('handler.appsCalendar.sprintPlanning', 'Sprint Planning'),
          i18n.t('handler.appsCalendar.designReview', 'Design Review'),
          i18n.t('handler.appsCalendar.codeReview', 'Code Review'),
          i18n.t('handler.appsCalendar.lunchBreak', 'Lunch Break'),
        ]),
        description: faker.lorem.sentence(),
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: faker.datatype.boolean({ probability: 0.1 }),
        color: faker.helpers.arrayElement(['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6']),
        calendarId: faker.string.uuid(),
        location: faker.helpers.maybe(() => faker.location.streetAddress()),
        attendees: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
          email: faker.internet.email(),
          name: faker.person.fullName(),
          status: faker.helpers.arrayElement(['accepted', 'declined', 'pending']),
        })),
        recurring: faker.datatype.boolean({ probability: 0.2 }),
      };
    });

    return HttpResponse.json({ events, startDate });
  }),

  http.post(API_CALENDAR_CREATE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { end: string; start: string; title: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      ...body,
      createdAt: new Date().toISOString(),
    });
  }),

  http.put(API_CALENDAR_UPDATE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { id: string };
    return HttpResponse.json({
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete(`${API_CALENDAR_DELETE}/:id`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      success: true,
      deletedAt: new Date().toISOString(),
    });
  }),

  http.get(API_CALENDAR_CALENDARS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const calendars = [
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsCalendar.personal', 'Personal'),
        color: '#3b82f6',
        visible: true,
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsCalendar.work', 'Work'),
        color: '#ef4444',
        visible: true,
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsCalendar.family', 'Family'),
        color: '#22c55e',
        visible: true,
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsCalendar.holidays', 'Holidays'),
        color: '#f59e0b',
        visible: false,
      },
    ];
    return HttpResponse.json({ calendars });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsCalendarStatusHandlers = {
  success: appsCalendarHandlers,
  badRequest: [
    http.get(API_CALENDAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsCalendar.invalidRequestParameters', 'Invalid request parameters'),
          API_CALENDAR,
          {
            field: 'data',
            error: i18n.t('handler.appsCalendar.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CALENDAR, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsCalendar.authenticationRequired', 'Authentication required'),
          API_CALENDAR
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_CALENDAR_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'CREATE_FORBIDDEN',
          i18n.t(
            'handler.appsCalendar.cannotCreateEventsOnThis',
            'Cannot create events on this calendar'
          ),
          API_CALENDAR_CREATE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  conflict: [
    http.post(API_CALENDAR_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'TIME_CONFLICT',
          i18n.t(
            'handler.appsCalendar.eventConflictsWithExistingEvent',
            'Event conflicts with existing event'
          ),
          API_CALENDAR_CREATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_CALENDAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsCalendar.requestValidationFailed', 'Request validation failed'),
          API_CALENDAR,
          {
            field: 'data',
            error: i18n.t('handler.appsCalendar.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_CALENDAR_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsCalendar.failedToLoadEvents', 'Failed to load events'),
          API_CALENDAR_EVENTS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_CALENDAR_EVENTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_CALENDAR_EVENTS, () => HttpResponse.error())],
  emptyData: [
    http.get(API_CALENDAR_EVENTS, async () => {
      await delay(100);
      return HttpResponse.json({ events: [], startDate: new Date().toISOString() });
    }),
  ],
};
