import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SLIDER_CONFIG = '/api/slider/config';
const API_SLIDER_VALUE = '/api/slider/value';
const API_SLIDER_PRESETS = '/api/slider/presets';

// Default success handlers
export const sliderHandlers = [
  // GET /api/slider/config - Get slider configuration
  http.get(API_SLIDER_CONFIG, async ({ request }) => {
    const url = new URL(request.url);
    const sliderId = url.searchParams.get('sliderId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      sliderId,
      min: faker.number.int({ min: 0, max: 10 }),
      max: faker.number.int({ min: 90, max: 100 }),
      step: faker.helpers.arrayElement([1, 5, 10, 0.1, 0.5]),
      defaultValue: faker.number.int({ min: 20, max: 80 }),
      orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
      showMarks: faker.datatype.boolean({ probability: 0.3 }),
      showTooltip: faker.datatype.boolean({ probability: 0.6 }),
      disabled: faker.datatype.boolean({ probability: 0.1 }),
    });
  }),

  // POST /api/slider/value - Update slider value
  http.post(API_SLIDER_VALUE, async ({ request }) => {
    const body = (await request.json()) as { sliderId: string; value: number | number[] };
    await delay(faker.number.int({ min: 50, max: 200 }));

    return HttpResponse.json({
      success: true,
      sliderId: body.sliderId,
      value: body.value,
      previousValue: faker.number.int({ min: 0, max: 100 }),
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/slider/presets - Get slider presets
  http.get(API_SLIDER_PRESETS, async ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') ?? 'volume';

    await delay(faker.number.int({ min: 100, max: 250 }));

    const presetsByCategory: Record<string, Array<{ id: string; name: string; value: number }>> = {
      volume: [
        { id: 'mute', name: i18n.t('handler.slider.mute', 'Mute'), value: 0 },
        { id: 'quiet', name: i18n.t('handler.slider.quiet', 'Quiet'), value: 25 },
        { id: 'normal', name: i18n.t('handler.slider.normal', 'Normal'), value: 50 },
        { id: 'loud', name: i18n.t('handler.slider.loud', 'Loud'), value: 75 },
        { id: 'max', name: i18n.t('handler.slider.maximum', 'Maximum'), value: 100 },
      ],
      brightness: [
        { id: 'dim', name: i18n.t('handler.slider.dim', 'Dim'), value: 20 },
        { id: 'auto', name: i18n.t('handler.slider.auto', 'Auto'), value: 50 },
        { id: 'bright', name: i18n.t('handler.slider.bright', 'Bright'), value: 80 },
        { id: 'max', name: i18n.t('handler.slider.maximum', 'Maximum'), value: 100 },
      ],
      zoom: [
        { id: 'fit', name: i18n.t('handler.slider.fit', 'Fit'), value: 0 },
        { id: 'half', name: '50%', value: 50 },
        { id: 'full', name: '100%', value: 100 },
        { id: 'double', name: '200%', value: 200 },
      ],
    };

    return HttpResponse.json({
      category,
      presets: presetsByCategory[category] ?? presetsByCategory.volume,
    });
  }),
];

// Status-specific handlers for stories
export const sliderStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: sliderHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_VALUE',
          i18n.t('handler.slider.invalidSliderValue', 'Invalid slider value'),
          API_SLIDER_VALUE,
          {
            value: i18n.t(
              'handler.slider.valueMustBeANumberWithinTheAllowedRange',
              'Value must be a number within the allowed range'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.slider.authenticationRequiredToLoadSlider',
            'Authentication required to load slider config'
          ),
          API_SLIDER_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.slider.authenticationRequiredToUpdateSlider',
            'Authentication required to update slider value'
          ),
          API_SLIDER_VALUE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.slider.accessDeniedToModifySlider',
            'Access denied to modify slider value'
          ),
          API_SLIDER_VALUE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'SLIDER_NOT_FOUND',
          i18n.t('handler.slider.sliderConfigurationNotFound', 'Slider configuration not found'),
          API_SLIDER_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'VALUE_CONFLICT',
          i18n.t(
            'handler.slider.sliderValueWasChangedBy',
            'Slider value was changed by another session'
          ),
          API_SLIDER_VALUE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.slider.sliderValueValidationFailed', 'Slider value validation failed'),
          API_SLIDER_VALUE,
          {
            value: i18n.t(
              'handler.slider.valueExceedsMaximumAllowed100',
              'Value exceeds maximum allowed (100)'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.slider.tooManySliderUpdatesPlease',
            'Too many slider updates. Please slow down.'
          ),
          API_SLIDER_VALUE,
          { retryAfter: '2' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t(
            'handler.slider.failedToLoadSliderConfiguration',
            'Failed to load slider configuration'
          ),
          API_SLIDER_CONFIG,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t('handler.slider.failedToSaveSliderValue', 'Failed to save slider value'),
          API_SLIDER_VALUE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.slider.sliderServiceTemporarilyUnavailable',
            'Slider service temporarily unavailable'
          ),
          API_SLIDER_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.slider.sliderServiceIsUnderMaintenance',
            'Slider service is under maintenance'
          ),
          API_SLIDER_CONFIG,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.slider.sliderUpdateRequestTimedOut', 'Slider update request timed out'),
          API_SLIDER_VALUE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_SLIDER_VALUE, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        sliderId: 'slow',
        value: 50,
        updatedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_SLIDER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_SLIDER_VALUE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SLIDER_PRESETS, async () => {
      await delay(200);
      return HttpResponse.json({
        category: 'empty',
        presets: [],
      });
    }),
  ],
};
