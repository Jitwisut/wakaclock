import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// RESET THEME HANDLERS
// Enterprise-grade MSW handlers for reset theme button component
// ============================================================================

// API Endpoints
const API_RESET_THEME = '/api/reset-theme';
const API_RESET_THEME_CONFIRM = '/api/reset-theme/confirm';
const API_RESET_THEME_PREVIEW = '/api/reset-theme/preview';
const API_RESET_THEME_BACKUP = '/api/reset-theme/backup';
const API_RESET_THEME_RESTORE = '/api/reset-theme/restore';

// Types
interface ThemeBackup {
  createdAt: string;
  expiresAt: string;
  id: string;
  theme: Record<string, unknown>;
}

interface ResetResult {
  backupId?: string;
  newTheme: Record<string, unknown>;
  previousTheme: Record<string, unknown>;
  resetAt: string;
  success: boolean;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const resetThemeHandlers = [
  // POST reset theme
  http.post(API_RESET_THEME, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const result: ResetResult = {
      success: true,
      previousTheme: {
        colorMode: 'dark',
        radius: 'lg',
        scale: 1.1,
        preset: 'ocean',
      },
      newTheme: {
        colorMode: 'system',
        radius: 'md',
        scale: 1,
        preset: 'default',
      },
      resetAt: new Date().toISOString(),
      backupId: faker.string.uuid(),
    };
    return HttpResponse.json(result);
  }),

  // POST confirm reset (with backup)
  http.post(API_RESET_THEME_CONFIRM, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const body = (await request.json()) as { createBackup: boolean };
    const result: ResetResult = {
      success: true,
      previousTheme: {
        colorMode: 'dark',
        radius: 'lg',
        scale: 1.1,
      },
      newTheme: {
        colorMode: 'system',
        radius: 'md',
        scale: 1,
      },
      resetAt: new Date().toISOString(),
      backupId: body.createBackup ? faker.string.uuid() : undefined,
    };
    return HttpResponse.json(result);
  }),

  // GET preview of reset
  http.get(API_RESET_THEME_PREVIEW, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      currentTheme: {
        colorMode: faker.helpers.arrayElement(['light', 'dark', 'system']),
        radius: faker.helpers.arrayElement(['none', 'sm', 'md', 'lg', 'xl']),
        scale: faker.helpers.arrayElement([0.9, 1, 1.1]),
        preset: faker.helpers.arrayElement(['default', 'ocean', 'forest']),
      },
      defaultTheme: {
        colorMode: 'system',
        radius: 'md',
        scale: 1,
        preset: 'default',
      },
      differences: ['colorMode', 'radius', 'scale', 'preset'],
    });
  }),

  // POST create backup before reset
  http.post(API_RESET_THEME_BACKUP, async () => {
    await delay(faker.number.int({ min: 150, max: 300 }));
    const backup: ThemeBackup = {
      id: faker.string.uuid(),
      theme: {
        colorMode: 'dark',
        radius: 'lg',
        scale: 1.1,
        preset: 'ocean',
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };
    return HttpResponse.json({ backup });
  }),

  // POST restore from backup
  http.post(API_RESET_THEME_RESTORE, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const body = (await request.json()) as { backupId: string };
    return HttpResponse.json({
      success: true,
      restoredFrom: body.backupId,
      theme: {
        colorMode: 'dark',
        radius: 'lg',
        scale: 1.1,
        preset: 'ocean',
      },
      restoredAt: new Date().toISOString(),
    });
  }),

  // Generic endpoint
  http.get(API_RESET_THEME, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      canReset: true,
      hasCustomizations: true,
      backupsAvailable: faker.number.int({ min: 0, max: 5 }),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const resetThemeStatusHandlers = {
  // Success
  success: resetThemeHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_REQUEST',
          i18n.t('handler.resetTheme.invalidResetRequest', 'Invalid reset request'),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.resetTheme.authenticationRequiredToResetTheme',
            'Authentication required to reset theme'
          ),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ADMIN_DISABLED',
          i18n.t(
            'handler.resetTheme.themeResetIsDisabledBy',
            'Theme reset is disabled by administrator'
          ),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_RESET_THEME_RESTORE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.resetTheme.backupNotFound', 'Backup not found'),
          API_RESET_THEME_RESTORE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'RESET_IN_PROGRESS',
          i18n.t('handler.resetTheme.themeResetInProgress', 'Theme reset in progress'),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_RESET_THEME_RESTORE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'BACKUP_CORRUPTED',
          i18n.t('handler.resetTheme.backupIsCorruptedOrExpired', 'Backup is corrupted or expired'),
          API_RESET_THEME_RESTORE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.resetTheme.tooManyResetRequestsPlease',
            'Too many reset requests. Please wait.'
          ),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.resetTheme.failedToResetTheme', 'Failed to reset theme'),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.resetTheme.themeServiceUnavailable', 'Theme service unavailable'),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.resetTheme.themeServiceTemporarilyUnavailable',
            'Theme service temporarily unavailable'
          ),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_RESET_THEME, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.resetTheme.themeServiceTimeout', 'Theme service timeout'),
          API_RESET_THEME
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.post(API_RESET_THEME, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_RESET_THEME, async () => {
      await delay(3000);
      return HttpResponse.json({
        success: true,
        previousTheme: {},
        newTheme: {},
        resetAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.post(API_RESET_THEME, () => HttpResponse.error())],

  emptyData: [
    http.get(API_RESET_THEME_PREVIEW, async () => {
      await delay(100);
      return HttpResponse.json({ differences: [] });
    }),
  ],
};
