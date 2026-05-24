import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// NAV MAIN HANDLERS
// Enterprise-grade MSW handlers for main navigation component
// ============================================================================

// API Endpoints
const API_NAV_MAIN = '/api/nav/main';
const API_NAV_MAIN_ITEMS = '/api/nav/main/items';
const API_NAV_MAIN_STATE = '/api/nav/main/state';
const API_NAV_MAIN_BADGES = '/api/nav/main/badges';

// Types
interface NavMainItem {
  badge?: number | string;
  icon: string;
  id: string;
  isActive?: boolean;
  items?: NavMainItem[];
  title: string;
  url: string;
}

interface NavMainState {
  activeItem: null | string;
  expandedItems: string[];
  hoveredItem: null | string;
}

interface NavBadge {
  count: number;
  itemId: string;
  variant: 'default' | 'destructive' | 'warning';
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const navMainHandlers = [
  // GET nav items
  http.get(API_NAV_MAIN_ITEMS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const items: NavMainItem[] = [
      {
        id: 'dashboard',
        title: i18n.t('handler.navMain.dashboard', 'Dashboard'),
        url: '/dashboard',
        icon: 'LayoutDashboard',
        isActive: true,
      },
      {
        id: 'analytics',
        title: i18n.t('handler.navMain.analytics', 'Analytics'),
        url: '/analytics',
        icon: 'BarChart3',
        badge: i18n.t('handler.navMain.new', 'New'),
        items: [
          {
            id: 'overview',
            title: i18n.t('handler.navMain.overview', 'Overview'),
            url: '/analytics/overview',
            icon: 'Eye',
          },
          {
            id: 'reports',
            title: i18n.t('handler.navMain.reports', 'Reports'),
            url: '/analytics/reports',
            icon: 'FileText',
          },
        ],
      },
      {
        id: 'users',
        title: i18n.t('handler.navMain.users', 'Users'),
        url: '/users',
        icon: 'Users',
        badge: 12,
      },
      {
        id: 'settings',
        title: i18n.t('handler.navMain.settings', 'Settings'),
        url: '/settings',
        icon: 'Settings',
        items: [
          {
            id: 'general',
            title: i18n.t('handler.navMain.general', 'General'),
            url: '/settings/general',
            icon: 'Sliders',
          },
          {
            id: 'security',
            title: i18n.t('handler.navMain.security', 'Security'),
            url: '/settings/security',
            icon: 'Shield',
          },
        ],
      },
    ];
    return HttpResponse.json({ items });
  }),

  // GET nav state
  http.get(API_NAV_MAIN_STATE, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const state: NavMainState = {
      expandedItems: ['analytics', 'settings'],
      activeItem: 'dashboard',
      hoveredItem: null,
    };
    return HttpResponse.json(state);
  }),

  // POST update nav state
  http.post(API_NAV_MAIN_STATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as Partial<NavMainState>;
    return HttpResponse.json({
      success: true,
      state: body,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET badges
  http.get(API_NAV_MAIN_BADGES, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const badges: NavBadge[] = [
      { itemId: 'users', count: 12, variant: 'default' },
      { itemId: 'notifications', count: 5, variant: 'destructive' },
    ];
    return HttpResponse.json({ badges });
  }),

  // Generic endpoint
  http.get(API_NAV_MAIN, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      totalItems: 4,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const navMainStatusHandlers = {
  // Success
  success: navMainHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_NAV_MAIN_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_STATE',
          i18n.t('handler.navMain.invalidNavigationState', 'Invalid navigation state'),
          API_NAV_MAIN_STATE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.navMain.authenticationRequiredToViewNavigation',
            'Authentication required to view navigation'
          ),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.navMain.accessDeniedToNavigationItems',
            'Access denied to navigation items'
          ),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.navMain.navigationItemsNotFound', 'Navigation items not found'),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_NAV_MAIN_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t('handler.navMain.navigationStateConflict', 'Navigation state conflict'),
          API_NAV_MAIN_STATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_NAV_MAIN_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_ITEMS',
          i18n.t('handler.navMain.invalidNavigationItems', 'Invalid navigation items'),
          API_NAV_MAIN_STATE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_NAV_MAIN_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.navMain.tooManyNavigationUpdatesPlease',
            'Too many navigation updates. Please wait.'
          ),
          API_NAV_MAIN_STATE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.navMain.failedToLoadNavigation', 'Failed to load navigation'),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.navMain.navigationServiceUnavailable', 'Navigation service unavailable'),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.navMain.navigationServiceTemporarilyUnavailable',
            'Navigation service temporarily unavailable'
          ),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.navMain.navigationServiceTimeout', 'Navigation service timeout'),
          API_NAV_MAIN_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(3000);
      return HttpResponse.json({ items: [] });
    }),
  ],

  networkError: [http.get(API_NAV_MAIN_ITEMS, () => HttpResponse.error())],

  emptyData: [
    http.get(API_NAV_MAIN_ITEMS, async () => {
      await delay(100);
      return HttpResponse.json({ items: [] });
    }),
  ],
};
