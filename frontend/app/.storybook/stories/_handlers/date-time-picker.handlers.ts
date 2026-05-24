import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DATE TIME PICKER HANDLERS
// Enterprise-grade MSW handlers for date time picker component
// ============================================================================

// API Endpoints
const API_DATETIME = '/api/datetime';
const API_DATETIME_VALIDATE = '/api/datetime/validate';
const API_DATETIME_TIMEZONE = '/api/datetime/timezone';
const API_DATETIME_FORMAT = '/api/datetime/format';
const API_DATETIME_AVAILABILITY = '/api/datetime/availability';
const API_DATETIME_SCHEDULE = '/api/datetime/schedule';

// Types
interface Timezone {
  abbreviation: string;
  id: string;
  name: string;
  offset: string;
}

interface TimeSlot {
  available: boolean;
  end: string;
  start: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dateTimePickerHandlers = [
  http.post(API_DATETIME_VALIDATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { datetime: string; timezone?: string };
    const date = new Date(body.datetime);
    const isValid = !Number.isNaN(date.getTime());
    const isPast = date < new Date();
    const isFuture = date > new Date();

    return HttpResponse.json({
      valid: isValid,
      isPast,
      isFuture,
      formatted: {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
        full: date.toLocaleString(),
        iso: date.toISOString(),
      },
      errors: isValid
        ? []
        : [i18n.t('handler.dateTimePicker.invalidDatetimeFormat', 'Invalid datetime format')],
    });
  }),

  http.get(API_DATETIME_TIMEZONE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const timezones: Timezone[] = [
      {
        id: 'UTC',
        name: i18n.t(
          'handler.dateTimePicker.coordinatedUniversalTime',
          'Coordinated Universal Time'
        ),
        offset: '+00:00',
        abbreviation: 'UTC',
      },
      {
        id: 'America/New_York',
        name: i18n.t('handler.dateTimePicker.easternTime', 'Eastern Time'),
        offset: '-05:00',
        abbreviation: 'EST',
      },
      {
        id: 'America/Los_Angeles',
        name: i18n.t('handler.dateTimePicker.pacificTime', 'Pacific Time'),
        offset: '-08:00',
        abbreviation: 'PST',
      },
      {
        id: 'Europe/London',
        name: i18n.t('handler.dateTimePicker.britishTime', 'British Time'),
        offset: '+00:00',
        abbreviation: 'GMT',
      },
      {
        id: 'Europe/Paris',
        name: i18n.t('handler.dateTimePicker.centralEuropeanTime', 'Central European Time'),
        offset: '+01:00',
        abbreviation: 'CET',
      },
      {
        id: 'Asia/Tokyo',
        name: i18n.t('handler.dateTimePicker.japanStandardTime', 'Japan Standard Time'),
        offset: '+09:00',
        abbreviation: 'JST',
      },
      {
        id: 'Asia/Shanghai',
        name: i18n.t('handler.dateTimePicker.chinaStandardTime', 'China Standard Time'),
        offset: '+08:00',
        abbreviation: 'CST',
      },
      {
        id: 'Australia/Sydney',
        name: i18n.t('handler.dateTimePicker.australianEasternTime', 'Australian Eastern Time'),
        offset: '+11:00',
        abbreviation: 'AEDT',
      },
    ];
    return HttpResponse.json({
      timezones,
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }),

  http.get(API_DATETIME_FORMAT, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({
      formats: [
        {
          id: 'iso',
          label: i18n.t('handler.dateTimePicker.iso8601', 'ISO 8601'),
          example: '2024-01-15T14:30:00Z',
        },
        {
          id: 'us',
          label: i18n.t('handler.dateTimePicker.usFormat', 'US Format'),
          example: '01/15/2024 2:30 PM',
        },
        {
          id: 'eu',
          label: i18n.t('handler.dateTimePicker.europeanFormat', 'European Format'),
          example: '15/01/2024 14:30',
        },
        {
          id: 'jp',
          label: i18n.t('handler.dateTimePicker.japaneseFormat', 'Japanese Format'),
          example: '2024年1月15日 14:30',
        },
        {
          id: 'relative',
          label: i18n.t('handler.dateTimePicker.relative', 'Relative'),
          example: i18n.t('handler.dateTimePicker.inTwoHours', 'in 2 hours'),
        },
      ],
      defaultFormat: 'iso',
    });
  }),

  http.get(API_DATETIME_AVAILABILITY, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const slots: TimeSlot[] = Array.from({ length: 8 }, (_, i) => {
      const hour = 9 + i;
      return {
        start: `${dateStr}T${hour.toString().padStart(2, '0')}:00:00`,
        end: `${dateStr}T${(hour + 1).toString().padStart(2, '0')}:00:00`,
        available: faker.datatype.boolean({ probability: 0.7 }),
      };
    });

    return HttpResponse.json({ date: dateStr, slots });
  }),

  http.post(API_DATETIME_SCHEDULE, async ({ request }) => {
    await delay(faker.number.int({ min: 150, max: 300 }));
    const body = (await request.json()) as { datetime: string; duration?: number; title?: string };
    return HttpResponse.json({
      success: true,
      id: faker.string.uuid(),
      scheduledAt: body.datetime,
      duration: body.duration || 60,
      title: body.title || i18n.t('handler.dateTimePicker.scheduledEvent', 'Scheduled Event'),
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(API_DATETIME, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      serverTime: new Date().toISOString(),
      features: ['timezone', 'availability', 'scheduling'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dateTimePickerStatusHandlers = {
  success: dateTimePickerHandlers,
  badRequest: [
    http.post(API_DATETIME_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATETIME',
          i18n.t('handler.dateTimePicker.invalidDatetimeFormat', 'Invalid datetime format'),
          API_DATETIME_VALIDATE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_DATETIME_SCHEDULE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.dateTimePicker.authenticationRequiredToSchedule',
            'Authentication required to schedule'
          ),
          API_DATETIME_SCHEDULE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_DATETIME_SCHEDULE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SCHEDULE_FORBIDDEN',
          i18n.t(
            'handler.dateTimePicker.schedulingNotAllowedForThis',
            'Scheduling not allowed for this time'
          ),
          API_DATETIME_SCHEDULE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_DATETIME_AVAILABILITY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.dateTimePicker.scheduleNotFound', 'Schedule not found'),
          API_DATETIME_AVAILABILITY
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_DATETIME_SCHEDULE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'TIME_SLOT_TAKEN',
          i18n.t(
            'handler.dateTimePicker.thisTimeSlotIsAlready',
            'This time slot is already booked'
          ),
          API_DATETIME_SCHEDULE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  unprocessableEntity: [
    http.post(API_DATETIME_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'DATE_IN_PAST',
          i18n.t('handler.dateTimePicker.cannotSelectADateIn', 'Cannot select a date in the past'),
          API_DATETIME_VALIDATE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_DATETIME_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.dateTimePicker.tooManyDatetimeValidationRequests',
            'Too many datetime validation requests'
          ),
          API_DATETIME_VALIDATE,
          {
            limit: '100/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.get(API_DATETIME_TIMEZONE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.dateTimePicker.failedToLoadTimezones', 'Failed to load timezones'),
          API_DATETIME_TIMEZONE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  serviceUnavailable: [
    http.get(API_DATETIME_AVAILABILITY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_DOWN',
          i18n.t(
            'handler.dateTimePicker.schedulingServiceTemporarilyUnavailable',
            'Scheduling service temporarily unavailable'
          ),
          API_DATETIME_AVAILABILITY,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  badGateway: [
    http.get(API_DATETIME_TIMEZONE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.dateTimePicker.datetimeServiceUnavailable',
            'Datetime service unavailable'
          ),
          API_DATETIME_TIMEZONE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  gatewayTimeout: [
    http.get(API_DATETIME_TIMEZONE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.dateTimePicker.datetimeRequestTimedOut', 'Datetime request timed out'),
          API_DATETIME_TIMEZONE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.get(API_DATETIME_TIMEZONE, async () => {
      await delay(5000);
      return HttpResponse.json({
        timezones: [
          {
            id: 'UTC',
            name: i18n.t(
              'handler.dateTimePicker.coordinatedUniversalTime',
              'Coordinated Universal Time'
            ),
            offset: '+00:00',
            abbreviation: 'UTC',
          },
        ],
        userTimezone: 'UTC',
      });
    }),
  ],
  loading: [
    http.get(API_DATETIME_AVAILABILITY, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_DATETIME_TIMEZONE, () => HttpResponse.error())],
  emptyData: [
    http.get(API_DATETIME_AVAILABILITY, async () => {
      await delay(100);
      return HttpResponse.json({ date: new Date().toISOString().split('T')[0], slots: [] });
    }),
  ],
  noAvailability: [
    http.get(API_DATETIME_AVAILABILITY, async ({ request }) => {
      await delay(100);
      const url = new URL(request.url);
      const dateStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const slots: TimeSlot[] = Array.from({ length: 8 }, (_, i) => {
        const hour = 9 + i;
        return {
          start: `${dateStr}T${hour.toString().padStart(2, '0')}:00:00`,
          end: `${dateStr}T${(hour + 1).toString().padStart(2, '0')}:00:00`,
          available: false,
        };
      });
      return HttpResponse.json({ date: dateStr, slots });
    }),
  ],
};
