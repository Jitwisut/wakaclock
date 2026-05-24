import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeMenuItems } from '../_factories/menu.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_MENUBAR_ITEMS = '/api/menubar/items';
const API_MENUBAR_CONFIG = '/api/menubar/config';
const API_MENU_ITEMS = '/api/menu-items';

// Default success handlers
export const menubarHandlers = [
  // GET /api/menubar/items - Get menubar menu items
  http.get(API_MENUBAR_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 4);
    const includeSubmenus = url.searchParams.get('submenus') !== 'false';

    await delay(faker.number.int({ min: 150, max: 400 }));

    const items = createFakeMenuItems(count, includeSubmenus ? 0 : 2);

    return HttpResponse.json({
      items,
      total: items.length,
      type: 'menubar',
    });
  }),

  // GET /api/menubar/config - Get menubar configuration
  http.get(API_MENUBAR_CONFIG, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      showShortcuts: true,
      showIcons: true,
      direction: 'ltr',
      loop: true,
      orientation: 'horizontal',
    });
  }),

  // Backward compatibility with menu endpoint
  http.get(API_MENU_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 6);
    const includeSubmenus = url.searchParams.get('submenus') !== 'false';

    await delay(faker.number.int({ min: 200, max: 500 }));

    const items = createFakeMenuItems(count, includeSubmenus ? 0 : 2);

    return HttpResponse.json({
      items,
      total: items.length,
    });
  }),
];

// Status-specific handlers for stories
export const menubarStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: menubarHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.menubar.invalidMenubarQueryParameters',
            'Invalid menubar query parameters'
          ),
          API_MENUBAR_ITEMS,
          {
            count: i18n.t(
              'handler.menubar.mustBeAPositiveIntegerBetween1And20',
              'Must be a positive integer between 1 and 20'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.menubar.invalidQueryParameters', 'Invalid query parameters'),
          API_MENU_ITEMS,
          {
            count: i18n.t(
              'handler.menubar.mustBeAPositiveIntegerBetween1And50',
              'Must be a positive integer between 1 and 50'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.menubar.authenticationRequiredToViewMenubar',
            'Authentication required to view menubar'
          ),
          API_MENUBAR_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.menubar.authenticationRequiredToViewMenu',
            'Authentication required to view menu'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.menubar.accessDeniedToMenubarItems', 'Access denied to menubar items'),
          API_MENUBAR_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.menubar.accessDeniedToMenuItems', 'Access denied to menu items'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'MENUBAR_NOT_FOUND',
          i18n.t(
            'handler.menubar.theRequestedMenubarConfigurationDoes',
            'The requested menubar configuration does not exist'
          ),
          API_MENUBAR_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'MENU_NOT_FOUND',
          i18n.t(
            'handler.menubar.theRequestedMenuConfigurationDoes',
            'The requested menu configuration does not exist'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.menubar.menubarConfigurationValidationFailed',
            'Menubar configuration validation failed'
          ),
          API_MENUBAR_ITEMS,
          {
            orientation: i18n.t(
              'handler.menubar.invalidOrientationValue',
              'Invalid orientation value'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.menubar.menuConfigurationValidationFailed',
            'Menu configuration validation failed'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.menubar.apiRateLimitExceededFor', 'API rate limit exceeded for menubar'),
          API_MENUBAR_ITEMS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.menubar.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_MENU_ITEMS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'MENUBAR_CONFLICT',
          i18n.t(
            'handler.menubar.menubarConfigurationConflictDetected',
            'Menubar configuration conflict detected'
          ),
          API_MENUBAR_ITEMS,
          {
            reason: i18n.t(
              'handler.menubar.anotherUserIsEditingTheMenubarConfiguration',
              'Another user is editing the menubar configuration'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'MENU_CONFLICT',
          i18n.t(
            'handler.menubar.menuConfigurationConflictDetected',
            'Menu configuration conflict detected'
          ),
          API_MENU_ITEMS,
          {
            reason: i18n.t(
              'handler.menubar.anotherUserIsEditingTheMenuConfiguration',
              'Another user is editing the menu configuration'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t(
            'handler.menubar.failedToLoadMenubarConfiguration',
            'Failed to load menubar configuration'
          ),
          API_MENUBAR_ITEMS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t(
            'handler.menubar.failedToLoadMenuConfiguration',
            'Failed to load menu configuration'
          ),
          API_MENU_ITEMS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.menubar.menubarConfigurationServiceUnavailable',
            'Menubar configuration service unavailable'
          ),
          API_MENUBAR_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.menubar.menuConfigurationServiceUnavailable',
            'Menu configuration service unavailable'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.menubar.menubarServiceIsUnderMaintenance',
            'Menubar service is under maintenance'
          ),
          API_MENUBAR_ITEMS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.menubar.menuServiceIsUnderMaintenance',
            'Menu service is under maintenance'
          ),
          API_MENU_ITEMS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.menubar.menubarServiceTimedOut', 'Menubar service timed out'),
          API_MENUBAR_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.menubar.menuServiceTimedOut', 'Menu service timed out'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(4000);
      return HttpResponse.json({
        items: createFakeMenuItems(4),
        total: 4,
        type: 'menubar',
      });
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(4000);
      return HttpResponse.json({
        items: createFakeMenuItems(6),
        total: 6,
      });
    }),
  ],

  networkError: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_MENUBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
        type: 'menubar',
      });
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
      });
    }),
  ],
};
