import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// SITE HEADER HANDLERS
// Enterprise-grade MSW handlers for site header component
// ============================================================================

// API Endpoints
const API_HEADER = '/api/header';
const API_HEADER_CONFIG = '/api/header/config';
const API_HEADER_STATE = '/api/header/state';

// Types
interface HeaderConfig {
  showNotifications: boolean;
  showSearch: boolean;
  showThemeSwitch: boolean;
  showUserMenu: boolean;
  sticky: boolean;
  transparent: boolean;
}

interface HeaderState {
  activeSection: null | string;
  isMobileMenuOpen: boolean;
  isScrolled: boolean;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const siteHeaderHandlers = [
  // GET header config
  http.get(API_HEADER_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const config: HeaderConfig = {
      showSearch: true,
      showNotifications: true,
      showThemeSwitch: true,
      showUserMenu: true,
      sticky: true,
      transparent: false,
    };
    return HttpResponse.json(config);
  }),

  // PUT update header config
  http.put(API_HEADER_CONFIG, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<HeaderConfig>;
    return HttpResponse.json({
      success: true,
      config: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET header state
  http.get(API_HEADER_STATE, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const state: HeaderState = {
      isScrolled: false,
      isMobileMenuOpen: false,
      activeSection: null,
    };
    return HttpResponse.json(state);
  }),

  // POST update header state
  http.post(API_HEADER_STATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as Partial<HeaderState>;
    return HttpResponse.json({
      success: true,
      state: body,
      timestamp: new Date().toISOString(),
    });
  }),

  // Generic endpoint
  http.get(API_HEADER, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      features: ['search', 'notifications', 'theme', 'user-menu'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const siteHeaderStatusHandlers = {
  // Success
  success: siteHeaderHandlers,

  // 4xx Client Errors
  badRequest: [
    http.put(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.siteHeader.invalidHeaderConfiguration', 'Invalid header configuration'),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.put(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.siteHeader.authenticationRequiredToModifyHeader',
            'Authentication required to modify header'
          ),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.put(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'HEADER_LOCKED',
          i18n.t(
            'handler.siteHeader.headerConfigurationIsLocked',
            'Header configuration is locked'
          ),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.siteHeader.headerConfigurationNotFound',
            'Header configuration not found'
          ),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.put(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFIG_CONFLICT',
          i18n.t('handler.siteHeader.headerConfigurationConflict', 'Header configuration conflict'),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.put(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_OPTIONS',
          i18n.t('handler.siteHeader.invalidHeaderOptions', 'Invalid header options'),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.put(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.siteHeader.tooManyHeaderUpdatesPlease',
            'Too many header updates. Please wait.'
          ),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.siteHeader.failedToLoadHeaderConfiguration',
            'Failed to load header configuration'
          ),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.siteHeader.headerServiceUnavailable', 'Header service unavailable'),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.siteHeader.headerServiceTemporarilyUnavailable',
            'Header service temporarily unavailable'
          ),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.siteHeader.headerServiceTimeout', 'Header service timeout'),
          API_HEADER_CONFIG
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(3000);
      return HttpResponse.json({
        showSearch: true,
        showNotifications: true,
        showThemeSwitch: true,
        showUserMenu: true,
        sticky: true,
        transparent: false,
      });
    }),
  ],

  networkError: [http.get(API_HEADER_CONFIG, () => HttpResponse.error())],

  emptyData: [
    http.get(API_HEADER_CONFIG, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
