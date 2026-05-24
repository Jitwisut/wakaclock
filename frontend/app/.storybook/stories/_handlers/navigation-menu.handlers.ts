import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeMenuItems } from '../_factories/menu.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_NAV_MENU_ITEMS = '/api/navigation-menu/items';
const API_NAV_MENU_CONFIG = '/api/navigation-menu/config';
const API_MENU_ITEMS = '/api/menu-items';

// Default success handlers
export const navigationMenuHandlers = [
  // GET /api/navigation-menu/items - Get navigation menu items
  http.get(API_NAV_MENU_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 4);
    const includeSubmenus = url.searchParams.get('submenus') !== 'false';

    await delay(faker.number.int({ min: 150, max: 400 }));

    const items = createFakeMenuItems(count, includeSubmenus ? 0 : 2);

    return HttpResponse.json({
      items,
      total: items.length,
      type: 'navigation-menu',
    });
  }),

  // GET /api/navigation-menu/config - Get navigation menu configuration
  http.get(API_NAV_MENU_CONFIG, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      orientation: 'horizontal',
      delayDuration: 200,
      skipDelayDuration: 300,
      showIndicator: true,
      direction: 'ltr',
    });
  }),

  // Backward compatibility with generic menu endpoint
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
export const navigationMenuStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: navigationMenuHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.navigationMenu.invalidNavigationMenuQueryParameters',
            'Invalid navigation menu query parameters'
          ),
          API_NAV_MENU_ITEMS,
          {
            count: i18n.t(
              'handler.navigationMenu.mustBeAPositiveIntegerBetween1And20',
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
          i18n.t('handler.navigationMenu.invalidQueryParameters', 'Invalid query parameters'),
          API_MENU_ITEMS,
          {
            count: i18n.t(
              'handler.navigationMenu.mustBeAPositiveIntegerBetween1And50',
              'Must be a positive integer between 1 and 50'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.navigationMenu.authenticationRequiredToViewNavigation',
            'Authentication required to view navigation menu'
          ),
          API_NAV_MENU_ITEMS
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
            'handler.navigationMenu.authenticationRequiredToViewMenu',
            'Authentication required to view menu'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.navigationMenu.accessDeniedToNavigationMenu',
            'Access denied to navigation menu items'
          ),
          API_NAV_MENU_ITEMS
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
          i18n.t('handler.navigationMenu.accessDeniedToMenuItems', 'Access denied to menu items'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NAV_MENU_NOT_FOUND',
          i18n.t(
            'handler.navigationMenu.theRequestedNavigationMenuConfiguration',
            'The requested navigation menu configuration does not exist'
          ),
          API_NAV_MENU_ITEMS
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
            'handler.navigationMenu.theRequestedMenuConfigurationDoes',
            'The requested menu configuration does not exist'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.navigationMenu.navigationMenuConfigurationValidationFailed',
            'Navigation menu configuration validation failed'
          ),
          API_NAV_MENU_ITEMS,
          {
            orientation: i18n.t(
              'handler.navigationMenu.invalidOrientationValue',
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
            'handler.navigationMenu.menuConfigurationValidationFailed',
            'Menu configuration validation failed'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.navigationMenu.apiRateLimitExceededFor',
            'API rate limit exceeded for navigation menu'
          ),
          API_NAV_MENU_ITEMS,
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
          i18n.t('handler.navigationMenu.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_MENU_ITEMS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'NAV_MENU_CONFLICT',
          i18n.t(
            'handler.navigationMenu.navigationMenuConfigurationConflictDetected',
            'Navigation menu configuration conflict detected'
          ),
          API_NAV_MENU_ITEMS,
          {
            reason: i18n.t(
              'handler.navigationMenu.anotherUserIsEditingTheNavigationMenuConfiguration',
              'Another user is editing the navigation menu configuration'
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
            'handler.navigationMenu.menuConfigurationConflictDetected',
            'Menu configuration conflict detected'
          ),
          API_MENU_ITEMS,
          {
            reason: i18n.t(
              'handler.navigationMenu.anotherUserIsEditingTheMenuConfiguration',
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
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t(
            'handler.navigationMenu.failedToLoadNavigationMenu',
            'Failed to load navigation menu configuration'
          ),
          API_NAV_MENU_ITEMS,
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
            'handler.navigationMenu.failedToLoadMenuConfiguration',
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
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.navigationMenu.navigationMenuServiceUnavailable',
            'Navigation menu service unavailable'
          ),
          API_NAV_MENU_ITEMS
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
            'handler.navigationMenu.menuConfigurationServiceUnavailable',
            'Menu configuration service unavailable'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.navigationMenu.navigationMenuServiceIsUnder',
            'Navigation menu service is under maintenance'
          ),
          API_NAV_MENU_ITEMS,
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
            'handler.navigationMenu.menuServiceIsUnderMaintenance',
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
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.navigationMenu.navigationMenuServiceTimedOut',
            'Navigation menu service timed out'
          ),
          API_NAV_MENU_ITEMS
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
          i18n.t('handler.navigationMenu.menuServiceTimedOut', 'Menu service timed out'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(4000);
      return HttpResponse.json({
        items: createFakeMenuItems(4),
        total: 4,
        type: 'navigation-menu',
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
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_NAV_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
        type: 'navigation-menu',
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
