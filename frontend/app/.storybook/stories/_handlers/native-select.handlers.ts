import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SELECT_OPTIONS = '/api/native-select/options';
const API_SELECT_SUBMIT = '/api/native-select/submit';

// Default success handlers
export const nativeSelectHandlers = [
  // GET /api/native-select/options - Get select options
  http.get(API_SELECT_OPTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') ?? 'fruits';
    await delay(faker.number.int({ min: 100, max: 300 }));

    const optionsByCategory: Record<
      string,
      Array<{ disabled?: boolean; label: string; value: string }>
    > = {
      fruits: [
        { value: 'apple', label: i18n.t('handler.nativeSelect.apple', 'Apple') },
        { value: 'banana', label: i18n.t('handler.nativeSelect.banana', 'Banana') },
        { value: 'orange', label: i18n.t('handler.nativeSelect.orange', 'Orange') },
        { value: 'grape', label: i18n.t('handler.nativeSelect.grape', 'Grape') },
        { value: 'mango', label: i18n.t('handler.nativeSelect.mango', 'Mango') },
      ],
      countries: [
        { value: 'us', label: i18n.t('handler.nativeSelect.unitedStates', 'United States') },
        { value: 'uk', label: i18n.t('handler.nativeSelect.unitedKingdom', 'United Kingdom') },
        { value: 'jp', label: i18n.t('handler.nativeSelect.japan', 'Japan') },
        { value: 'de', label: i18n.t('handler.nativeSelect.germany', 'Germany') },
        { value: 'fr', label: i18n.t('handler.nativeSelect.france', 'France') },
      ],
      sizes: [
        { value: 'xs', label: i18n.t('handler.nativeSelect.extraSmall', 'Extra Small') },
        { value: 'sm', label: i18n.t('handler.nativeSelect.small', 'Small') },
        { value: 'md', label: i18n.t('handler.nativeSelect.medium', 'Medium') },
        { value: 'lg', label: i18n.t('handler.nativeSelect.large', 'Large') },
        { value: 'xl', label: i18n.t('handler.nativeSelect.extraLarge', 'Extra Large') },
      ],
    };

    return HttpResponse.json({
      options: optionsByCategory[category] ?? optionsByCategory.fruits,
      category,
      total: (optionsByCategory[category] ?? optionsByCategory.fruits).length,
    });
  }),

  // POST /api/native-select/submit - Submit selection
  http.post(API_SELECT_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as { fieldName?: string; value: string };
    await delay(faker.number.int({ min: 150, max: 350 }));

    return HttpResponse.json({
      success: true,
      value: body.value,
      fieldName: body.fieldName ?? 'selection',
      submittedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const nativeSelectStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: nativeSelectHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_SELECT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_SELECTION',
          i18n.t('handler.nativeSelect.invalidSelectionValue', 'Invalid selection value'),
          API_SELECT_SUBMIT,
          {
            value: i18n.t(
              'handler.nativeSelect.theSelectedValueIsNotValid',
              'The selected value is not valid'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.nativeSelect.authenticationRequiredToLoadOptions',
            'Authentication required to load options'
          ),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.nativeSelect.accessDeniedToSelectionOptions',
            'Access denied to selection options'
          ),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'OPTIONS_NOT_FOUND',
          i18n.t(
            'handler.nativeSelect.noOptionsFoundForThe',
            'No options found for the requested category'
          ),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SELECT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.nativeSelect.selectionValidationFailed', 'Selection validation failed'),
          API_SELECT_SUBMIT,
          {
            value: i18n.t(
              'handler.nativeSelect.valueMustBeANonEmptyString',
              'Value must be a non-empty string'
            ),
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
          i18n.t(
            'handler.nativeSelect.tooManyRequestsPleaseTry',
            'Too many requests. Please try again later.'
          ),
          API_SELECT_OPTIONS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_SELECT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SELECTION_CONFLICT',
          i18n.t(
            'handler.nativeSelect.selectionConflictDetectedTheOptions',
            'Selection conflict detected. The options have been updated.'
          ),
          API_SELECT_SUBMIT,
          {
            reason: i18n.t(
              'handler.nativeSelect.optionsWereModifiedSincePageLoad',
              'Options were modified since page load'
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
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t(
            'handler.nativeSelect.failedToLoadSelectionOptions',
            'Failed to load selection options'
          ),
          API_SELECT_OPTIONS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.nativeSelect.optionsServiceTemporarilyUnavailable',
            'Options service temporarily unavailable'
          ),
          API_SELECT_OPTIONS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.nativeSelect.selectionServiceIsUnderMaintenance',
            'Selection service is under maintenance'
          ),
          API_SELECT_OPTIONS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.nativeSelect.optionsRequestTimedOut', 'Options request timed out'),
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
      await delay(4000);
      return HttpResponse.json({
        options: [
          { value: 'slow-1', label: i18n.t('handler.nativeSelect.slowOption1', 'Slow Option 1') },
          { value: 'slow-2', label: i18n.t('handler.nativeSelect.slowOption2', 'Slow Option 2') },
        ],
        category: 'slow',
        total: 2,
      });
    }),
  ],

  networkError: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SELECT_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json({
        options: [],
        category: 'empty',
        total: 0,
      });
    }),
  ],
};
