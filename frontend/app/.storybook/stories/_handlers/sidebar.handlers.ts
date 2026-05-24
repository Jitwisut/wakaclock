import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SIDEBAR_CONFIG = '/api/sidebar/config';
const API_SIDEBAR_ITEMS = '/api/sidebar/items';
const API_SIDEBAR_STATE = '/api/sidebar/state';
const API_SIDEBAR_FAVORITES = '/api/sidebar/favorites';

// Helper to create fake sidebar items
function createFakeSidebarItem(depth = 0): Record<string, unknown> {
  const hasChildren = depth < 2 && faker.datatype.boolean({ probability: 0.3 });
  return {
    id: faker.string.uuid(),
    label: faker.lorem.words({ min: 1, max: 3 }),
    icon: faker.helpers.arrayElement([
      i18n.t('handler.sidebar.home', 'Home'),
      i18n.t('handler.sidebar.settings', 'Settings'),
      i18n.t('handler.sidebar.user', 'User'),
      i18n.t('handler.sidebar.file', 'File'),
      i18n.t('handler.sidebar.folder', 'Folder'),
      i18n.t('handler.sidebar.mail', 'Mail'),
      i18n.t('handler.sidebar.calendar', 'Calendar'),
    ]),
    href: faker.helpers.maybe(() => `/${faker.lorem.slug()}`, { probability: 0.7 }),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.2 }),
    isActive: faker.datatype.boolean({ probability: 0.1 }),
    isDisabled: faker.datatype.boolean({ probability: 0.05 }),
    children: hasChildren
      ? Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
          createFakeSidebarItem(depth + 1)
        )
      : undefined,
  };
}

// Default success handlers
export const sidebarHandlers = [
  // GET /api/sidebar/config - Get sidebar configuration
  http.get(API_SIDEBAR_CONFIG, async ({ request }) => {
    const url = new URL(request.url);
    const variant = url.searchParams.get('variant') ?? 'default';

    await delay(faker.number.int({ min: 150, max: 400 }));

    return HttpResponse.json({
      variant,
      side: faker.helpers.arrayElement(['left', 'right']),
      collapsible: faker.helpers.arrayElement(['offcanvas', 'icon', 'none']),
      defaultOpen: faker.datatype.boolean({ probability: 0.7 }),
      width: faker.helpers.arrayElement(['sm', 'default', 'lg']),
      showFooter: faker.datatype.boolean({ probability: 0.6 }),
      showHeader: faker.datatype.boolean({ probability: 0.8 }),
    });
  }),

  // GET /api/sidebar/items - Get sidebar navigation items
  http.get(API_SIDEBAR_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const section = url.searchParams.get('section') ?? 'main';

    await delay(faker.number.int({ min: 200, max: 500 }));

    const items = Array.from({ length: faker.number.int({ min: 5, max: 12 }) }, () =>
      createFakeSidebarItem()
    );

    return HttpResponse.json({
      section,
      items,
      total: items.length,
    });
  }),

  // POST /api/sidebar/state - Save sidebar state
  http.post(API_SIDEBAR_STATE, async ({ request }) => {
    const body = (await request.json()) as { isCollapsed: boolean; isOpen: boolean };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      state: {
        isOpen: body.isOpen,
        isCollapsed: body.isCollapsed,
        savedAt: new Date().toISOString(),
      },
    });
  }),

  // GET /api/sidebar/favorites - Get user's favorite items
  http.get(API_SIDEBAR_FAVORITES, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    const favorites = Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () => ({
      id: faker.string.uuid(),
      label: faker.lorem.words({ min: 1, max: 3 }),
      icon: faker.helpers.arrayElement([
        i18n.t('handler.sidebar.star', 'Star'),
        i18n.t('handler.sidebar.heart', 'Heart'),
        i18n.t('handler.sidebar.bookmark', 'Bookmark'),
      ]),
      href: `/${faker.lorem.slug()}`,
    }));

    return HttpResponse.json({
      favorites,
      total: favorites.length,
    });
  }),

  // POST /api/sidebar/favorites - Add/remove favorite
  http.post(API_SIDEBAR_FAVORITES, async ({ request }) => {
    const body = (await request.json()) as { action: 'add' | 'remove'; itemId: string };
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      success: true,
      itemId: body.itemId,
      action: body.action,
      timestamp: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const sidebarStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: sidebarHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.sidebar.invalidSidebarParameters', 'Invalid sidebar parameters'),
          API_SIDEBAR_ITEMS,
          {
            section: i18n.t(
              'handler.sidebar.invalidSectionIdentifier',
              'Invalid section identifier'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.sidebar.authenticationRequiredToLoadSidebar',
            'Authentication required to load sidebar'
          ),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_SIDEBAR_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.sidebar.authenticationRequiredToSaveSidebar',
            'Authentication required to save sidebar state'
          ),
          API_SIDEBAR_STATE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.sidebar.accessDeniedToSidebarItems', 'Access denied to sidebar items'),
          API_SIDEBAR_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONFIG_NOT_FOUND',
          i18n.t('handler.sidebar.sidebarConfigurationNotFound', 'Sidebar configuration not found'),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SIDEBAR_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t(
            'handler.sidebar.sidebarStateWasUpdatedFrom',
            'Sidebar state was updated from another session'
          ),
          API_SIDEBAR_STATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SIDEBAR_FAVORITES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.sidebar.invalidFavoriteItemData', 'Invalid favorite item data'),
          API_SIDEBAR_FAVORITES,
          { itemId: i18n.t('handler.sidebar.itemIdIsRequired', 'Item ID is required') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SIDEBAR_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.sidebar.tooManySidebarStateUpdates',
            'Too many sidebar state updates. Please wait.'
          ),
          API_SIDEBAR_STATE,
          { retryAfter: '5' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t(
            'handler.sidebar.failedToLoadSidebarConfiguration',
            'Failed to load sidebar configuration'
          ),
          API_SIDEBAR_CONFIG,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.sidebar.failedToLoadSidebarItems', 'Failed to load sidebar items'),
          API_SIDEBAR_ITEMS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.sidebar.sidebarServiceTemporarilyUnavailable',
            'Sidebar service temporarily unavailable'
          ),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.sidebar.sidebarServiceIsUnderMaintenance',
            'Sidebar service is under maintenance'
          ),
          API_SIDEBAR_CONFIG,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.sidebar.sidebarItemsRequestTimedOut', 'Sidebar items request timed out'),
          API_SIDEBAR_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(4000);
      return HttpResponse.json({
        section: 'main',
        items: Array.from({ length: 5 }, () => createFakeSidebarItem()),
        total: 5,
      });
    }),
  ],

  networkError: [
    http.get(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SIDEBAR_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json({
        section: 'main',
        items: [],
        total: 0,
      });
    }),
    http.get(API_SIDEBAR_FAVORITES, async () => {
      await delay(200);
      return HttpResponse.json({
        favorites: [],
        total: 0,
      });
    }),
  ],
};
