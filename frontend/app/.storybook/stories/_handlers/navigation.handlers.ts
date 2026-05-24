import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeBreadcrumbs } from '../_factories/breadcrumb.factory';
import { createFakeMenuItems } from '../_factories/menu.factory';
import { createFakeNavItems, createFakeNavSidebarGroups } from '../_factories/navigation.factory';
import { createFakeTabs } from '../_factories/tabs.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_NAVIGATION = '/api/navigation';
const API_BREADCRUMBS = '/api/breadcrumbs';
const API_MENU = '/api/menu';
const API_SIDEBAR = '/api/sidebar';
const API_TABS = '/api/tabs';

// Default success handlers
export const navigationHandlers = [
  // GET /api/navigation - Get navigation items
  http.get(API_NAVIGATION, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);
    const depth = Number(url.searchParams.get('depth') ?? 2);

    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      items: createFakeNavItems(count, depth),
    });
  }),

  // GET /api/breadcrumbs - Get breadcrumbs
  http.get(API_BREADCRUMBS, async ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const depth = Number(url.searchParams.get('depth') ?? 4);

    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json({
      items: createFakeBreadcrumbs(depth),
      currentPath: path ?? '/current/page',
    });
  }),

  // GET /api/menu - Get menu items
  http.get(API_MENU, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 8);
    const withSubmenus = url.searchParams.get('submenus') === 'true';
    // depth < 2 allows submenus, depth >= 2 prevents them
    const depth = withSubmenus ? 0 : 2;

    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      items: createFakeMenuItems(count, depth),
    });
  }),

  // GET /api/sidebar - Get sidebar groups
  http.get(API_SIDEBAR, async ({ request }) => {
    const url = new URL(request.url);
    const groups = Number(url.searchParams.get('groups') ?? 3);

    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      groups: createFakeNavSidebarGroups(groups),
      user: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
      },
    });
  }),

  // GET /api/tabs - Get tabs
  http.get(API_TABS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);

    await delay(faker.number.int({ min: 150, max: 350 }));
    return HttpResponse.json({
      tabs: createFakeTabs(count),
      activeTab: 0,
    });
  }),
];

// Status-specific handlers for stories
export const navigationStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: navigationHandlers,

  // ============ LOADING STATES ============
  loading: [
    http.get(API_NAVIGATION, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_BREADCRUMBS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_MENU, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SIDEBAR, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_TABS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_NAVIGATION, async () => {
      await delay(5000);
      return HttpResponse.json({
        items: createFakeNavItems(5),
      });
    }),
    http.get(API_SIDEBAR, async () => {
      await delay(5000);
      return HttpResponse.json({
        groups: createFakeNavSidebarGroups(3),
        user: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          avatar: faker.image.avatar(),
        },
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.navigation.invalidNavigationParameters', 'Invalid navigation parameters'),
          API_NAVIGATION,
          {
            depth: i18n.t(
              'handler.navigation.depthMustBeBetween0',
              'Depth must be between 0 and 5'
            ),
            count: i18n.t(
              'handler.navigation.countMustBeBetween1',
              'Count must be between 1 and 20'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PATH',
          i18n.t('handler.navigation.invalidPathFormat', 'Invalid path format'),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.navigation.authenticationRequiredToViewNavigation',
            'Authentication required to view navigation'
          ),
          API_NAVIGATION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.navigation.yourSessionHasExpired', 'Your session has expired'),
          API_SIDEBAR
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.navigation.youDoNotHavePermission',
            'You do not have permission to view this navigation'
          ),
          API_NAVIGATION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.get(API_MENU, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.navigation.adminMenuRequiresElevatedPermissions',
            'Admin menu requires elevated permissions'
          ),
          API_MENU
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_BREADCRUMBS, async ({ request }) => {
      const url = new URL(request.url);
      const path = url.searchParams.get('path') ?? '/unknown';
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PATH_NOT_FOUND',
          `Path '${path}' does not exist`,
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'TABS_NOT_FOUND',
          i18n.t('handler.navigation.tabConfigurationNotFound', 'Tab configuration not found'),
          API_TABS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.navigation.requestValidationFailed', 'Request validation failed'),
          API_NAVIGATION,
          {
            field: 'data',
            error: i18n.t('handler.navigation.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_NAVIGATION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.navigation.navigationApiRateLimitExceeded',
            'Navigation API rate limit exceeded'
          ),
          API_NAVIGATION,
          {
            limit: '1000/hour',
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
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'NAV_SERVICE_ERROR',
          i18n.t(
            'handler.navigation.failedToBuildNavigationTree',
            'Failed to build navigation tree'
          ),
          API_NAVIGATION,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SIDEBAR_ERROR',
          i18n.t(
            'handler.navigation.failedToLoadSidebarConfiguration',
            'Failed to load sidebar configuration'
          ),
          API_SIDEBAR,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.navigation.navigationServiceUnavailable',
            'Navigation service unavailable'
          ),
          API_NAVIGATION
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.navigation.navigationServiceIsUnderMaintenance',
            'Navigation service is under maintenance'
          ),
          API_NAVIGATION,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.navigation.navigationRequestTimedOut', 'Navigation request timed out'),
          API_NAVIGATION
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  networkError: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_MENU, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
      });
    }),
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
        currentPath: '/',
      });
    }),
    http.get(API_MENU, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
      });
    }),
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json({
        groups: [],
        user: null,
      });
    }),
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json({
        tabs: [],
        activeTab: -1,
      });
    }),
  ],

  // Alias for backward compatibility
  get empty() {
    return this.emptyData;
  },

  singleItem: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json({
        items: createFakeNavItems(1, 0),
      });
    }),
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json({
        items: createFakeBreadcrumbs(1),
        currentPath: '/home',
      });
    }),
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json({
        tabs: createFakeTabs(1),
        activeTab: 0,
      });
    }),
  ],

  deepNesting: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      return HttpResponse.json({
        items: createFakeNavItems(3, 5),
      });
    }),
    http.get(API_MENU, async () => {
      await delay(300);
      return HttpResponse.json({
        // depth 0 allows deep nesting with submenus
        items: createFakeMenuItems(5, 0),
      });
    }),
  ],

  longBreadcrumb: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json({
        items: createFakeBreadcrumbs(10),
        currentPath: '/very/long/path/to/current/page/in/deep/hierarchy',
        overflow: true,
      });
    }),
  ],

  manyTabs: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json({
        tabs: createFakeTabs(15),
        activeTab: 7,
        scrollable: true,
      });
    }),
  ],

  disabledItems: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      const items = createFakeNavItems(5, 1);
      items.forEach((item, index) => {
        item.disabled = index % 2 === 0;
      });
      return HttpResponse.json({ items });
    }),
    http.get(API_MENU, async () => {
      await delay(300);
      // depth 2 prevents submenus
      const items = createFakeMenuItems(8, 2);
      items.forEach((item, index) => {
        item.disabled = index % 3 === 0;
      });
      return HttpResponse.json({ items });
    }),
    http.get(API_TABS, async () => {
      await delay(300);
      const tabs = createFakeTabs(5);
      tabs.forEach((tab, index) => {
        tab.disabled = index === 2 || index === 4;
      });
      return HttpResponse.json({
        tabs,
        activeTab: 0,
      });
    }),
  ],

  withBadges: [
    http.get(API_NAVIGATION, async () => {
      await delay(300);
      const items = createFakeNavItems(5, 1);
      items.forEach((item) => {
        item.badge = faker.number.int({ min: 1, max: 99 });
      });
      return HttpResponse.json({ items });
    }),
    http.get(API_TABS, async () => {
      await delay(300);
      const tabs = createFakeTabs(5);
      tabs.forEach((tab) => {
        tab.badge = faker.number.int({ min: 1, max: 50 }).toString();
      });
      return HttpResponse.json({
        tabs,
        activeTab: 0,
      });
    }),
  ],

  collapsedSidebar: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      const groups = createFakeNavSidebarGroups(4);
      groups.forEach((group, index) => {
        group.defaultOpen = index === 0;
        group.collapsible = true;
      });
      return HttpResponse.json({
        groups,
        collapsed: true,
        user: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          avatar: faker.image.avatar(),
        },
      });
    }),
  ],
};
