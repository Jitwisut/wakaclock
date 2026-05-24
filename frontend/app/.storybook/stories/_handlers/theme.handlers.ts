import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createDefaultThemeConfig,
  createFakeThemeConfig,
  createFakeThemePresets,
} from '../_factories/theme.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_THEME_CONFIG = '/api/theme';
const API_THEME_PRESETS = '/api/theme/presets';
const API_THEME_RESET = '/api/theme/reset';
const API_THEME_SAVE = '/api/theme/save';

// Default success handlers
export const themeHandlers = [
  // GET /api/theme - Fetch user theme config
  http.get(API_THEME_CONFIG, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json(createFakeThemeConfig());
  }),

  // GET /api/theme/presets - Fetch available presets
  http.get(API_THEME_PRESETS, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({ presets: createFakeThemePresets() });
  }),

  // POST /api/theme/save - Save theme config
  http.post(API_THEME_SAVE, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 300, max: 800 }));
    return HttpResponse.json({
      ...(body as object),
      updatedAt: new Date().toISOString(),
      success: true,
    });
  }),

  // POST /api/theme/reset - Reset theme to defaults
  http.post(API_THEME_RESET, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      ...createDefaultThemeConfig(),
      success: true,
    });
  }),
];

// Status-specific handlers for stories
export const themeStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: themeHandlers,

  // ============ LOADING STATES ============
  loading: [
    http.get(API_THEME_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_THEME_PRESETS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(5000);
      return HttpResponse.json(createFakeThemeConfig());
    }),
    http.get(API_THEME_PRESETS, async () => {
      await delay(5000);
      return HttpResponse.json({ presets: createFakeThemePresets() });
    }),
    http.post(API_THEME_SAVE, async ({ request }) => {
      const body = await request.json();
      await delay(5000);
      return HttpResponse.json({
        ...(body as object),
        updatedAt: new Date().toISOString(),
        success: true,
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_REQUEST',
          i18n.t(
            'handler.theme.invalidThemeConfigurationRequest',
            'Invalid theme configuration request'
          ),
          API_THEME_CONFIG
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_THEME',
          i18n.t('handler.theme.invalidThemeConfiguration', 'Invalid theme configuration'),
          API_THEME_SAVE,
          {
            preset: i18n.t('handler.theme.unknownPreset', 'Unknown preset'),
            radius: i18n.t('handler.theme.invalidRadiusValue', 'Invalid radius value'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t(
            'handler.theme.yourSessionHasExpiredPlease',
            'Your session has expired. Please log in again.'
          ),
          API_THEME_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t(
            'handler.theme.yourSessionHasExpiredPlease',
            'Your session has expired. Please log in again.'
          ),
          API_THEME_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PERMISSION_DENIED',
          i18n.t(
            'handler.theme.youDoNotHavePermission',
            'You do not have permission to access theme settings'
          ),
          API_THEME_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PERMISSION_DENIED',
          i18n.t(
            'handler.theme.youDoNotHavePermission2',
            'You do not have permission to modify theme settings'
          ),
          API_THEME_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'THEME_NOT_FOUND',
          i18n.t('handler.theme.themeConfigurationNotFound', 'Theme configuration not found'),
          API_THEME_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_THEME_SAVE, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.theme.themeValidationFailed', 'Theme validation failed'),
          API_THEME_SAVE,
          {
            preset: i18n.t(
              'handler.theme.presetCustomIsNotAvailable',
              'Preset "custom" is not available in your plan'
            ),
            scale: i18n.t(
              'handler.theme.scaleXlRequiresPremiumSubscription',
              'Scale "xl" requires premium subscription'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.theme.tooManyThemeRequestsPlease',
            'Too many theme requests. Please try again later.'
          ),
          API_THEME_CONFIG,
          {
            limit: '60/minute',
            retryAfter: '30',
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.theme.tooManyThemeSaveRequests',
            'Too many theme save requests. Please try again later.'
          ),
          API_THEME_SAVE,
          {
            limit: '10/minute',
            retryAfter: '45',
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'THEME_SERVICE_ERROR',
          i18n.t(
            'handler.theme.failedToLoadThemeConfiguration',
            'Failed to load theme configuration'
          ),
          API_THEME_CONFIG,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_ERROR',
          i18n.t(
            'handler.theme.failedToSaveThemeConfiguration',
            'Failed to save theme configuration'
          ),
          API_THEME_SAVE,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.theme.themeServiceIsTemporarilyUnavailable',
            'Theme service is temporarily unavailable'
          ),
          API_THEME_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.theme.themeServiceIsUnderMaintenance',
            'Theme service is under maintenance'
          ),
          API_THEME_CONFIG,
          {
            estimatedDowntime: '15 minutes',
            statusPage: 'https://status.example.com',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.theme.themeServiceRequestTimedOut', 'Theme service request timed out'),
          API_THEME_CONFIG
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  networkError: [
    http.get(API_THEME_CONFIG, async () => {
      await delay(400);
      return HttpResponse.error();
    }),
    http.get(API_THEME_PRESETS, async () => {
      await delay(400);
      return HttpResponse.error();
    }),
    http.post(API_THEME_SAVE, async () => {
      await delay(400);
      return HttpResponse.error();
    }),
    http.post(API_THEME_RESET, async () => {
      await delay(400);
      return HttpResponse.error();
    }),
  ],

  emptyPresets: [
    http.get(API_THEME_PRESETS, async () => {
      await delay(300);
      return HttpResponse.json({ presets: [] });
    }),
  ],

  resetSuccess: [
    http.post(API_THEME_RESET, async () => {
      await delay(500);
      return HttpResponse.json({
        ...createDefaultThemeConfig(),
        success: true,
        message: i18n.t(
          'handler.theme.themeResetToDefaultsSuccessfully',
          'Theme reset to defaults successfully'
        ),
      });
    }),
  ],

  resetFailed: [
    http.post(API_THEME_RESET, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'RESET_FAILED',
          i18n.t('handler.theme.failedToResetThemeTo', 'Failed to reset theme to defaults'),
          API_THEME_RESET
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
};
