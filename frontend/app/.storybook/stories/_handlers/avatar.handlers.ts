import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeAvatar, createFakeAvatars } from '../_factories/avatar.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_AVATARS = '/api/avatars';
const API_AVATARS_BY_ID = '/api/avatars/:id';

// Default success handlers
export const avatarHandlers = [
  // GET /api/avatars
  http.get(API_AVATARS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const avatars = createFakeAvatars(limit);
    return HttpResponse.json({
      avatars,
      total: avatars.length,
    });
  }),

  // GET /api/avatars/:id
  http.get(API_AVATARS_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const avatar = createFakeAvatar({ id: params.id as string });
    return HttpResponse.json(avatar);
  }),
];

// Status-specific handlers for stories
export const avatarStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: avatarHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.avatar.invalidQueryParameters', 'Invalid query parameters'),
          API_AVATARS,
          {
            limit: i18n.t('handler.avatar.mustBeAPositiveInteger', 'Must be a positive integer'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.avatar.authenticationRequired', 'Authentication required'),
          API_AVATARS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.avatar.accessDeniedToAvatarData', 'Access denied to avatar data'),
          API_AVATARS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_AVATARS_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'AVATAR_NOT_FOUND',
          `Avatar ${params.id} not found`,
          API_AVATARS_BY_ID
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'AVATAR_CONFLICT',
          i18n.t('handler.avatar.avatarResourceConflict', 'Avatar resource conflict'),
          API_AVATARS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.avatar.requestValidationFailed', 'Request validation failed'),
          API_AVATARS,
          {
            field: 'data',
            error: i18n.t('handler.avatar.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_AVATARS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.avatar.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_AVATARS,
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
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.avatar.failedToFetchAvatarData', 'Failed to fetch avatar data'),
          API_AVATARS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.avatar.avatarServiceUnavailable', 'Avatar service unavailable'),
          API_AVATARS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.avatar.avatarServiceUnderMaintenance',
            'Avatar service under maintenance'
          ),
          API_AVATARS,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.avatar.avatarServiceTimedOut', 'Avatar service timed out'),
          API_AVATARS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_AVATARS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_AVATARS, async () => {
      await delay(5000);
      return HttpResponse.json({
        avatars: createFakeAvatars(10),
        total: 10,
      });
    }),
  ],

  networkError: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_AVATARS, async () => {
      await delay(300);
      return HttpResponse.json({
        avatars: [],
        total: 0,
      });
    }),
  ],
};
