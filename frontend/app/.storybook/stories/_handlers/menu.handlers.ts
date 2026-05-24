import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeMenuItems } from '../_factories/menu.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_MENU_ITEMS = '/api/menu-items';

// Default success handlers
export const menuHandlers = [
  // GET /api/menu-items
  http.get(API_MENU_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 6);
    const includeSubmenus = url.searchParams.get('submenus') !== 'false';

    await delay(faker.number.int({ min: 200, max: 500 }));

    // Create menu items with proper depth for submenus
    const items = createFakeMenuItems(count, includeSubmenus ? 0 : 2);

    return HttpResponse.json({
      items,
      total: items.length,
    });
  }),
];

// Status-specific handlers for stories
export const menuStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: menuHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.menu.invalidQueryParameters', 'Invalid query parameters'),
          API_MENU_ITEMS,
          {
            count: i18n.t(
              'handler.menu.mustBeAPositiveInteger',
              'Must be a positive integer between 1 and 50'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.menu.authenticationRequiredToViewMenu',
            'Authentication required to view menu'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.menu.accessDeniedToMenuItems', 'Access denied to menu items'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'MENU_NOT_FOUND',
          i18n.t(
            'handler.menu.theRequestedMenuConfigurationDoes',
            'The requested menu configuration does not exist'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.menu.requestValidationFailed', 'Request validation failed'),
          API_MENU_ITEMS,
          {
            field: 'data',
            error: i18n.t('handler.menu.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.menu.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_MENU_ITEMS,
          {
            limit: '300/hour',
            remaining: '0',
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t('handler.menu.failedToLoadMenuConfiguration', 'Failed to load menu configuration'),
          API_MENU_ITEMS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.menu.menuConfigurationServiceUnavailable',
            'Menu configuration service unavailable'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.menu.menuServiceIsUnderMaintenance', 'Menu service is under maintenance'),
          API_MENU_ITEMS,
          {
            retryAfter: '180',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.menu.menuServiceTimedOut', 'Menu service timed out'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_MENU_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(5000);
      return HttpResponse.json({
        items: createFakeMenuItems(6),
        total: 6,
      });
    }),
  ],

  networkError: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
        total: 0,
      });
    }),
  ],
};
