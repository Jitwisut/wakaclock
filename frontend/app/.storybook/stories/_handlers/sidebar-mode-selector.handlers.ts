import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// SIDEBAR MODE SELECTOR HANDLERS
// Enterprise-grade MSW handlers for sidebar mode selector component
// ============================================================================

// API Endpoints
const API_SIDEBAR_MODE = '/api/sidebar-mode';
const API_SIDEBAR_MODE_CURRENT = '/api/sidebar-mode/current';
const API_SIDEBAR_MODE_SET = '/api/sidebar-mode/set';
const API_SIDEBAR_MODE_OPTIONS = '/api/sidebar-mode/options';
const API_SIDEBAR_MODE_PREVIEW = '/api/sidebar-mode/preview';

// Types
type SidebarMode = 'collapsed' | 'expanded' | 'floating' | 'hidden';

interface SidebarModeOption {
  description: string;
  icon: string;
  label: string;
  value: SidebarMode;
}

interface SidebarModeResponse {
  behavior: 'fixed' | 'responsive';
  mode: SidebarMode;
  timestamp: string;
  width: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const sidebarModeSelectorHandlers = [
  // GET current sidebar mode
  http.get(API_SIDEBAR_MODE_CURRENT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const modes: SidebarMode[] = ['expanded', 'collapsed', 'floating', 'hidden'];
    const mode = faker.helpers.arrayElement(modes);
    const widths: Record<SidebarMode, string> = {
      expanded: '280px',
      collapsed: '64px',
      floating: '280px',
      hidden: '0px',
    };
    const response: SidebarModeResponse = {
      mode,
      width: widths[mode],
      behavior: mode === 'floating' ? 'responsive' : 'fixed',
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // POST set sidebar mode
  http.post(API_SIDEBAR_MODE_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { mode: SidebarMode };
    const widths: Record<SidebarMode, string> = {
      expanded: '280px',
      collapsed: '64px',
      floating: '280px',
      hidden: '0px',
    };
    const response: SidebarModeResponse = {
      mode: body.mode,
      width: widths[body.mode],
      behavior: body.mode === 'floating' ? 'responsive' : 'fixed',
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // GET sidebar mode options
  http.get(API_SIDEBAR_MODE_OPTIONS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const options: SidebarModeOption[] = [
      {
        value: 'expanded',
        label: i18n.t('handler.sidebarModeSelector.expanded', 'Expanded'),
        description: i18n.t(
          'handler.sidebarModeSelector.fullSidebarWithLabels',
          'Full sidebar with labels'
        ),
        icon: 'sidebar',
      },
      {
        value: 'collapsed',
        label: i18n.t('handler.sidebarModeSelector.collapsed', 'Collapsed'),
        description: i18n.t('handler.sidebarModeSelector.iconsOnly', 'Icons only'),
        icon: 'sidebar-collapse',
      },
      {
        value: 'floating',
        label: i18n.t('handler.sidebarModeSelector.floating', 'Floating'),
        description: i18n.t('handler.sidebarModeSelector.overlayOnHover', 'Overlay on hover'),
        icon: 'sidebar-float',
      },
      {
        value: 'hidden',
        label: i18n.t('handler.sidebarModeSelector.hidden', 'Hidden'),
        description: i18n.t('handler.sidebarModeSelector.noSidebar', 'No sidebar'),
        icon: 'sidebar-hidden',
      },
    ];
    return HttpResponse.json({ options });
  }),

  // POST preview sidebar mode
  http.post(API_SIDEBAR_MODE_PREVIEW, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { mode: SidebarMode };
    return HttpResponse.json({
      success: true,
      preview: {
        mode: body.mode,
        contentShift: body.mode === 'expanded' || body.mode === 'collapsed',
        overlayRequired: body.mode === 'floating',
      },
    });
  }),

  // Generic endpoint
  http.get(API_SIDEBAR_MODE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      availableModes: ['expanded', 'collapsed', 'floating', 'hidden'],
      currentMode: faker.helpers.arrayElement(['expanded', 'collapsed', 'floating', 'hidden']),
      defaultMode: 'expanded',
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const sidebarModeSelectorStatusHandlers = {
  // Success
  success: sidebarModeSelectorHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_SIDEBAR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MODE',
          i18n.t('handler.sidebarModeSelector.invalidSidebarMode', 'Invalid sidebar mode'),
          API_SIDEBAR_MODE_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_SIDEBAR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.sidebarModeSelector.authenticationRequiredToChangeSidebar',
            'Authentication required to change sidebar mode'
          ),
          API_SIDEBAR_MODE_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SIDEBAR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SIDEBAR_DISABLED',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeChangesAreDisabled',
            'Sidebar mode changes are disabled'
          ),
          API_SIDEBAR_MODE_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeConfigurationNotFound',
            'Sidebar mode configuration not found'
          ),
          API_SIDEBAR_MODE_CURRENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SIDEBAR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'LAYOUT_CONFLICT',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeConflictsWithCurrent',
            'Sidebar mode conflicts with current layout'
          ),
          API_SIDEBAR_MODE_SET
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SIDEBAR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VIEWPORT_INCOMPATIBLE',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeNotCompatibleWith',
            'Sidebar mode not compatible with viewport'
          ),
          API_SIDEBAR_MODE_SET
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SIDEBAR_MODE_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.sidebarModeSelector.tooManySidebarModeChanges',
            'Too many sidebar mode changes. Please wait.'
          ),
          API_SIDEBAR_MODE_SET
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.sidebarModeSelector.failedToRetrieveSidebarMode',
            'Failed to retrieve sidebar mode'
          ),
          API_SIDEBAR_MODE_CURRENT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeServiceUnavailable',
            'Sidebar mode service unavailable'
          ),
          API_SIDEBAR_MODE_CURRENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeServiceTemporarilyUnavailable',
            'Sidebar mode service temporarily unavailable'
          ),
          API_SIDEBAR_MODE_CURRENT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t(
            'handler.sidebarModeSelector.sidebarModeServiceTimeout',
            'Sidebar mode service timeout'
          ),
          API_SIDEBAR_MODE_CURRENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(3000);
      return HttpResponse.json({
        mode: 'expanded',
        width: '280px',
        behavior: 'fixed',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.get(API_SIDEBAR_MODE_CURRENT, () => HttpResponse.error())],

  emptyData: [
    http.get(API_SIDEBAR_MODE_CURRENT, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
