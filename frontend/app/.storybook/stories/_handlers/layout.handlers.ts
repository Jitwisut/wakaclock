import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeEmpty,
  createFakeResizablePanel,
  createFakeScrollArea,
  createFakeSeparator,
  createFakeSidebar,
} from '../_factories/layout.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SIDEBAR = '/api/layout/sidebar';
const API_PANELS = '/api/layout/panels';
const API_SCROLL_CONTENT = '/api/layout/scroll-content';
const API_LAYOUT_CONFIG = '/api/layout/config';

// Default success handlers
export const layoutHandlers = [
  // GET /api/layout/sidebar - Fetch sidebar configuration
  http.get(API_SIDEBAR, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const sidebar = createFakeSidebar();
    return HttpResponse.json({ sidebar });
  }),

  // GET /api/layout/panels - Fetch resizable panel configuration
  http.get(API_PANELS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 3);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const panels = Array.from({ length: count }, () => createFakeResizablePanel());
    return HttpResponse.json({ panels, total: panels.length });
  }),

  // GET /api/layout/scroll-content - Fetch scrollable content
  http.get(API_SCROLL_CONTENT, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const scrollArea = createFakeScrollArea();
    return HttpResponse.json({ scrollArea });
  }),

  // GET /api/layout/config - Fetch full layout configuration
  http.get(API_LAYOUT_CONFIG, async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      sidebar: createFakeSidebar(),
      panels: Array.from({ length: 3 }, () => createFakeResizablePanel()),
      separators: Array.from({ length: 2 }, () => createFakeSeparator()),
      emptyState: createFakeEmpty(),
    });
  }),

  // PATCH /api/layout/sidebar - Update sidebar state
  http.patch(API_SIDEBAR, async ({ request }) => {
    const body = (await request.json()) as { collapsed?: boolean };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      sidebar: createFakeSidebar({ collapsed: body.collapsed }),
    });
  }),
];

// Status-specific handlers for stories
export const layoutStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: layoutHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.layout.invalidLayoutConfiguration', 'Invalid layout configuration'),
          API_SIDEBAR
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_LAYOUT_CONFIG, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.layout.authenticationRequired', 'Authentication required'),
          API_LAYOUT_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.patch(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.layout.cannotModifyLayoutSettings', 'Cannot modify layout settings'),
          API_SIDEBAR
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.layout.layoutConfigurationNotFound', 'Layout configuration not found'),
          API_SIDEBAR
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.layout.requestValidationFailed', 'Request validation failed'),
          API_SIDEBAR,
          {
            field: 'data',
            error: i18n.t('handler.layout.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_LAYOUT_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.layout.tooManyRequests', 'Too many requests'),
          API_LAYOUT_CONFIG,
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
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t('handler.layout.failedToLoadLayout', 'Failed to load layout'),
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
    http.get(API_LAYOUT_CONFIG, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.layout.layoutServiceUnavailable', 'Layout service unavailable'),
          API_LAYOUT_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_LAYOUT_CONFIG, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.layout.serviceUnderMaintenance', 'Service under maintenance'),
          API_LAYOUT_CONFIG,
          {
            retryAfter: '180',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_LAYOUT_CONFIG, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.layout.requestTimedOut', 'Request timed out'),
          API_LAYOUT_CONFIG
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SIDEBAR, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SIDEBAR, async () => {
      await delay(5000);
      return HttpResponse.json({ sidebar: createFakeSidebar() });
    }),
  ],

  networkError: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json({
        sidebar: { id: faker.string.uuid(), title: '', items: [], collapsed: false },
      });
    }),
  ],

  collapsedSidebar: [
    http.get(API_SIDEBAR, async () => {
      await delay(300);
      return HttpResponse.json({ sidebar: createFakeSidebar({ collapsed: true }) });
    }),
  ],
};
