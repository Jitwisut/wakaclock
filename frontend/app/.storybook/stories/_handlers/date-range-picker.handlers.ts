import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DATE RANGE PICKER HANDLERS
// Enterprise-grade MSW handlers for date range picker component
// ============================================================================

// API Endpoints
const API_DATE_RANGE = '/api/date-range';
const API_DATE_RANGE_VALIDATE = '/api/date-range/validate';
const API_DATE_RANGE_PRESETS = '/api/date-range/presets';
const API_DATE_RANGE_AVAILABILITY = '/api/date-range/availability';
const API_DATE_RANGE_SAVE = '/api/date-range/save';

// Types
interface DateRange {
  from: string;
  to: string;
}

interface Preset {
  dateRange: DateRange;
  key: string;
  label: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dateRangePickerHandlers = [
  http.post(API_DATE_RANGE_VALIDATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { from: string; to: string };
    const fromDate = new Date(body.from);
    const toDate = new Date(body.to);
    const isValid =
      !Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime()) && fromDate <= toDate;

    return HttpResponse.json({
      valid: isValid,
      from: body.from,
      to: body.to,
      dayCount: isValid
        ? Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 0,
      errors: isValid
        ? []
        : [i18n.t('handler.dateRangePicker.invalidDateRange', 'Invalid date range')],
    });
  }),

  http.get(API_DATE_RANGE_PRESETS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const today = new Date();
    const presets: Preset[] = [
      {
        key: 'today',
        label: i18n.t('handler.dateRangePicker.today', 'Today'),
        dateRange: {
          from: today.toISOString(),
          to: today.toISOString(),
        },
      },
      {
        key: 'yesterday',
        label: i18n.t('handler.dateRangePicker.yesterday', 'Yesterday'),
        dateRange: {
          from: new Date(today.getTime() - 86_400_000).toISOString(),
          to: new Date(today.getTime() - 86_400_000).toISOString(),
        },
      },
      {
        key: 'last7Days',
        label: i18n.t('handler.dateRangePicker.last7Days', 'Last 7 Days'),
        dateRange: {
          from: new Date(today.getTime() - 6 * 86_400_000).toISOString(),
          to: today.toISOString(),
        },
      },
      {
        key: 'last28Days',
        label: i18n.t('handler.dateRangePicker.last28Days', 'Last 28 Days'),
        dateRange: {
          from: new Date(today.getTime() - 27 * 86_400_000).toISOString(),
          to: today.toISOString(),
        },
      },
      {
        key: 'thisMonth',
        label: i18n.t('handler.dateRangePicker.thisMonth', 'This Month'),
        dateRange: {
          from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
          to: today.toISOString(),
        },
      },
    ];
    return HttpResponse.json({ presets });
  }),

  http.get(API_DATE_RANGE_AVAILABILITY, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);

    // Generate availability for the month
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const availability = Array.from({ length: daysInMonth }, (_, i) => ({
      date: `${month}-${String(i + 1).padStart(2, '0')}`,
      available: faker.datatype.boolean({ probability: 0.9 }),
    }));

    return HttpResponse.json({ month, availability });
  }),

  http.post(API_DATE_RANGE_SAVE, async ({ request }) => {
    await delay(faker.number.int({ min: 150, max: 300 }));
    const body = (await request.json()) as { from: string; label?: string; to: string };
    return HttpResponse.json({
      success: true,
      id: faker.string.uuid(),
      ...body,
      savedAt: new Date().toISOString(),
    });
  }),

  http.get(API_DATE_RANGE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      minDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      maxDate: new Date().toISOString(),
      features: ['presets', 'custom-range', 'availability'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dateRangePickerStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: dateRangePickerHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_DATE_RANGE_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATE_RANGE',
          i18n.t('handler.dateRangePicker.invalidDateRangeFormat', 'Invalid date range format'),
          API_DATE_RANGE_VALIDATE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_DATE_RANGE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.dateRangePicker.authenticationRequiredToSaveDate',
            'Authentication required to save date range'
          ),
          API_DATE_RANGE_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_DATE_RANGE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SAVE_FORBIDDEN',
          i18n.t(
            'handler.dateRangePicker.youDoNotHavePermission',
            'You do not have permission to save date ranges'
          ),
          API_DATE_RANGE_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.dateRangePicker.presetsNotFound', 'Presets not found'),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_DATE_RANGE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'RANGE_CONFLICT',
          i18n.t(
            'handler.dateRangePicker.dateRangeOverlapsWithExisting',
            'Date range overlaps with existing saved range'
          ),
          API_DATE_RANGE_SAVE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_DATE_RANGE_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.dateRangePicker.startDateMustBeBefore',
            'Start date must be before end date'
          ),
          API_DATE_RANGE_VALIDATE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_DATE_RANGE_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.dateRangePicker.tooManyDateRangeRequests',
            'Too many date range requests'
          ),
          API_DATE_RANGE_VALIDATE,
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

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dateRangePicker.failedToLoadDateRange',
            'Failed to load date range presets'
          ),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.dateRangePicker.dateRangeServiceUnavailable',
            'Date range service unavailable'
          ),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_DATE_RANGE_AVAILABILITY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.dateRangePicker.dateRangeServiceIsUnder',
            'Date range service is under maintenance'
          ),
          API_DATE_RANGE_AVAILABILITY,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.dateRangePicker.dateRangeRequestTimedOut',
            'Date range request timed out'
          ),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(5000);
      const today = new Date();
      return HttpResponse.json({
        presets: [
          {
            key: 'today',
            label: i18n.t('handler.dateRangePicker.today', 'Today'),
            dateRange: { from: today.toISOString(), to: today.toISOString() },
          },
        ],
      });
    }),
  ],

  networkError: [http.get(API_DATE_RANGE_PRESETS, () => HttpResponse.error())],

  emptyData: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(100);
      return HttpResponse.json({ presets: [] });
    }),
  ],

  // ============ DATE-RANGE-SPECIFIC HANDLERS ============
  noAvailability: [
    http.get(API_DATE_RANGE_AVAILABILITY, async ({ request }) => {
      await delay(100);
      const url = new URL(request.url);
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const [year, monthNum] = month.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();

      const availability = Array.from({ length: daysInMonth }, (_, i) => ({
        date: `${month}-${String(i + 1).padStart(2, '0')}`,
        available: false,
      }));

      return HttpResponse.json({ month, availability });
    }),
  ],

  pastDatesOnly: [
    http.get(API_DATE_RANGE, async () => {
      await delay(100);
      return HttpResponse.json({
        version: '1.0.0',
        minDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        maxDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        features: ['presets', 'custom-range'],
      });
    }),
  ],
};
