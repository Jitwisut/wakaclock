import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// ACTIVE THEME HANDLERS
// Enterprise-grade MSW handlers for active theme component
// ============================================================================

// API Endpoints
const API_THEME = '/api/theme';
const API_THEME_CURRENT = '/api/theme/current';
const API_THEME_SET = '/api/theme/set';
const API_THEME_LIST = '/api/theme/list';
const API_THEME_PREVIEW = '/api/theme/preview';
const API_THEME_RESET = '/api/theme/reset';

// Types
interface Theme {
  colors: {
    accent: string;
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
  };
  displayName: string;
  id: string;
  isCustom: boolean;
  isDefault: boolean;
  mode: 'dark' | 'light' | 'system';
  name: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const activeThemeHandlers = [
  http.get(API_THEME_CURRENT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      theme: {
        id: 'default-light',
        name: 'default',
        displayName: i18n.t('handler.activeTheme.defaultLight', 'Default Light'),
        colors: {
          primary: '#0066cc',
          secondary: '#6c757d',
          accent: '#17a2b8',
          background: '#ffffff',
          foreground: '#212529',
        },
        mode: 'light',
        isDefault: true,
        isCustom: false,
      } as Theme,
      appliedAt: new Date().toISOString(),
    });
  }),

  http.post(API_THEME_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { mode?: string; themeId: string };
    return HttpResponse.json({
      success: true,
      themeId: body.themeId,
      mode: body.mode || 'light',
      appliedAt: new Date().toISOString(),
    });
  }),

  http.get(API_THEME_LIST, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const themes: Theme[] = [
      {
        id: 'default-light',
        name: 'default',
        displayName: i18n.t('handler.activeTheme.defaultLight', 'Default Light'),
        colors: {
          primary: '#0066cc',
          secondary: '#6c757d',
          accent: '#17a2b8',
          background: '#ffffff',
          foreground: '#212529',
        },
        mode: 'light',
        isDefault: true,
        isCustom: false,
      },
      {
        id: 'default-dark',
        name: 'default',
        displayName: i18n.t('handler.activeTheme.defaultDark', 'Default Dark'),
        colors: {
          primary: '#4da3ff',
          secondary: '#adb5bd',
          accent: '#5bc0de',
          background: '#1a1a1a',
          foreground: '#f8f9fa',
        },
        mode: 'dark',
        isDefault: true,
        isCustom: false,
      },
      {
        id: 'ocean-light',
        name: 'ocean',
        displayName: i18n.t('handler.activeTheme.oceanLight', 'Ocean Light'),
        colors: {
          primary: '#0077b6',
          secondary: '#48cae4',
          accent: '#90e0ef',
          background: '#f0f9ff',
          foreground: '#023e8a',
        },
        mode: 'light',
        isDefault: false,
        isCustom: false,
      },
      {
        id: 'forest-dark',
        name: 'forest',
        displayName: i18n.t('handler.activeTheme.forestDark', 'Forest Dark'),
        colors: {
          primary: '#2d6a4f',
          secondary: '#40916c',
          accent: '#52b788',
          background: '#1b4332',
          foreground: '#d8f3dc',
        },
        mode: 'dark',
        isDefault: false,
        isCustom: false,
      },
    ];
    return HttpResponse.json({ themes, total: themes.length });
  }),

  http.post(API_THEME_PREVIEW, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { themeId: string };
    return HttpResponse.json({
      success: true,
      themeId: body.themeId,
      previewMode: true,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
  }),

  http.post(API_THEME_RESET, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      success: true,
      resetTo: 'default-light',
      resetAt: new Date().toISOString(),
    });
  }),

  http.get(API_THEME, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      supportedModes: ['light', 'dark', 'system'],
      totalThemes: 4,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const activeThemeStatusHandlers = {
  success: activeThemeHandlers,
  badRequest: [
    http.post(API_THEME_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_THEME',
          i18n.t('handler.activeTheme.invalidThemeConfiguration', 'Invalid theme configuration'),
          API_THEME_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_THEME_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.activeTheme.authenticationRequiredToChangeTheme',
            'Authentication required to change theme'
          ),
          API_THEME_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_THEME_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'THEME_LOCKED',
          i18n.t('handler.activeTheme.themeChangesAreRestricted', 'Theme changes are restricted'),
          API_THEME_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.post(API_THEME_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'THEME_NOT_FOUND',
          i18n.t('handler.activeTheme.themeNotFound', 'Theme not found'),
          API_THEME_SET
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_THEME, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.activeTheme.requestValidationFailed', 'Request validation failed'),
          API_THEME,
          {
            field: 'data',
            error: i18n.t('handler.activeTheme.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_THEME_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.activeTheme.failedToLoadCurrentTheme', 'Failed to load current theme'),
          API_THEME_CURRENT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_THEME_CURRENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_THEME_CURRENT, () => HttpResponse.error())],
  slowResponse: [
    http.get(API_THEME_LIST, async () => {
      await delay(3000);
      return HttpResponse.json({ themes: [], total: 0 });
    }),
  ],
  emptyData: [
    http.get(API_THEME_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ themes: [], total: 0 });
    }),
  ],
};
