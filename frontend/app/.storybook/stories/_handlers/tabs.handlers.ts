import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeTab, createFakeTabs } from '../_factories/tabs.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TABS = '/api/tabs';
const API_TAB_CONTENT = '/api/tab-content/:id';

// Default success handlers
export const tabsHandlers = [
  // GET /api/tabs
  http.get(API_TABS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);

    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({
      tabs: createFakeTabs(count),
    });
  }),

  // GET /api/tab-content/:id
  http.get(API_TAB_CONTENT, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const tab = createFakeTab({ id: params.id as string });
    return HttpResponse.json({
      id: params.id,
      content: tab.content,
      metadata: {
        lastUpdated: faker.date.recent().toISOString(),
        wordCount: faker.number.int({ min: 50, max: 500 }),
      },
    });
  }),
];

// Status-specific handlers for stories
export const tabsStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: tabsHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.tabs.invalidQueryParameters', 'Invalid query parameters'),
          API_TABS,
          {
            count: i18n.t(
              'handler.tabs.mustBeAPositiveInteger',
              'Must be a positive integer between 1 and 20'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.tabs.authenticationRequiredToViewTabs',
            'Authentication required to view tabs'
          ),
          API_TABS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.tabs.accessDeniedToThisContent', 'Access denied to this content'),
          API_TABS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.get(API_TAB_CONTENT, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.tabs.youDoNotHavePermission',
            'You do not have permission to view this tab content'
          ),
          `/api/tab-content/${params.id}`
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_TAB_CONTENT, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Tab ${params.id} not found`,
          `/api/tab-content/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.tabs.tabConfigurationConflictDetected',
            'Tab configuration conflict detected'
          ),
          API_TABS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.tabs.requestValidationFailed', 'Request validation failed'),
          API_TABS,
          {
            field: 'data',
            error: i18n.t('handler.tabs.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_TABS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.tabs.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_TABS,
          {
            limit: '100/hour',
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
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.tabs.failedToRetrieveTabs', 'Failed to retrieve tabs'),
          API_TABS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.tabs.tabServiceUnavailable', 'Tab service unavailable'),
          API_TABS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.tabs.tabServiceIsUnderMaintenance', 'Tab service is under maintenance'),
          API_TABS,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.tabs.tabServiceTimedOut', 'Tab service timed out'),
          API_TABS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TABS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_TABS, async () => {
      await delay(5000);
      return HttpResponse.json({
        tabs: createFakeTabs(5),
      });
    }),
  ],

  networkError: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TABS, async () => {
      await delay(300);
      return HttpResponse.json({
        tabs: [],
      });
    }),
  ],
};
