import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// COLOR MODE SELECTOR HANDLERS
// Enterprise-grade MSW handlers for color mode selector component
// ============================================================================

// API Endpoints
const API_COLOR_MODE = '/api/color-mode';
const API_COLOR_MODE_GET = '/api/color-mode/current';
const API_COLOR_MODE_SET = '/api/color-mode/set';
const API_COLOR_MODE_PREFERENCES = '/api/color-mode/preferences';

// Types
interface ColorModeResponse {
  mode: 'dark' | 'light' | 'system';
  resolvedMode: 'dark' | 'light';
  timestamp: string;
}

interface ColorModePreferences {
  autoSwitch: boolean;
  darkModeStart: string;
  lightModeStart: string;
  respectSystemPreference: boolean;
  scheduleEnabled: boolean;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const colorModeSelectorHandlers = [
  // GET current color mode
  http.get(API_COLOR_MODE_GET, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const response: ColorModeResponse = {
      mode: faker.helpers.arrayElement(['light', 'dark', 'system']),
      resolvedMode: faker.helpers.arrayElement(['light', 'dark']),
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // POST set color mode
  http.post(API_COLOR_MODE_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { mode: string };
    const response: ColorModeResponse = {
      mode: body.mode as 'dark' | 'light' | 'system',
      resolvedMode:
        body.mode === 'system'
          ? faker.helpers.arrayElement(['light', 'dark'])
          : (body.mode as 'dark' | 'light'),
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // GET color mode preferences
  http.get(API_COLOR_MODE_PREFERENCES, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const preferences: ColorModePreferences = {
      autoSwitch: faker.datatype.boolean(),
      scheduleEnabled: faker.datatype.boolean(),
      lightModeStart: '06:00',
      darkModeStart: '18:00',
      respectSystemPreference: true,
    };
    return HttpResponse.json(preferences);
  }),

  // PUT update preferences
  http.put(API_COLOR_MODE_PREFERENCES, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<ColorModePreferences>;
    return HttpResponse.json({
      success: true,
      preferences: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Generic endpoint
  http.get(API_COLOR_MODE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      availableModes: ['light', 'dark', 'system'],
      currentMode: faker.helpers.arrayElement(['light', 'dark', 'system']),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const colorModeSelectorStatusHandlers = {
  // Success
  success: colorModeSelectorHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_COLOR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MODE',
          i18n.t('handler.colorModeSelector.invalidColorModeValue', 'Invalid color mode value'),
          API_COLOR_MODE_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_COLOR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.colorModeSelector.authenticationRequiredToChangeColor',
            'Authentication required to change color mode'
          ),
          API_COLOR_MODE_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_COLOR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ADMIN_DISABLED',
          i18n.t(
            'handler.colorModeSelector.colorModeChangesAreDisabled',
            'Color mode changes are disabled by administrator'
          ),
          API_COLOR_MODE_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.colorModeSelector.colorModeConfigurationNotFound',
            'Color mode configuration not found'
          ),
          API_COLOR_MODE_GET
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_COLOR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SCHEDULE_CONFLICT',
          i18n.t(
            'handler.colorModeSelector.colorModeChangeConflictsWith',
            'Color mode change conflicts with scheduled switch'
          ),
          API_COLOR_MODE_SET
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_COLOR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNSUPPORTED_MODE',
          i18n.t(
            'handler.colorModeSelector.colorModeValueNotSupported',
            'Color mode value not supported'
          ),
          API_COLOR_MODE_SET
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_COLOR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.colorModeSelector.tooManyColorModeChanges',
            'Too many color mode changes. Please wait.'
          ),
          API_COLOR_MODE_SET
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.colorModeSelector.failedToRetrieveColorMode',
            'Failed to retrieve color mode'
          ),
          API_COLOR_MODE_GET
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.colorModeSelector.colorModeServiceUnavailable',
            'Color mode service unavailable'
          ),
          API_COLOR_MODE_GET
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.colorModeSelector.colorModeServiceTemporarilyUnavailable',
            'Color mode service temporarily unavailable'
          ),
          API_COLOR_MODE_GET
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.colorModeSelector.colorModeServiceTimeout', 'Color mode service timeout'),
          API_COLOR_MODE_GET
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(3000);
      return HttpResponse.json({
        mode: 'system',
        resolvedMode: 'light',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.get(API_COLOR_MODE_GET, () => HttpResponse.error())],

  emptyData: [
    http.get(API_COLOR_MODE_GET, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
