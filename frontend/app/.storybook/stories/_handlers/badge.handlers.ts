import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeBadge, createFakeBadges } from '../_factories/badge.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_BADGES = '/api/badges';
const API_BADGES_BY_ID = '/api/badges/:id';

// Default success handlers
export const badgeHandlers = [
  // GET /api/badges
  http.get(API_BADGES, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const badges = createFakeBadges(limit);
    return HttpResponse.json({
      badges,
      count: badges.length,
    });
  }),

  // GET /api/badges/:id
  http.get(API_BADGES_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const badge = createFakeBadge();
    return HttpResponse.json({ ...badge, id: params.id });
  }),
];

// Status-specific handlers for stories
export const badgeStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: badgeHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.badge.invalidQueryParameters', 'Invalid query parameters'),
          API_BADGES,
          {
            limit: i18n.t('handler.badge.mustBeAPositiveInteger', 'Must be a positive integer'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.badge.authenticationRequired', 'Authentication required'),
          API_BADGES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.badge.accessDeniedToBadgeData', 'Access denied to badge data'),
          API_BADGES
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_BADGES_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'BADGE_NOT_FOUND',
          `Badge ${params.id} not found`,
          API_BADGES_BY_ID
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'BADGE_CONFLICT',
          i18n.t('handler.badge.badgeResourceConflict', 'Badge resource conflict'),
          API_BADGES
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.badge.requestValidationFailed', 'Request validation failed'),
          API_BADGES,
          {
            field: 'data',
            error: i18n.t('handler.badge.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_BADGES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.badge.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_BADGES,
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
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.badge.failedToFetchBadgeData', 'Failed to fetch badge data'),
          API_BADGES,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.badge.badgeServiceUnavailable', 'Badge service unavailable'),
          API_BADGES
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.badge.badgeServiceUnderMaintenance', 'Badge service under maintenance'),
          API_BADGES,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.badge.badgeServiceTimedOut', 'Badge service timed out'),
          API_BADGES
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_BADGES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_BADGES, async () => {
      await delay(5000);
      return HttpResponse.json({
        badges: createFakeBadges(10),
        count: 10,
      });
    }),
  ],

  networkError: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_BADGES, async () => {
      await delay(300);
      return HttpResponse.json({
        badges: [],
        count: 0,
      });
    }),
  ],
};
