import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_RESIZABLE_LAYOUT = '/api/resizable/layout';
const API_RESIZABLE_SAVE = '/api/resizable/save';
const API_RESIZABLE_PRESETS = '/api/resizable/presets';

// Default success handlers
export const resizableHandlers = [
  // GET /api/resizable/layout - Get saved layout configuration
  http.get(API_RESIZABLE_LAYOUT, async ({ request }) => {
    const url = new URL(request.url);
    const layoutId = url.searchParams.get('layoutId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      layoutId,
      direction: faker.helpers.arrayElement(['horizontal', 'vertical']),
      panels: [
        { id: 'sidebar', size: faker.number.int({ min: 15, max: 30 }), minSize: 15, maxSize: 40 },
        { id: 'content', size: faker.number.int({ min: 50, max: 70 }), minSize: 30 },
        {
          id: 'details',
          size: faker.number.int({ min: 15, max: 25 }),
          minSize: 15,
          maxSize: 35,
          collapsible: true,
        },
      ],
      savedAt: faker.date.recent().toISOString(),
    });
  }),

  // POST /api/resizable/save - Save layout configuration
  http.post(API_RESIZABLE_SAVE, async ({ request }) => {
    const body = (await request.json()) as {
      layoutId: string;
      panels: Array<{ id: string; size: number }>;
    };
    await delay(faker.number.int({ min: 150, max: 350 }));

    return HttpResponse.json({
      success: true,
      layoutId: body.layoutId,
      savedAt: new Date().toISOString(),
      panels: body.panels,
    });
  }),

  // GET /api/resizable/presets - Get layout presets
  http.get(API_RESIZABLE_PRESETS, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      presets: [
        {
          id: 'default',
          name: i18n.t('handler.resizable.default', 'Default'),
          panels: [
            { id: 'sidebar', size: 25 },
            { id: 'content', size: 75 },
          ],
        },
        {
          id: 'wide-sidebar',
          name: i18n.t('handler.resizable.wideSidebar', 'Wide Sidebar'),
          panels: [
            { id: 'sidebar', size: 35 },
            { id: 'content', size: 65 },
          ],
        },
        {
          id: 'minimal',
          name: i18n.t('handler.resizable.minimal', 'Minimal'),
          panels: [
            { id: 'sidebar', size: 15 },
            { id: 'content', size: 85 },
          ],
        },
        {
          id: 'three-column',
          name: i18n.t('handler.resizable.threeColumn', 'Three Column'),
          panels: [
            { id: 'sidebar', size: 20 },
            { id: 'content', size: 60 },
            { id: 'details', size: 20 },
          ],
        },
      ],
    });
  }),
];

// Status-specific handlers for stories
export const resizableStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: resizableHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_LAYOUT',
          i18n.t(
            'handler.resizable.invalidPanelLayoutConfiguration',
            'Invalid panel layout configuration'
          ),
          API_RESIZABLE_SAVE,
          {
            panels: i18n.t(
              'handler.resizable.panelSizesMustSumTo100',
              'Panel sizes must sum to 100'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.resizable.authenticationRequiredToLoadLayout',
            'Authentication required to load layout'
          ),
          API_RESIZABLE_LAYOUT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.resizable.authenticationRequiredToSaveLayout',
            'Authentication required to save layout'
          ),
          API_RESIZABLE_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.resizable.accessDeniedToSaveLayout', 'Access denied to save layout'),
          API_RESIZABLE_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'LAYOUT_NOT_FOUND',
          i18n.t('handler.resizable.layoutConfigurationNotFound', 'Layout configuration not found'),
          API_RESIZABLE_LAYOUT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.resizable.layoutValidationFailed', 'Layout validation failed'),
          API_RESIZABLE_SAVE,
          {
            minSize: i18n.t(
              'handler.resizable.panelSizeBelowMinimumThreshold',
              'Panel size below minimum threshold'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.resizable.tooManyLayoutSavesPlease',
            'Too many layout saves. Please wait.'
          ),
          API_RESIZABLE_SAVE,
          { retryAfter: '10' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'LAYOUT_CONFLICT',
          i18n.t(
            'handler.resizable.layoutWasModifiedByAnother',
            'Layout was modified by another session'
          ),
          API_RESIZABLE_SAVE,
          {
            suggestion: i18n.t(
              'handler.resizable.pleaseRefreshAndTryAgain',
              'Please refresh and try again'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t(
            'handler.resizable.failedToLoadLayoutConfiguration',
            'Failed to load layout configuration'
          ),
          API_RESIZABLE_LAYOUT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t(
            'handler.resizable.failedToSaveLayoutConfiguration',
            'Failed to save layout configuration'
          ),
          API_RESIZABLE_SAVE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.resizable.layoutServiceTemporarilyUnavailable',
            'Layout service temporarily unavailable'
          ),
          API_RESIZABLE_LAYOUT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.resizable.layoutServiceIsUnderMaintenance',
            'Layout service is under maintenance'
          ),
          API_RESIZABLE_LAYOUT,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.resizable.layoutRequestTimedOut', 'Layout request timed out'),
          API_RESIZABLE_LAYOUT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(4000);
      return HttpResponse.json({
        layoutId: 'slow',
        direction: 'horizontal',
        panels: [
          { id: 'sidebar', size: 25 },
          { id: 'content', size: 75 },
        ],
        savedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_RESIZABLE_SAVE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_RESIZABLE_LAYOUT, async () => {
      await delay(200);
      return HttpResponse.json({
        layoutId: 'empty',
        direction: 'horizontal',
        panels: [],
        savedAt: null,
      });
    }),
    http.get(API_RESIZABLE_PRESETS, async () => {
      await delay(200);
      return HttpResponse.json({
        presets: [],
      });
    }),
  ],
};
