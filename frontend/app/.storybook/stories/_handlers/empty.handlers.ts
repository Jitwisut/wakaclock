import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_EMPTY_STATE_DATA = '/api/empty-state/data';
const API_EMPTY_STATE_ACTION = '/api/empty-state/action';

// Default success handlers
export const emptyHandlers = [
  // GET /api/empty-state/data - Fetch data that might be empty
  http.get(API_EMPTY_STATE_DATA, async ({ request }) => {
    const url = new URL(request.url);
    const forceEmpty = url.searchParams.get('empty') === 'true';
    await delay(faker.number.int({ min: 200, max: 400 }));

    if (forceEmpty) {
      return HttpResponse.json({
        items: [],
        total: 0,
        isEmpty: true,
        emptyMessage: i18n.t('handler.empty.noItemsFound', 'No items found'),
        emptyAction: {
          label: i18n.t('handler.empty.createFirstItem', 'Create First Item'),
          actionId: 'create',
        },
      });
    }

    return HttpResponse.json({
      items: Array.from({ length: 5 }, () => ({
        id: faker.string.uuid(),
        title: faker.lorem.sentence(),
        createdAt: faker.date.recent().toISOString(),
      })),
      total: 5,
      isEmpty: false,
    });
  }),

  // POST /api/empty-state/action - Handle empty state CTA action
  http.post(API_EMPTY_STATE_ACTION, async ({ request }) => {
    const body = (await request.json()) as { actionId: string };
    await delay(faker.number.int({ min: 300, max: 500 }));

    return HttpResponse.json({
      success: true,
      actionId: body.actionId,
      message: i18n.t('handler.empty.actionInitiatedSuccessfully', 'Action initiated successfully'),
      redirectUrl: '/create',
    });
  }),
];

// Status-specific handlers for stories
export const emptyStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: emptyHandlers,

  // Empty data states
  emptyWithAction: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
        isEmpty: true,
        emptyMessage: i18n.t('handler.empty.youHaveNoProjectsYet', 'You have no projects yet'),
        emptyDescription: i18n.t(
          'handler.empty.createYourFirstProjectTo',
          'Create your first project to get started.'
        ),
        emptyAction: {
          label: i18n.t('handler.empty.createProject', 'Create Project'),
          actionId: 'create-project',
        },
      });
    }),
  ],

  emptyNoAction: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
        isEmpty: true,
        emptyMessage: i18n.t('handler.empty.noResultsFound', 'No results found'),
        emptyDescription: i18n.t(
          'handler.empty.tryAdjustingYourSearchOr',
          'Try adjusting your search or filters.'
        ),
      });
    }),
  ],

  emptyFiltered: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
        isEmpty: true,
        emptyMessage: i18n.t('handler.empty.noMatchingItems', 'No matching items'),
        emptyDescription: i18n.t(
          'handler.empty.noItemsMatchYourCurrent',
          'No items match your current filters.'
        ),
        emptyAction: {
          label: i18n.t('handler.empty.clearFilters', 'Clear Filters'),
          actionId: 'clear-filters',
        },
        filterApplied: true,
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'BAD_REQUEST',
          i18n.t('handler.empty.invalidRequest', 'Invalid request'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.empty.pleaseLogInToView', 'Please log in to view this content'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.empty.youDoNotHaveAccess', 'You do not have access to this resource'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.empty.unableToProcessRequest', 'Unable to process request'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  notFound: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.empty.resourceNotFound', 'Resource not found'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_EMPTY_STATE_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t('handler.empty.actionAlreadyInProgress', 'Action already in progress'),
          API_EMPTY_STATE_ACTION,
          {
            existingActionId: faker.string.uuid(),
            startedAt: new Date().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.empty.tooManyRequests', 'Too many requests'),
          API_EMPTY_STATE_DATA,
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
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t('handler.empty.failedToLoadData', 'Failed to load data'),
          API_EMPTY_STATE_DATA,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.empty.unableToReachUpstreamService', 'Unable to reach upstream service'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.empty.serviceIsTemporarilyUnavailable',
            'Service is temporarily unavailable'
          ),
          API_EMPTY_STATE_DATA,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.empty.requestTimedOut', 'Request timed out'),
          API_EMPTY_STATE_DATA
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  networkError: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  slowResponse: [
    http.get(API_EMPTY_STATE_DATA, async () => {
      await delay(5000);
      return HttpResponse.json({
        items: [],
        total: 0,
        isEmpty: true,
        emptyMessage: i18n.t(
          'handler.empty.noItemsFoundAfterSlow',
          'No items found after slow response'
        ),
      });
    }),
  ],
};
