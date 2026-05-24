import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// CUSTOM DATE RANGE PICKER HANDLERS
// Enterprise-grade MSW handlers for date range picker component
// ============================================================================

// API Endpoints
const API_DATE_RANGE = '/api/date-range';
const API_DATE_RANGE_PRESETS = '/api/date-range/presets';
const API_DATE_RANGE_VALIDATE = '/api/date-range/validate';
const API_DATE_RANGE_SAVE = '/api/date-range/save';
const API_DATE_RANGE_HISTORY = '/api/date-range/history';
const API_DATE_RANGE_BLOCKED = '/api/date-range/blocked';

// Types
interface DateRangePreset {
  endOffset: number;
  id: string;
  label: string;
  startOffset: number;
  unit: 'days' | 'months' | 'weeks' | 'years';
}

interface DateRange {
  end: string;
  label?: string;
  start: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const customDateRangePickerHandlers = [
  http.get(API_DATE_RANGE_PRESETS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const presets: DateRangePreset[] = [
      {
        id: 'today',
        label: i18n.t('handler.customDateRangePicker.today', 'Today'),
        startOffset: 0,
        endOffset: 0,
        unit: 'days',
      },
      {
        id: 'yesterday',
        label: i18n.t('handler.customDateRangePicker.yesterday', 'Yesterday'),
        startOffset: -1,
        endOffset: -1,
        unit: 'days',
      },
      {
        id: 'last7days',
        label: i18n.t('handler.customDateRangePicker.last7Days', 'Last 7 Days'),
        startOffset: -7,
        endOffset: 0,
        unit: 'days',
      },
      {
        id: 'last30days',
        label: i18n.t('handler.customDateRangePicker.last30Days', 'Last 30 Days'),
        startOffset: -30,
        endOffset: 0,
        unit: 'days',
      },
      {
        id: 'thisMonth',
        label: i18n.t('handler.customDateRangePicker.thisMonth', 'This Month'),
        startOffset: 0,
        endOffset: 0,
        unit: 'months',
      },
      {
        id: 'lastMonth',
        label: i18n.t('handler.customDateRangePicker.lastMonth', 'Last Month'),
        startOffset: -1,
        endOffset: -1,
        unit: 'months',
      },
      {
        id: 'thisQuarter',
        label: i18n.t('handler.customDateRangePicker.thisQuarter', 'This Quarter'),
        startOffset: 0,
        endOffset: 0,
        unit: 'months',
      },
      {
        id: 'thisYear',
        label: i18n.t('handler.customDateRangePicker.thisYear', 'This Year'),
        startOffset: 0,
        endOffset: 0,
        unit: 'years',
      },
    ];
    return HttpResponse.json({ presets });
  }),

  http.post(API_DATE_RANGE_VALIDATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as DateRange;
    const startDate = new Date(body.start);
    const endDate = new Date(body.end);
    const isValid = startDate <= endDate;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return HttpResponse.json({
      valid: isValid,
      dayCount: daysDiff,
      warnings:
        daysDiff > 365
          ? [
              i18n.t(
                'handler.customDateRangePicker.largeDateRangeMayAffect',
                'Large date range may affect performance'
              ),
            ]
          : [],
      errors: isValid
        ? []
        : [
            i18n.t(
              'handler.customDateRangePicker.startDateMustBeBefore',
              'Start date must be before end date'
            ),
          ],
    });
  }),

  http.post(API_DATE_RANGE_SAVE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { name?: string } & DateRange;
    return HttpResponse.json({
      success: true,
      id: faker.string.uuid(),
      name: body.name || i18n.t('handler.customDateRangePicker.customRange', 'Custom Range'),
      range: { start: body.start, end: body.end },
      savedAt: new Date().toISOString(),
    });
  }),

  http.get(API_DATE_RANGE_HISTORY, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const history: Array<{ selectedAt: string } & DateRange> = Array.from({ length: 5 }, () => {
      const start = faker.date.recent({ days: 90 });
      const end = faker.date.between({ from: start, to: new Date() });
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        selectedAt: faker.date.recent().toISOString(),
      };
    });
    return HttpResponse.json({ history });
  }),

  http.get(API_DATE_RANGE_BLOCKED, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const blockedDates = Array.from(
      { length: 5 },
      () =>
        faker.date
          .between({ from: new Date(), to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) })
          .toISOString()
          .split('T')[0]
    );
    return HttpResponse.json({
      blockedDates,
      minDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }),

  http.get(API_DATE_RANGE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      defaultPreset: 'last30days',
      maxRangeDays: 365,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const customDateRangePickerStatusHandlers = {
  success: customDateRangePickerHandlers,
  badRequest: [
    http.post(API_DATE_RANGE_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATE_FORMAT',
          i18n.t(
            'handler.customDateRangePicker.invalidDateFormatProvided',
            'Invalid date format provided'
          ),
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
            'handler.customDateRangePicker.authenticationRequiredToSaveDate',
            'Authentication required to save date range'
          ),
          API_DATE_RANGE_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_DATE_RANGE_HISTORY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t('handler.customDateRangePicker.accessToHistoryDenied', 'Access to history denied'),
          API_DATE_RANGE_HISTORY
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
          i18n.t(
            'handler.customDateRangePicker.dateRangePresetsNotFound',
            'Date range presets not found'
          ),
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
            'handler.customDateRangePicker.dateRangeAlreadyExists',
            'Date range already exists'
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
          'DATE_RANGE_TOO_LARGE',
          i18n.t(
            'handler.customDateRangePicker.dateRangeExceedsMaximumAllowed',
            'Date range exceeds maximum allowed'
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
            'handler.customDateRangePicker.tooManyValidationRequests',
            'Too many validation requests'
          ),
          API_DATE_RANGE_VALIDATE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.customDateRangePicker.failedToLoadPresets', 'Failed to load presets'),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
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
            'handler.customDateRangePicker.dateRangeServiceUnavailable',
            'Date range service unavailable'
          ),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.customDateRangePicker.dateRangeServiceIsUnder',
            'Date range service is under maintenance'
          ),
          API_DATE_RANGE_PRESETS,
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
            'handler.customDateRangePicker.dateRangeRequestTimedOut',
            'Date range request timed out'
          ),
          API_DATE_RANGE_PRESETS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.get(API_DATE_RANGE_PRESETS, async () => {
      await delay(5000);
      return HttpResponse.json({
        presets: [
          {
            id: 'today',
            label: i18n.t('handler.customDateRangePicker.today', 'Today'),
            startOffset: 0,
            endOffset: 0,
            unit: 'days',
          },
          {
            id: 'last7days',
            label: i18n.t('handler.customDateRangePicker.last7Days', 'Last 7 Days'),
            startOffset: -7,
            endOffset: 0,
            unit: 'days',
          },
        ],
      });
    }),
  ],
  networkError: [http.get(API_DATE_RANGE_PRESETS, () => HttpResponse.error())],
  emptyData: [
    http.get(API_DATE_RANGE_HISTORY, async () => {
      await delay(100);
      return HttpResponse.json({ history: [] });
    }),
  ],
  invalidRange: [
    http.post(API_DATE_RANGE_VALIDATE, async () => {
      await delay(100);
      return HttpResponse.json({
        valid: false,
        dayCount: -5,
        warnings: [],
        errors: [
          i18n.t(
            'handler.customDateRangePicker.startDateMustBeBefore',
            'Start date must be before end date'
          ),
          i18n.t(
            'handler.customDateRangePicker.rangeIncludesBlockedDates',
            'Range includes blocked dates'
          ),
        ],
      });
    }),
  ],
};
