import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeCheckbox,
  createFakeNativeSelect,
  createFakeRadioGroup,
  createFakeSelect,
  createFakeSelectOptions,
} from '../_factories/select.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SELECT_OPTIONS = '/api/select/options';
const API_SELECT_VALUE = '/api/select/value';
const API_RADIO_OPTIONS = '/api/radio/options';
const API_CHECKBOX_STATE = '/api/checkbox/state';

// Default success handlers
export const selectHandlers = [
  // GET /api/select/options - Fetch select options
  http.get(API_SELECT_OPTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 8);
    const category = url.searchParams.get('category') ?? 'default';
    await delay(faker.number.int({ min: 200, max: 500 }));

    const options = createFakeSelectOptions(count);
    return HttpResponse.json({ options, category, total: options.length });
  }),

  // POST /api/select/value - Update select value
  http.post(API_SELECT_VALUE, async ({ request }) => {
    const body = (await request.json()) as { selectId: string; value: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      selectId: body.selectId,
      value: body.value,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET /api/radio/options - Fetch radio group options
  http.get(API_RADIO_OPTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId') ?? faker.string.uuid();
    await delay(faker.number.int({ min: 200, max: 400 }));

    const radioGroup = createFakeRadioGroup();
    return HttpResponse.json({ radioGroup: { ...radioGroup, id: groupId } });
  }),

  // POST /api/radio/options - Update radio selection
  http.post(API_RADIO_OPTIONS, async ({ request }) => {
    const body = (await request.json()) as { groupId: string; value: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      groupId: body.groupId,
      value: body.value,
    });
  }),

  // GET /api/checkbox/state - Fetch checkbox states
  http.get(API_CHECKBOX_STATE, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const checkboxes = Array.from({ length: count }, () => createFakeCheckbox());
    return HttpResponse.json({ checkboxes, total: checkboxes.length });
  }),

  // POST /api/checkbox/state - Update checkbox state
  http.post(API_CHECKBOX_STATE, async ({ request }) => {
    const body = (await request.json()) as { checked: boolean; id: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      checkbox: createFakeCheckbox({ id: body.id, checked: body.checked }),
    });
  }),

  // GET /api/native-select - Fetch native select config
  http.get('/api/native-select', async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));

    const nativeSelect = createFakeNativeSelect();
    return HttpResponse.json({ nativeSelect });
  }),

  // GET /api/select/config - Fetch full select configuration
  http.get('/api/select/config', async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      select: createFakeSelect(),
      nativeSelect: createFakeNativeSelect(),
      radioGroup: createFakeRadioGroup(),
      checkboxes: Array.from({ length: 4 }, () => createFakeCheckbox()),
    });
  }),
];

// Status-specific handlers for stories
export const selectStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: selectHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.select.invalidSelectParameters', 'Invalid select parameters'),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_SELECT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.select.authenticationRequired', 'Authentication required'),
          API_SELECT_VALUE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SELECT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.select.cannotModifySelection', 'Cannot modify selection'),
          API_SELECT_VALUE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.select.optionsNotFound', 'Options not found'),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  validationError: [
    http.post(API_SELECT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_VALUE',
          i18n.t('handler.select.invalidSelectionValue', 'Invalid selection value'),
          API_SELECT_VALUE,
          {
            value: i18n.t(
              'handler.select.valueMustBeFromAvailable',
              'Value must be from available options'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.select.requestValidationFailed', 'Request validation failed'),
          API_SELECT_OPTIONS,
          {
            field: 'data',
            error: i18n.t('handler.select.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.select.tooManyRequests', 'Too many requests'),
          API_SELECT_OPTIONS,
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

  conflict: [
    http.post(API_SELECT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SELECTION_CONFLICT',
          i18n.t(
            'handler.select.selectionWasModifiedByAnother',
            'Selection was modified by another session'
          ),
          API_SELECT_VALUE,
          {
            suggestion: i18n.t(
              'handler.select.pleaseRefreshAndTryAgain',
              'Please refresh and try again'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.select.failedToLoadOptions', 'Failed to load options'),
          API_SELECT_OPTIONS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.select.optionsServiceUnavailable', 'Options service unavailable'),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.select.serviceUnderMaintenance', 'Service under maintenance'),
          API_SELECT_OPTIONS,
          {
            retryAfter: '120',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.select.requestTimedOut', 'Request timed out'),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(5000);
      const options = createFakeSelectOptions(8);
      return HttpResponse.json({ options, total: options.length });
    }),
  ],

  networkError: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyOptions: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      return HttpResponse.json({ options: [], total: 0 });
    }),
  ],

  singleOption: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      const options = createFakeSelectOptions(1);
      return HttpResponse.json({ options, total: 1 });
    }),
  ],

  manyOptions: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      const options = createFakeSelectOptions(50);
      return HttpResponse.json({ options, total: 50 });
    }),
  ],

  disabledOptions: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(300);
      const options = createFakeSelectOptions(8).map((opt) => ({ ...opt, disabled: true }));
      return HttpResponse.json({ options, total: options.length });
    }),
  ],
};
