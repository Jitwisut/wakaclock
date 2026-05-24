/**
 * AsyncWrapper MSW Handlers
 *
 * Mock Service Worker handlers for AsyncWrapper component stories.
 * Provides success, error, and special state handlers for all HTTP statuses.
 *
 * @module async-wrapper.handlers
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '@/.storybook/stories/_utils/http-status';

import { createFakeProducts, createFakeUsers } from '../_factories/async-wrapper.factory';

import type { FakeApiResponse, FakeProduct, FakeUser } from '../_factories/async-wrapper.factory';

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const API_ASYNC_USERS = '/api/async-wrapper/users';
export const API_ASYNC_PRODUCTS = '/api/async-wrapper/products';

// ============================================================================
// DEFAULT SUCCESS HANDLERS
// ============================================================================

export const asyncWrapperHandlers = [
  http.get(API_ASYNC_USERS, async () => {
    await delay(faker.number.int({ min: 300, max: 800 }));
    return HttpResponse.json<FakeApiResponse<FakeUser>>({
      data: createFakeUsers(5),
      meta: { page: 1, perPage: 10, total: 25 },
    });
  }),

  http.get(API_ASYNC_PRODUCTS, async () => {
    await delay(faker.number.int({ min: 300, max: 800 }));
    return HttpResponse.json<FakeApiResponse<FakeProduct>>({
      data: createFakeProducts(6),
      meta: { page: 1, perPage: 10, total: 42 },
    });
  }),
];

// ============================================================================
// STATUS HANDLER MAP
// ============================================================================

export const asyncWrapperStatusHandlers: Record<string, ReturnType<typeof http.get>[]> = {
  // Success
  success: asyncWrapperHandlers,

  // Empty data
  emptyData: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json<FakeApiResponse<FakeUser>>({
        data: [],
        meta: { page: 1, perPage: 10, total: 0 },
      });
    }),
    http.get(API_ASYNC_PRODUCTS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json<FakeApiResponse<FakeProduct>>({
        data: [],
        meta: { page: 1, perPage: 10, total: 0 },
      });
    }),
  ],

  // 4xx Client Errors
  badRequest: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_QUERY',
          i18n.t(
            'handler.asyncWrapper.invalidQueryParametersProvided',
            'Invalid query parameters provided'
          ),
          API_ASYNC_USERS,
          {
            limit: i18n.t(
              'handler.asyncWrapper.mustBeAPositiveInteger',
              'Must be a positive integer'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.asyncWrapper.authenticationRequired', 'Authentication required'),
          API_ASYNC_USERS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.asyncWrapper.accessDenied', 'Access denied'),
          API_ASYNC_USERS,
          {
            requiredRole: 'admin',
          }
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.asyncWrapper.resourceNotFound', 'Resource not found'),
          API_ASYNC_USERS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t('handler.asyncWrapper.resourceConflictDetected', 'Resource conflict detected'),
          API_ASYNC_USERS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          i18n.t('handler.asyncWrapper.requestValidationFailed', 'Request validation failed'),
          API_ASYNC_USERS,
          { fields: 'page, limit' }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 100, max: 300 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.asyncWrapper.rateLimitExceededPleaseTry',
            'Rate limit exceeded. Please try again later.'
          ),
          API_ASYNC_USERS,
          {
            limit: '100',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.asyncWrapper.anUnexpectedErrorOccurred', 'An unexpected error occurred'),
          API_ASYNC_USERS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.asyncWrapper.invalidResponseFromUpstreamServer',
            'Invalid response from upstream server'
          ),
          API_ASYNC_USERS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.asyncWrapper.serviceTemporarilyUnavailable',
            'Service temporarily unavailable'
          ),
          API_ASYNC_USERS,
          { retryAfter: '300' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.asyncWrapper.requestTimedOut', 'Request timed out'),
          API_ASYNC_USERS,
          { timeout: '30000' }
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special states
  loading: [
    http.get(API_ASYNC_USERS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_ASYNC_PRODUCTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 3000, max: 5000 }));
      return HttpResponse.json<FakeApiResponse<FakeUser>>({
        data: createFakeUsers(5),
        meta: { page: 1, perPage: 10, total: 25 },
      });
    }),
  ],

  networkError: [
    http.get(API_ASYNC_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.error();
    }),
  ],
};
