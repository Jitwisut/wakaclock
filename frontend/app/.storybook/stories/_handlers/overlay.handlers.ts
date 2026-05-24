import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeCollapsible,
  createFakeContextMenu,
  createFakeDrawer,
  createFakeDropdownMenu,
  createFakeHoverCard,
  createFakePopover,
  createFakeSheet,
} from '../_factories/overlay.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_DRAWERS = '/api/drawers';
const API_SHEETS = '/api/sheets';
const API_POPOVERS = '/api/popovers';
const API_HOVER_CARDS = '/api/hover-cards';
const API_CONTEXT_MENUS = '/api/context-menus';
const API_DROPDOWN_MENUS = '/api/dropdown-menus';
const API_COLLAPSIBLES = '/api/collapsibles';

// Default success handlers
export const overlayHandlers = [
  // GET /api/drawers - Fetch drawer configuration
  http.get(API_DRAWERS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const drawer = createFakeDrawer();
    return HttpResponse.json({ drawer });
  }),

  // GET /api/sheets - Fetch sheet configuration
  http.get(API_SHEETS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const sheet = createFakeSheet();
    return HttpResponse.json({ sheet });
  }),

  // GET /api/popovers - Fetch popover content
  http.get(API_POPOVERS, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));

    const popover = createFakePopover();
    return HttpResponse.json({ popover });
  }),

  // GET /api/hover-cards - Fetch hover card data
  http.get(API_HOVER_CARDS, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));

    const hoverCard = createFakeHoverCard();
    return HttpResponse.json({ hoverCard });
  }),

  // GET /api/context-menus - Fetch context menu items
  http.get(API_CONTEXT_MENUS, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));

    const contextMenu = createFakeContextMenu();
    return HttpResponse.json({ contextMenu });
  }),

  // GET /api/dropdown-menus - Fetch dropdown menu items
  http.get(API_DROPDOWN_MENUS, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));

    const dropdownMenu = createFakeDropdownMenu();
    return HttpResponse.json({ dropdownMenu });
  }),

  // GET /api/collapsibles - Fetch collapsible content
  http.get(API_COLLAPSIBLES, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 3);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const collapsibles = Array.from({ length: count }, () => createFakeCollapsible());
    return HttpResponse.json({ collapsibles, total: collapsibles.length });
  }),

  // POST /api/drawers/toggle - Toggle drawer state
  http.post(`${API_DRAWERS}/toggle`, async ({ request }) => {
    const body = (await request.json()) as { open: boolean };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      drawer: createFakeDrawer({ open: body.open }),
    });
  }),

  // POST /api/sheets/toggle - Toggle sheet state
  http.post(`${API_SHEETS}/toggle`, async ({ request }) => {
    const body = (await request.json()) as { open: boolean };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      sheet: createFakeSheet({ open: body.open }),
    });
  }),
];

// Status-specific handlers for stories
export const overlayStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: overlayHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.overlay.invalidOverlayConfiguration', 'Invalid overlay configuration'),
          API_DRAWERS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.overlay.authenticationRequired', 'Authentication required'),
          API_DRAWERS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(`${API_DRAWERS}/toggle`, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.overlay.cannotModifyOverlayState', 'Cannot modify overlay state'),
          API_DRAWERS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.overlay.overlayConfigurationNotFound', 'Overlay configuration not found'),
          API_DRAWERS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.overlay.requestValidationFailed', 'Request validation failed'),
          API_DRAWERS,
          {
            field: 'data',
            error: i18n.t('handler.overlay.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_DRAWERS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.overlay.tooManyRequests', 'Too many requests'),
          API_DRAWERS,
          {
            limit: '60/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.overlay.failedToLoadOverlay', 'Failed to load overlay'),
          API_DRAWERS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.overlay.overlayServiceUnavailable', 'Overlay service unavailable'),
          API_DRAWERS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.overlay.serviceUnderMaintenance', 'Service under maintenance'),
          API_DRAWERS,
          {
            retryAfter: '180',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.overlay.requestTimedOut', 'Request timed out'),
          API_DRAWERS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_DRAWERS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_DRAWERS, async () => {
      await delay(5000);
      return HttpResponse.json({ drawer: createFakeDrawer() });
    }),
  ],

  networkError: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyContent: [
    http.get(API_COLLAPSIBLES, async () => {
      await delay(300);
      return HttpResponse.json({ collapsibles: [], total: 0 });
    }),
  ],

  openDrawer: [
    http.get(API_DRAWERS, async () => {
      await delay(300);
      return HttpResponse.json({ drawer: createFakeDrawer({ open: true }) });
    }),
  ],

  openSheet: [
    http.get(API_SHEETS, async () => {
      await delay(300);
      return HttpResponse.json({ sheet: createFakeSheet({ open: true }) });
    }),
  ],
};
