import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APP SIDEBAR HANDLERS
// Enterprise-grade MSW handlers for app sidebar component
// ============================================================================

// API Endpoints
const API_SIDEBAR = '/api/sidebar';
const API_SIDEBAR_CONFIG = '/api/sidebar/config';
const API_SIDEBAR_STATE = '/api/sidebar/state';
const API_SIDEBAR_NAV = '/api/sidebar/navigation';
const API_SIDEBAR_PROJECTS = '/api/sidebar/projects';

// Types
interface SidebarConfig {
  collapsible: 'icon' | 'none' | 'offcanvas';
  defaultOpen: boolean;
  side: 'left' | 'right';
  variant: 'floating' | 'inset' | 'sidebar';
}

interface SidebarState {
  activeItem: null | string;
  expandedGroups: string[];
  isMobile: boolean;
  isOpen: boolean;
}

interface NavItem {
  badge?: string;
  icon: string;
  id: string;
  items?: NavItem[];
  title: string;
  url: string;
}

interface Project {
  icon: string;
  id: string;
  name: string;
  status: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appSidebarHandlers = [
  // GET sidebar config
  http.get(API_SIDEBAR_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const config: SidebarConfig = {
      defaultOpen: true,
      collapsible: 'icon',
      side: 'left',
      variant: 'sidebar',
    };
    return HttpResponse.json(config);
  }),

  // PUT update sidebar config
  http.put(API_SIDEBAR_CONFIG, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<SidebarConfig>;
    return HttpResponse.json({
      success: true,
      config: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET sidebar state
  http.get(API_SIDEBAR_STATE, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const state: SidebarState = {
      isOpen: true,
      isMobile: false,
      activeItem: 'dashboard',
      expandedGroups: ['main', 'settings'],
    };
    return HttpResponse.json(state);
  }),

  // POST update sidebar state
  http.post(API_SIDEBAR_STATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as Partial<SidebarState>;
    return HttpResponse.json({
      success: true,
      state: body,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET navigation items
  http.get(API_SIDEBAR_NAV, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const navItems: NavItem[] = [
      {
        id: 'dashboard',
        title: i18n.t('handler.appSidebar.dashboard', 'Dashboard'),
        url: '/dashboard',
        icon: 'LayoutDashboard',
      },
      {
        id: 'analytics',
        title: i18n.t('handler.appSidebar.analytics', 'Analytics'),
        url: '/analytics',
        icon: 'BarChart3',
        badge: i18n.t('handler.appSidebar.new', 'New'),
      },
      {
        id: 'users',
        title: i18n.t('handler.appSidebar.users', 'Users'),
        url: '/users',
        icon: 'Users',
      },
      {
        id: 'settings',
        title: i18n.t('handler.appSidebar.settings', 'Settings'),
        url: '/settings',
        icon: 'Settings',
      },
    ];
    return HttpResponse.json({ items: navItems });
  }),

  // GET projects
  http.get(API_SIDEBAR_PROJECTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const projects: Project[] = [
      {
        id: '1',
        name: i18n.t('handler.appSidebar.ecommercePlatform', 'E-commerce Platform'),
        status: i18n.t('handler.appSidebar.active', 'Active'),
        icon: 'ShoppingCart',
      },
      {
        id: '2',
        name: i18n.t('handler.appSidebar.blogSystem', 'Blog System'),
        status: i18n.t('handler.appSidebar.inProgress', 'In Progress'),
        icon: 'FileText',
      },
      {
        id: '3',
        name: i18n.t('handler.appSidebar.analyticsDashboard', 'Analytics Dashboard'),
        status: i18n.t('handler.appSidebar.planning', 'Planning'),
        icon: 'PieChart',
      },
    ];
    return HttpResponse.json({ projects });
  }),

  // Generic endpoint
  http.get(API_SIDEBAR, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      features: ['navigation', 'projects', 'user-menu', 'collapsible'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const appSidebarStatusHandlers = {
  // Success
  success: appSidebarHandlers,

  // 4xx Client Errors
  badRequest: [
    http.put(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.appSidebar.invalidSidebarConfiguration', 'Invalid sidebar configuration'),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.put(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.appSidebar.authenticationRequiredToModifySidebar',
            'Authentication required to modify sidebar'
          ),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.put(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SIDEBAR_LOCKED',
          i18n.t(
            'handler.appSidebar.sidebarConfigurationIsLocked',
            'Sidebar configuration is locked'
          ),
          API_SIDEBAR_CONFIG
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
          'NOT_FOUND',
          i18n.t(
            'handler.appSidebar.sidebarConfigurationNotFound',
            'Sidebar configuration not found'
          ),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.put(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t('handler.appSidebar.sidebarStateConflict', 'Sidebar state conflict'),
          API_SIDEBAR_CONFIG
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.put(API_SIDEBAR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_VARIANT',
          i18n.t('handler.appSidebar.invalidSidebarVariant', 'Invalid sidebar variant'),
          API_SIDEBAR_CONFIG
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
          'RATE_LIMIT',
          i18n.t(
            'handler.appSidebar.tooManySidebarUpdatesPlease',
            'Too many sidebar updates. Please wait.'
          ),
          API_SIDEBAR_STATE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appSidebar.failedToLoadNavigation', 'Failed to load navigation'),
          API_SIDEBAR_NAV
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.appSidebar.sidebarServiceUnavailable', 'Sidebar service unavailable'),
          API_SIDEBAR_NAV
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.appSidebar.sidebarServiceTemporarilyUnavailable',
            'Sidebar service temporarily unavailable'
          ),
          API_SIDEBAR_NAV
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.appSidebar.sidebarServiceTimeout', 'Sidebar service timeout'),
          API_SIDEBAR_NAV
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay(3000);
      return HttpResponse.json({ items: [] });
    }),
  ],

  networkError: [http.get(API_SIDEBAR_NAV, () => HttpResponse.error())],

  emptyData: [
    http.get(API_SIDEBAR_NAV, async () => {
      await delay(100);
      return HttpResponse.json({ items: [] });
    }),
  ],

  emptyProjects: [
    http.get(API_SIDEBAR_PROJECTS, async () => {
      await delay(100);
      return HttpResponse.json({ projects: [] });
    }),
  ],
};
