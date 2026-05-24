import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// RADIUS SELECTOR HANDLERS
// Enterprise-grade MSW handlers for border radius selector component
// ============================================================================

// API Endpoints
const API_RADIUS = '/api/radius';
const API_RADIUS_CURRENT = '/api/radius/current';
const API_RADIUS_SET = '/api/radius/set';
const API_RADIUS_OPTIONS = '/api/radius/options';
const API_RADIUS_PREVIEW = '/api/radius/preview';

// Types
type RadiusValue = 'full' | 'lg' | 'md' | 'none' | 'sm' | 'xl';

interface RadiusOption {
  cssValue: string;
  label: string;
  preview: string;
  value: RadiusValue;
}

interface RadiusResponse {
  cssValue: string;
  radius: RadiusValue;
  timestamp: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const radiusSelectorHandlers = [
  // GET current radius
  http.get(API_RADIUS_CURRENT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const radii: RadiusValue[] = ['none', 'sm', 'md', 'lg', 'xl', 'full'];
    const radius = faker.helpers.arrayElement(radii);
    const cssValues: Record<RadiusValue, string> = {
      none: '0px',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    };
    const response: RadiusResponse = {
      radius,
      cssValue: cssValues[radius],
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // POST set radius
  http.post(API_RADIUS_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { radius: RadiusValue };
    const cssValues: Record<RadiusValue, string> = {
      none: '0px',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    };
    const response: RadiusResponse = {
      radius: body.radius,
      cssValue: cssValues[body.radius],
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // GET radius options
  http.get(API_RADIUS_OPTIONS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const options: RadiusOption[] = [
      {
        value: 'none',
        label: i18n.t('handler.radiusSelector.none', 'None'),
        cssValue: '0px',
        preview: i18n.t('handler.radiusSelector.sharpCorners', 'Sharp corners'),
      },
      {
        value: 'sm',
        label: i18n.t('handler.radiusSelector.small', 'Small'),
        cssValue: '0.125rem',
        preview: i18n.t('handler.radiusSelector.subtleRounding', 'Subtle rounding'),
      },
      {
        value: 'md',
        label: i18n.t('handler.radiusSelector.medium', 'Medium'),
        cssValue: '0.375rem',
        preview: i18n.t('handler.radiusSelector.defaultRounding', 'Default rounding'),
      },
      {
        value: 'lg',
        label: i18n.t('handler.radiusSelector.large', 'Large'),
        cssValue: '0.5rem',
        preview: i18n.t('handler.radiusSelector.moreRounded', 'More rounded'),
      },
      {
        value: 'xl',
        label: i18n.t('handler.radiusSelector.extraLarge', 'Extra Large'),
        cssValue: '0.75rem',
        preview: i18n.t('handler.radiusSelector.veryRounded', 'Very rounded'),
      },
      {
        value: 'full',
        label: i18n.t('handler.radiusSelector.full', 'Full'),
        cssValue: '9999px',
        preview: i18n.t('handler.radiusSelector.fullyRounded', 'Fully rounded'),
      },
    ];
    return HttpResponse.json({ options });
  }),

  // POST preview radius
  http.post(API_RADIUS_PREVIEW, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { radius: RadiusValue };
    return HttpResponse.json({
      success: true,
      preview: {
        radius: body.radius,
        components: ['button', 'card', 'input', 'dialog'],
      },
    });
  }),

  // Generic endpoint
  http.get(API_RADIUS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      availableRadii: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
      currentRadius: faker.helpers.arrayElement(['none', 'sm', 'md', 'lg', 'xl', 'full']),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const radiusSelectorStatusHandlers = {
  // Success
  success: radiusSelectorHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_RADIUS_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_RADIUS',
          i18n.t('handler.radiusSelector.invalidRadiusValue', 'Invalid radius value'),
          API_RADIUS_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_RADIUS_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.radiusSelector.authenticationRequiredToChangeRadius',
            'Authentication required to change radius'
          ),
          API_RADIUS_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_RADIUS_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'RADIUS_DISABLED',
          i18n.t('handler.radiusSelector.radiusChangesAreDisabled', 'Radius changes are disabled'),
          API_RADIUS_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.radiusSelector.radiusConfigurationNotFound',
            'Radius configuration not found'
          ),
          API_RADIUS_CURRENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_RADIUS_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'PRESET_CONFLICT',
          i18n.t(
            'handler.radiusSelector.radiusChangeConflictsWithPreset',
            'Radius change conflicts with preset'
          ),
          API_RADIUS_SET
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_RADIUS_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNSUPPORTED_RADIUS',
          i18n.t('handler.radiusSelector.radiusValueNotSupported', 'Radius value not supported'),
          API_RADIUS_SET
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_RADIUS_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.radiusSelector.tooManyRadiusChangesPlease',
            'Too many radius changes. Please wait.'
          ),
          API_RADIUS_SET
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.radiusSelector.failedToRetrieveRadius', 'Failed to retrieve radius'),
          API_RADIUS_CURRENT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.radiusSelector.radiusServiceUnavailable', 'Radius service unavailable'),
          API_RADIUS_CURRENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.radiusSelector.radiusServiceTemporarilyUnavailable',
            'Radius service temporarily unavailable'
          ),
          API_RADIUS_CURRENT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.radiusSelector.radiusServiceTimeout', 'Radius service timeout'),
          API_RADIUS_CURRENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(3000);
      return HttpResponse.json({
        radius: 'md',
        cssValue: '0.375rem',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.get(API_RADIUS_CURRENT, () => HttpResponse.error())],

  emptyData: [
    http.get(API_RADIUS_CURRENT, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
