import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the max width CSS value for a given layout mode
 * @param layout - The content layout mode
 * @returns The max width CSS value
 */
function getMaxWidthForLayout(layout: ContentLayoutMode): string {
  if (layout === 'full') return '100%';
  if (layout === 'wide') return '1400px';
  if (layout === 'compact') return '800px';
  return '1200px';
}

// ============================================================================
// CONTENT LAYOUT SELECTOR HANDLERS
// Enterprise-grade MSW handlers for content layout selector component
// ============================================================================

// API Endpoints
const API_CONTENT_LAYOUT = '/api/content-layout';
const API_CONTENT_LAYOUT_GET = '/api/content-layout/current';
const API_CONTENT_LAYOUT_SET = '/api/content-layout/set';
const API_CONTENT_LAYOUT_PRESETS = '/api/content-layout/presets';

// Types
type ContentLayoutMode = 'compact' | 'default' | 'full' | 'wide';

interface ContentLayoutResponse {
  layout: ContentLayoutMode;
  maxWidth: string;
  padding: string;
  timestamp: string;
}

interface ContentLayoutPreset {
  description: string;
  id: string;
  layout: ContentLayoutMode;
  name: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const contentLayoutSelectorHandlers = [
  // GET current layout
  http.get(API_CONTENT_LAYOUT_GET, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const layouts: ContentLayoutMode[] = ['compact', 'default', 'wide', 'full'];
    const layout = faker.helpers.arrayElement(layouts);
    const response: ContentLayoutResponse = {
      layout,
      maxWidth: getMaxWidthForLayout(layout),
      padding: layout === 'compact' ? '1rem' : '2rem',
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // POST set layout
  http.post(API_CONTENT_LAYOUT_SET, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { layout: ContentLayoutMode };
    const response: ContentLayoutResponse = {
      layout: body.layout,
      maxWidth: getMaxWidthForLayout(body.layout),
      padding: body.layout === 'compact' ? '1rem' : '2rem',
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // GET layout presets
  http.get(API_CONTENT_LAYOUT_PRESETS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const presets: ContentLayoutPreset[] = [
      {
        id: '1',
        name: i18n.t('handler.contentLayoutSelector.compact', 'Compact'),
        layout: 'compact',
        description: i18n.t(
          'handler.contentLayoutSelector.bestForReadingfocusedContent',
          'Best for reading-focused content'
        ),
      },
      {
        id: '2',
        name: i18n.t('handler.contentLayoutSelector.default', 'Default'),
        layout: 'default',
        description: i18n.t(
          'handler.contentLayoutSelector.balancedLayoutForMostUses',
          'Balanced layout for most uses'
        ),
      },
      {
        id: '3',
        name: i18n.t('handler.contentLayoutSelector.wide', 'Wide'),
        layout: 'wide',
        description: i18n.t(
          'handler.contentLayoutSelector.moreSpaceForComplexInterfaces',
          'More space for complex interfaces'
        ),
      },
      {
        id: '4',
        name: i18n.t('handler.contentLayoutSelector.fullWidth', 'Full Width'),
        layout: 'full',
        description: i18n.t(
          'handler.contentLayoutSelector.maximumContentArea',
          'Maximum content area'
        ),
      },
    ];
    return HttpResponse.json({ presets });
  }),

  // Generic endpoint
  http.get(API_CONTENT_LAYOUT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      availableLayouts: ['compact', 'default', 'wide', 'full'],
      currentLayout: faker.helpers.arrayElement(['compact', 'default', 'wide', 'full']),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const contentLayoutSelectorStatusHandlers = {
  // Success
  success: contentLayoutSelectorHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_CONTENT_LAYOUT_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_LAYOUT',
          i18n.t('handler.contentLayoutSelector.invalidLayoutValue', 'Invalid layout value'),
          API_CONTENT_LAYOUT_SET
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_CONTENT_LAYOUT_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.contentLayoutSelector.authenticationRequiredToChangeLayout',
            'Authentication required to change layout'
          ),
          API_CONTENT_LAYOUT_SET
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_CONTENT_LAYOUT_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'LAYOUT_DISABLED',
          i18n.t(
            'handler.contentLayoutSelector.layoutChangesAreDisabled',
            'Layout changes are disabled'
          ),
          API_CONTENT_LAYOUT_SET
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.contentLayoutSelector.layoutConfigurationNotFound',
            'Layout configuration not found'
          ),
          API_CONTENT_LAYOUT_GET
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_CONTENT_LAYOUT_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'LAYOUT_CONFLICT',
          i18n.t(
            'handler.contentLayoutSelector.layoutChangeConflictsWithPage',
            'Layout change conflicts with page requirements'
          ),
          API_CONTENT_LAYOUT_SET
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_CONTENT_LAYOUT_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INCOMPATIBLE_LAYOUT',
          i18n.t(
            'handler.contentLayoutSelector.layoutNotCompatibleWithCurrent',
            'Layout not compatible with current view'
          ),
          API_CONTENT_LAYOUT_SET
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_CONTENT_LAYOUT_SET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.contentLayoutSelector.tooManyLayoutChangesPlease',
            'Too many layout changes. Please wait.'
          ),
          API_CONTENT_LAYOUT_SET
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.contentLayoutSelector.failedToRetrieveLayout',
            'Failed to retrieve layout'
          ),
          API_CONTENT_LAYOUT_GET
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.contentLayoutSelector.layoutServiceUnavailable',
            'Layout service unavailable'
          ),
          API_CONTENT_LAYOUT_GET
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.contentLayoutSelector.layoutServiceTemporarilyUnavailable',
            'Layout service temporarily unavailable'
          ),
          API_CONTENT_LAYOUT_GET
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.contentLayoutSelector.layoutServiceTimeout', 'Layout service timeout'),
          API_CONTENT_LAYOUT_GET
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(3000);
      return HttpResponse.json({
        layout: 'default',
        maxWidth: '1200px',
        padding: '2rem',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [http.get(API_CONTENT_LAYOUT_GET, () => HttpResponse.error())],

  emptyData: [
    http.get(API_CONTENT_LAYOUT_GET, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
