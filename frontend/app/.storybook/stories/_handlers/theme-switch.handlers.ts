import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// THEME SWITCH HANDLERS
// Enterprise-grade MSW handlers for theme switch component
// ============================================================================

// API Endpoints
const API_THEME_SWITCH = '/api/theme-switch';
const API_THEME_SWITCH_CURRENT = '/api/theme-switch/current';
const API_THEME_SWITCH_SET = '/api/theme-switch/set';
const API_THEME_SWITCH_OPTIONS = '/api/theme-switch/options';

// Types
type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeSwitchState {
  mode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  timestamp: string;
}

interface ThemeOption {
  description: string;
  icon: string;
  label: string;
  value: ThemeMode;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const themeSwitchHandlers = [
  // GET current theme
  http.get(API_THEME_SWITCH_CURRENT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const mode = faker.helpers.arrayElement(modes);
    const state: ThemeSwitchState = {
      mode,
      resolvedMode: mode === 'system' ? faker.helpers.arrayElement(['light', 'dark']) : mode,
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(state);
  }),

  // POST set theme
  http.post(API_THEME_SWITCH_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { mode: ThemeMode };
    const state: ThemeSwitchState = {
      mode: body.mode,
      resolvedMode:
        body.mode === 'system' ? faker.helpers.arrayElement(['light', 'dark']) : body.mode,
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(state);
  }),

  // GET theme options
  http.get(API_THEME_SWITCH_OPTIONS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const options: ThemeOption[] = [
      {
        value: 'light',
        label: i18n.t('handler.themeSwitch.light', 'Light'),
        icon: 'Sun',
        description: i18n.t('handler.themeSwitch.lightMode', 'Light mode'),
      },
      {
        value: 'dark',
        label: i18n.t('handler.themeSwitch.dark', 'Dark'),
        icon: 'Moon',
        description: i18n.t('handler.themeSwitch.darkMode', 'Dark mode'),
      },
      {
        value: 'system',
        label: i18n.t('handler.themeSwitch.system', 'System'),
        icon: 'Monitor',
        description: i18n.t(
          'handler.themeSwitch.followSystemPreference',
          'Follow system preference'
        ),
      },
    ];
    return HttpResponse.json({ options });
  }),

  // Generic endpoint
  http.get(API_THEME_SWITCH, async () => {
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

export const themeSwitchStatusHandlers = {
  // Success
  success: themeSwitchHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_THEME_SWITCH_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MODE',
          i18n.t('handler.themeSwitch.invalidThemeMode', 'Invalid theme mode'),
          API_THEME_SWITCH_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_THEME_SWITCH_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.themeSwitch.authenticationRequiredToChangeTheme',
            'Authentication required to change theme'
          ),
          API_THEME_SWITCH_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_THEME_SWITCH_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'THEME_LOCKED',
          i18n.t('handler.themeSwitch.themeChangesAreDisabled', 'Theme changes are disabled'),
          API_THEME_SWITCH_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.themeSwitch.themeConfigurationNotFound', 'Theme configuration not found'),
          API_THEME_SWITCH_CURRENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_THEME_SWITCH_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'THEME_CONFLICT',
          i18n.t(
            'handler.themeSwitch.themeChangeConflictsWithPreset',
            'Theme change conflicts with preset'
          ),
          API_THEME_SWITCH_SET
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_THEME_SWITCH_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNSUPPORTED_MODE',
          i18n.t('handler.themeSwitch.themeModeNotSupported', 'Theme mode not supported'),
          API_THEME_SWITCH_SET
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_THEME_SWITCH_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.themeSwitch.tooManyThemeChangesPlease',
            'Too many theme changes. Please wait.'
          ),
          API_THEME_SWITCH_SET
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.themeSwitch.failedToRetrieveTheme', 'Failed to retrieve theme'),
          API_THEME_SWITCH_CURRENT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.themeSwitch.themeServiceUnavailable', 'Theme service unavailable'),
          API_THEME_SWITCH_CURRENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.themeSwitch.themeServiceTemporarilyUnavailable',
            'Theme service temporarily unavailable'
          ),
          API_THEME_SWITCH_CURRENT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.themeSwitch.themeServiceTimeout', 'Theme service timeout'),
          API_THEME_SWITCH_CURRENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(3000);
      return HttpResponse.json({
        mode: 'system',
        resolvedMode: 'light',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.get(API_THEME_SWITCH_CURRENT, () => HttpResponse.error())],

  emptyData: [
    http.get(API_THEME_SWITCH_CURRENT, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
