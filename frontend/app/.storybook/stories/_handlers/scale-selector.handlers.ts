import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// SCALE SELECTOR HANDLERS
// Enterprise-grade MSW handlers for UI scale selector component
// ============================================================================

const LABEL_DEFAULT = i18n.t('handler.scaleSelector.default', 'Default');

// API Endpoints
const API_SCALE = '/api/scale';
const API_SCALE_CURRENT = '/api/scale/current';
const API_SCALE_SET = '/api/scale/set';
const API_SCALE_OPTIONS = '/api/scale/options';
const API_SCALE_PREVIEW = '/api/scale/preview';

// Types
type ScaleValue = 0.9 | 0.95 | 1 | 1.05 | 1.1 | 1.15;

interface ScaleOption {
  description: string;
  label: string;
  value: ScaleValue;
}

interface ScaleResponse {
  label: string;
  scale: ScaleValue;
  timestamp: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const scaleSelectorHandlers = [
  // GET current scale
  http.get(API_SCALE_CURRENT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const scales: ScaleValue[] = [0.9, 0.95, 1, 1.05, 1.1, 1.15];
    const scale = faker.helpers.arrayElement(scales);
    const labels: Record<ScaleValue, string> = {
      0.9: i18n.t('handler.scaleSelector.compact', 'Compact'),
      0.95: i18n.t('handler.scaleSelector.small', 'Small'),
      1: LABEL_DEFAULT,
      1.05: i18n.t('handler.scaleSelector.large', 'Large'),
      1.1: i18n.t('handler.scaleSelector.extraLarge', 'Extra Large'),
      1.15: i18n.t('handler.scaleSelector.maximum', 'Maximum'),
    };
    const response: ScaleResponse = {
      scale,
      label: labels[scale],
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // POST set scale
  http.post(API_SCALE_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { scale: ScaleValue };
    const labels: Record<ScaleValue, string> = {
      0.9: i18n.t('handler.scaleSelector.compact', 'Compact'),
      0.95: i18n.t('handler.scaleSelector.small', 'Small'),
      1: LABEL_DEFAULT,
      1.05: i18n.t('handler.scaleSelector.large', 'Large'),
      1.1: i18n.t('handler.scaleSelector.extraLarge', 'Extra Large'),
      1.15: i18n.t('handler.scaleSelector.maximum', 'Maximum'),
    };
    const response: ScaleResponse = {
      scale: body.scale,
      label: labels[body.scale],
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // GET scale options
  http.get(API_SCALE_OPTIONS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const options: ScaleOption[] = [
      {
        value: 0.9,
        label: i18n.t('handler.scaleSelector.compact', 'Compact'),
        description: i18n.t(
          'handler.scaleSelector.moreContentSmallerText',
          'More content, smaller text'
        ),
      },
      {
        value: 0.95,
        label: i18n.t('handler.scaleSelector.small', 'Small'),
        description: i18n.t('handler.scaleSelector.slightlyReducedSize', 'Slightly reduced size'),
      },
      {
        value: 1,
        label: LABEL_DEFAULT,
        description: i18n.t('handler.scaleSelector.standardSizing', 'Standard sizing'),
      },
      {
        value: 1.05,
        label: i18n.t('handler.scaleSelector.large', 'Large'),
        description: i18n.t(
          'handler.scaleSelector.slightlyIncreasedSize',
          'Slightly increased size'
        ),
      },
      {
        value: 1.1,
        label: i18n.t('handler.scaleSelector.extraLarge', 'Extra Large'),
        description: i18n.t('handler.scaleSelector.betterReadability', 'Better readability'),
      },
      {
        value: 1.15,
        label: i18n.t('handler.scaleSelector.maximum', 'Maximum'),
        description: i18n.t('handler.scaleSelector.maximumAccessibility', 'Maximum accessibility'),
      },
    ];
    return HttpResponse.json({ options });
  }),

  // POST preview scale
  http.post(API_SCALE_PREVIEW, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { scale: ScaleValue };
    return HttpResponse.json({
      success: true,
      preview: {
        scale: body.scale,
        affectedElements: ['typography', 'spacing', 'icons', 'buttons'],
      },
    });
  }),

  // Generic endpoint
  http.get(API_SCALE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      availableScales: [0.9, 0.95, 1, 1.05, 1.1, 1.15],
      currentScale: faker.helpers.arrayElement([0.9, 0.95, 1, 1.05, 1.1, 1.15]),
      defaultScale: 1,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const scaleSelectorStatusHandlers = {
  // Success
  success: scaleSelectorHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_SCALE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_SCALE',
          i18n.t('handler.scaleSelector.invalidScaleValue', 'Invalid scale value'),
          API_SCALE_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_SCALE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.scaleSelector.authenticationRequiredToChangeScale',
            'Authentication required to change scale'
          ),
          API_SCALE_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SCALE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SCALE_DISABLED',
          i18n.t('handler.scaleSelector.scaleChangesAreDisabled', 'Scale changes are disabled'),
          API_SCALE_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.scaleSelector.scaleConfigurationNotFound',
            'Scale configuration not found'
          ),
          API_SCALE_CURRENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SCALE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'A11Y_CONFLICT',
          i18n.t(
            'handler.scaleSelector.scaleChangeConflictsWithAccessibility',
            'Scale change conflicts with accessibility settings'
          ),
          API_SCALE_SET
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SCALE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'OUT_OF_RANGE',
          i18n.t('handler.scaleSelector.scaleValueOutOfRange', 'Scale value out of range'),
          API_SCALE_SET
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SCALE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.scaleSelector.tooManyScaleChangesPlease',
            'Too many scale changes. Please wait.'
          ),
          API_SCALE_SET
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.scaleSelector.failedToRetrieveScale', 'Failed to retrieve scale'),
          API_SCALE_CURRENT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.scaleSelector.scaleServiceUnavailable', 'Scale service unavailable'),
          API_SCALE_CURRENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.scaleSelector.scaleServiceTemporarilyUnavailable',
            'Scale service temporarily unavailable'
          ),
          API_SCALE_CURRENT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.scaleSelector.scaleServiceTimeout', 'Scale service timeout'),
          API_SCALE_CURRENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(3000);
      return HttpResponse.json({
        scale: 1,
        label: LABEL_DEFAULT,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.get(API_SCALE_CURRENT, () => HttpResponse.error())],

  emptyData: [
    http.get(API_SCALE_CURRENT, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
