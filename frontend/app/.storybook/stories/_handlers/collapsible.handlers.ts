import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

const API_COLLAPSIBLE_STATE = '/api/collapsible/state';
const API_COLLAPSIBLE_CONTENT = '/api/collapsible/content';
const API_COLLAPSIBLE_PREFERENCES = '/api/collapsible/preferences';
const API_COLLAPSIBLE_ANALYTICS = '/api/collapsible/analytics';

// ═══════════════════════════════════════════════════════════════
// DEFAULT SUCCESS HANDLERS
// ═══════════════════════════════════════════════════════════════

export const collapsibleHandlers = [
  // POST /api/collapsible/state - Save collapsible open/closed state
  http.post(API_COLLAPSIBLE_STATE, async ({ request }) => {
    const body = (await request.json()) as { id: string; isOpen: boolean };
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      success: true,
      state: {
        id: body.id,
        isOpen: body.isOpen,
        savedAt: new Date().toISOString(),
      },
    });
  }),

  // GET /api/collapsible/content - Fetch dynamic collapsible content
  http.get(API_COLLAPSIBLE_CONTENT, async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') ?? 'default';
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({
      id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      content: faker.lorem.paragraphs({ min: 1, max: 3 }),
      metadata: {
        createdAt: faker.date.recent().toISOString(),
        wordCount: faker.number.int({ min: 50, max: 300 }),
      },
    });
  }),

  // GET /api/collapsible/preferences - Fetch user collapsible preferences
  http.get(API_COLLAPSIBLE_PREFERENCES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));

    return HttpResponse.json({
      success: true,
      preferences: {
        defaultOpen: faker.datatype.boolean(),
        animationEnabled: true,
        animationDuration: 300,
        rememberState: true,
      },
    });
  }),

  // POST /api/collapsible/analytics - Track collapsible interactions
  http.post(API_COLLAPSIBLE_ANALYTICS, async ({ request }) => {
    const body = (await request.json()) as {
      action: 'collapse' | 'expand';
      collapsibleId: string;
    };
    await delay(50);

    return HttpResponse.json({
      success: true,
      eventId: `evt_${Date.now()}`,
      action: body.action,
      collapsibleId: body.collapsibleId,
      trackedAt: new Date().toISOString(),
    });
  }),
];

// ═══════════════════════════════════════════════════════════════
// STATUS-SPECIFIC HANDLERS
// ═══════════════════════════════════════════════════════════════

export const collapsibleStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: collapsibleHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_STATE',
          i18n.t(
            'handler.collapsible.invalidCollapsibleStateData',
            'Invalid collapsible state data'
          ),
          API_COLLAPSIBLE_STATE,
          {
            id: i18n.t('handler.collapsible.collapsibleIdIsRequired', 'Collapsible ID is required'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.collapsible.authenticationRequiredToViewContent',
            'Authentication required to view content'
          ),
          API_COLLAPSIBLE_CONTENT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.collapsible.authenticationRequiredToSaveState',
            'Authentication required to save state'
          ),
          API_COLLAPSIBLE_STATE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.collapsible.youDoNotHavePermission',
            'You do not have permission to view this content'
          ),
          API_COLLAPSIBLE_CONTENT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t('handler.collapsible.collapsibleContentNotFound', 'Collapsible content not found'),
          API_COLLAPSIBLE_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t(
            'handler.collapsible.collapsibleStateConflictConcurrentModification',
            'Collapsible state conflict - concurrent modification detected'
          ),
          API_COLLAPSIBLE_STATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.collapsible.invalidStateValueProvided', 'Invalid state value provided'),
          API_COLLAPSIBLE_STATE,
          { isOpen: i18n.t('handler.collapsible.mustBeABooleanValue', 'Must be a boolean value') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.collapsible.tooManyRequests', 'Too many requests'),
          API_COLLAPSIBLE_STATE,
          {
            limit: '100/minute',
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
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t(
            'handler.collapsible.failedToLoadCollapsibleContent',
            'Failed to load collapsible content'
          ),
          API_COLLAPSIBLE_CONTENT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t(
            'handler.collapsible.failedToSaveCollapsibleState',
            'Failed to save collapsible state'
          ),
          API_COLLAPSIBLE_STATE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.collapsible.contentServiceUnavailable', 'Content service unavailable'),
          API_COLLAPSIBLE_CONTENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.collapsible.serviceIsUnderMaintenance', 'Service is under maintenance'),
          API_COLLAPSIBLE_CONTENT,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.collapsible.requestTimedOut', 'Request timed out'),
          API_COLLAPSIBLE_CONTENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_COLLAPSIBLE_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const id = url.searchParams.get('id') ?? 'default';
      await delay(4000);
      return HttpResponse.json({
        id,
        title: i18n.t('handler.collapsible.slowloadedContent', 'Slow-loaded content'),
        content: faker.lorem.paragraphs(2),
      });
    }),
  ],

  networkError: [
    http.get(API_COLLAPSIBLE_CONTENT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_COLLAPSIBLE_STATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyContent: [
    http.get(API_COLLAPSIBLE_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const id = url.searchParams.get('id') ?? 'default';
      await delay(200);
      return HttpResponse.json({
        id,
        title: i18n.t('handler.collapsible.emptySection', 'Empty section'),
        content: '',
        isEmpty: true,
      });
    }),
  ],

  // ============ ANALYTICS HANDLERS ============
  analyticsSuccess: [
    ...collapsibleHandlers,
    http.post(API_COLLAPSIBLE_ANALYTICS, async ({ request }) => {
      const body = await request.json();
      await delay(50);
      return HttpResponse.json({
        success: true,
        eventId: `evt_${Date.now()}`,
        receivedAt: new Date().toISOString(),
        data: body,
      });
    }),
  ],

  analyticsError: [
    ...collapsibleHandlers,
    http.post(API_COLLAPSIBLE_ANALYTICS, async () => {
      await delay(50);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ANALYTICS_ERROR',
          i18n.t('handler.collapsible.failedToTrackEvent', 'Failed to track event'),
          API_COLLAPSIBLE_ANALYTICS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // ============ PREFERENCE HANDLERS ============
  preferencesSuccess: [
    ...collapsibleHandlers,
    http.get(API_COLLAPSIBLE_PREFERENCES, async () => {
      await delay(150);
      return HttpResponse.json({
        success: true,
        preferences: {
          defaultOpen: true,
          animationEnabled: true,
          animationDuration: 300,
          rememberState: true,
        },
      });
    }),
  ],

  preferencesDisabled: [
    ...collapsibleHandlers,
    http.get(API_COLLAPSIBLE_PREFERENCES, async () => {
      await delay(150);
      return HttpResponse.json({
        success: true,
        preferences: {
          defaultOpen: false,
          animationEnabled: false,
          animationDuration: 0,
          rememberState: false,
        },
      });
    }),
  ],
};
