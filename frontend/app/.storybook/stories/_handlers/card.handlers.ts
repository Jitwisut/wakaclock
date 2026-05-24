import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeCard, createFakeCards } from '../_factories/card.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_CARDS = '/api/cards';
const API_CARDS_BY_ID = '/api/cards/:id';
const API_CARDS_ACTION = '/api/cards/:id/action';

// Helper for pagination
function createPagination(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// Default success handlers
export const cardHandlers = [
  // GET /api/cards
  http.get(API_CARDS, async ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 300, max: 600 }));

    const total = faker.number.int({ min: 50, max: 200 });
    const cards = createFakeCards(limit);

    return HttpResponse.json({
      cards,
      pagination: createPagination(page, limit, total),
    });
  }),

  // GET /api/cards/:id
  http.get(API_CARDS_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const card = createFakeCard({ id: params.id as string });
    return HttpResponse.json(card);
  }),

  // POST /api/cards/:id/action
  http.post(API_CARDS_ACTION, async ({ request, params }) => {
    const body = (await request.json()) as { action: string };
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      id: params.id,
      action: body.action,
      success: true,
      timestamp: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const cardStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: cardHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.card.invalidQueryParameters', 'Invalid query parameters'),
          API_CARDS,
          {
            page: i18n.t('handler.card.mustBeAPositiveInteger', 'Must be a positive integer'),
            limit: i18n.t('handler.card.mustBeBetween1And', 'Must be between 1 and 100'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_CARDS_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.card.invalidActionSpecified', 'Invalid action specified'),
          API_CARDS_ACTION
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.card.authenticationRequired', 'Authentication required'),
          API_CARDS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.card.accessDeniedToCardData', 'Access denied to card data'),
          API_CARDS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_CARDS_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.card.notAuthorizedToPerformThis',
            'Not authorized to perform this action'
          ),
          API_CARDS_ACTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_CARDS_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CARD_NOT_FOUND',
          `Card ${params.id} not found`,
          API_CARDS_BY_ID
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_CARDS_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ACTION_CONFLICT',
          i18n.t(
            'handler.card.cardActionConflictConcurrentModification',
            'Card action conflict - concurrent modification detected'
          ),
          API_CARDS_ACTION
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.card.requestValidationFailed', 'Request validation failed'),
          API_CARDS,
          {
            field: 'data',
            error: i18n.t('handler.card.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_CARDS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.card.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_CARDS,
          {
            limit: '1000/hour',
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
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.card.failedToFetchCardData', 'Failed to fetch card data'),
          API_CARDS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.card.cardServiceUnavailable', 'Card service unavailable'),
          API_CARDS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.card.cardServiceUnderMaintenance', 'Card service under maintenance'),
          API_CARDS,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.card.cardServiceTimedOut', 'Card service timed out'),
          API_CARDS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_CARDS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_CARDS, async () => {
      await delay(5000);
      return HttpResponse.json({
        cards: createFakeCards(10),
        pagination: createPagination(1, 10, 100),
      });
    }),
  ],

  networkError: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_CARDS, async () => {
      await delay(300);
      return HttpResponse.json({
        cards: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });
    }),
  ],
};
