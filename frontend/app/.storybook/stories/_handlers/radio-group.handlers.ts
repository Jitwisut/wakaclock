import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_RADIO_OPTIONS = '/api/radio-group/options';
const API_RADIO_SUBMIT = '/api/radio-group/submit';
const API_RADIO_CONFIG = '/api/radio-group/config';

// Default success handlers
export const radioGroupHandlers = [
  // GET /api/radio-group/options - Get radio options
  http.get(API_RADIO_OPTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId') ?? 'default';
    const category = url.searchParams.get('category') ?? 'general';

    await delay(faker.number.int({ min: 100, max: 300 }));

    const optionsByCategory: Record<
      string,
      Array<{ description?: string; disabled?: boolean; label: string; value: string }>
    > = {
      general: [
        {
          value: 'option1',
          label: i18n.t('handler.radioGroup.option1', 'Option 1'),
          description: i18n.t(
            'handler.radioGroup.firstOptionDescription',
            'First option description'
          ),
        },
        {
          value: 'option2',
          label: i18n.t('handler.radioGroup.option2', 'Option 2'),
          description: i18n.t(
            'handler.radioGroup.secondOptionDescription',
            'Second option description'
          ),
        },
        {
          value: 'option3',
          label: i18n.t('handler.radioGroup.option3', 'Option 3'),
          description: i18n.t(
            'handler.radioGroup.thirdOptionDescription',
            'Third option description'
          ),
        },
      ],
      sizes: [
        {
          value: 'sm',
          label: i18n.t('handler.radioGroup.small', 'Small'),
          description: i18n.t(
            'handler.radioGroup.compactSizeForTightSpaces',
            'Compact size for tight spaces'
          ),
        },
        {
          value: 'md',
          label: i18n.t('handler.radioGroup.medium', 'Medium'),
          description: i18n.t(
            'handler.radioGroup.defaultComfortableSize',
            'Default comfortable size'
          ),
        },
        {
          value: 'lg',
          label: i18n.t('handler.radioGroup.large', 'Large'),
          description: i18n.t('handler.radioGroup.largerTouchTargets', 'Larger touch targets'),
        },
      ],
      priorities: [
        { value: 'low', label: i18n.t('handler.radioGroup.lowPriority', 'Low Priority') },
        { value: 'medium', label: i18n.t('handler.radioGroup.mediumPriority', 'Medium Priority') },
        { value: 'high', label: i18n.t('handler.radioGroup.highPriority', 'High Priority') },
        {
          value: 'urgent',
          label: i18n.t('handler.radioGroup.urgent', 'Urgent'),
          description: i18n.t(
            'handler.radioGroup.requiresImmediateAttention',
            'Requires immediate attention'
          ),
        },
      ],
      themes: [
        {
          value: 'light',
          label: i18n.t('handler.radioGroup.lightMode', 'Light Mode'),
          description: i18n.t(
            'handler.radioGroup.bestForBrightEnvironments',
            'Best for bright environments'
          ),
        },
        {
          value: 'dark',
          label: i18n.t('handler.radioGroup.darkMode', 'Dark Mode'),
          description: i18n.t(
            'handler.radioGroup.easierOnTheEyesAt',
            'Easier on the eyes at night'
          ),
        },
        {
          value: 'system',
          label: i18n.t('handler.radioGroup.systemDefault', 'System Default'),
          description: i18n.t('handler.radioGroup.followOsPreference', 'Follow OS preference'),
        },
      ],
    };

    const options = optionsByCategory[category] ?? optionsByCategory.general;

    return HttpResponse.json({
      groupId,
      category,
      options,
      defaultValue: options[0]?.value,
      total: options.length,
    });
  }),

  // POST /api/radio-group/submit - Submit selected value
  http.post(API_RADIO_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as { groupId: string; value: string };
    await delay(faker.number.int({ min: 150, max: 350 }));

    return HttpResponse.json({
      success: true,
      groupId: body.groupId,
      selectedValue: body.value,
      submittedAt: new Date().toISOString(),
    });
  }),

  // GET /api/radio-group/config - Get radio group configuration
  http.get(API_RADIO_CONFIG, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
      disabled: false,
      required: faker.datatype.boolean(),
      loop: true,
    });
  }),
];

// Status-specific handlers for stories
export const radioGroupStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: radioGroupHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_SELECTION',
          i18n.t('handler.radioGroup.invalidRadioSelection', 'Invalid radio selection'),
          API_RADIO_SUBMIT,
          {
            value: i18n.t(
              'handler.radioGroup.theSelectedValueIsNotA',
              'The selected value is not a valid option'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.radioGroup.invalidRadioGroupParameters',
            'Invalid radio group parameters'
          ),
          API_RADIO_OPTIONS,
          { groupId: i18n.t('handler.radioGroup.groupIdIsRequired', 'Group ID is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.radioGroup.authenticationRequiredToLoadRadio',
            'Authentication required to load radio options'
          ),
          API_RADIO_OPTIONS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.radioGroup.authenticationRequiredToSubmitSelection',
            'Authentication required to submit selection'
          ),
          API_RADIO_SUBMIT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.radioGroup.accessDeniedToRadioOptions', 'Access denied to radio options'),
          API_RADIO_OPTIONS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.radioGroup.accessDeniedToSubmitSelection',
            'Access denied to submit selection'
          ),
          API_RADIO_SUBMIT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'GROUP_NOT_FOUND',
          i18n.t(
            'handler.radioGroup.radioGroupConfigurationNotFound',
            'Radio group configuration not found'
          ),
          API_RADIO_OPTIONS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.radioGroup.radioSelectionValidationFailed',
            'Radio selection validation failed'
          ),
          API_RADIO_SUBMIT,
          { value: i18n.t('handler.radioGroup.selectionIsRequired', 'Selection is required') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.radioGroup.tooManyRequestsPleaseTry',
            'Too many requests. Please try again later.'
          ),
          API_RADIO_OPTIONS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.radioGroup.tooManySubmissionsPleaseSlow',
            'Too many submissions. Please slow down.'
          ),
          API_RADIO_SUBMIT,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SELECTION_CONFLICT',
          i18n.t(
            'handler.radioGroup.radioSelectionWasModifiedBy',
            'Radio selection was modified by another session'
          ),
          API_RADIO_SUBMIT,
          {
            suggestion: i18n.t(
              'handler.radioGroup.pleaseRefreshAndTryAgain',
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
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.radioGroup.failedToLoadRadioOptions', 'Failed to load radio options'),
          API_RADIO_OPTIONS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SUBMIT_FAILED',
          i18n.t(
            'handler.radioGroup.failedToSubmitRadioSelection',
            'Failed to submit radio selection'
          ),
          API_RADIO_SUBMIT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.radioGroup.radioOptionsServiceTemporarilyUnavailable',
            'Radio options service temporarily unavailable'
          ),
          API_RADIO_OPTIONS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.radioGroup.radioGroupServiceIsUnder',
            'Radio group service is under maintenance'
          ),
          API_RADIO_OPTIONS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.radioGroup.radioOptionsRequestTimedOut',
            'Radio options request timed out'
          ),
          API_RADIO_OPTIONS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(4000);
      return HttpResponse.json({
        groupId: 'slow',
        category: 'general',
        options: [
          { value: 'slow-1', label: i18n.t('handler.radioGroup.slowOption1', 'Slow Option 1') },
          { value: 'slow-2', label: i18n.t('handler.radioGroup.slowOption2', 'Slow Option 2') },
        ],
        total: 2,
      });
    }),
  ],

  networkError: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_RADIO_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_RADIO_OPTIONS, async () => {
      await delay(200);
      return HttpResponse.json({
        groupId: 'empty',
        category: 'general',
        options: [],
        total: 0,
      });
    }),
  ],
};
