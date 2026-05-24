import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeBreadcrumbs } from '../_factories/breadcrumb.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_BREADCRUMBS = '/api/breadcrumbs';

// Default success handlers
export const breadcrumbHandlers = [
  // GET /api/breadcrumbs
  http.get(API_BREADCRUMBS, async ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') ?? '/home/documents/projects';
    const pathSegments = path.split('/').filter(Boolean);
    const depth = Math.max(pathSegments.length, 3);

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      breadcrumbs: createFakeBreadcrumbs(depth),
      currentPath: path,
    });
  }),
];

// Status-specific handlers for stories
export const breadcrumbStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: breadcrumbHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PATH',
          i18n.t('handler.breadcrumb.invalidPathFormat', 'Invalid path format'),
          API_BREADCRUMBS,
          {
            path: i18n.t(
              'handler.breadcrumb.pathMustBeAValid',
              'Path must be a valid URL path starting with /'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.breadcrumb.authenticationRequired', 'Authentication required'),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.breadcrumb.accessDeniedToThisPath', 'Access denied to this path'),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PATH_NOT_FOUND',
          i18n.t('handler.breadcrumb.theRequestedPathDoesNot', 'The requested path does not exist'),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'PATH_CONFLICT',
          i18n.t(
            'handler.breadcrumb.pathResolutionConflictDetected',
            'Path resolution conflict detected'
          ),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.breadcrumb.requestValidationFailed', 'Request validation failed'),
          API_BREADCRUMBS,
          {
            field: 'data',
            error: i18n.t('handler.breadcrumb.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.breadcrumb.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_BREADCRUMBS,
          {
            limit: '500/hour',
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
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'NAVIGATION_ERROR',
          i18n.t(
            'handler.breadcrumb.failedToResolveBreadcrumbPath',
            'Failed to resolve breadcrumb path'
          ),
          API_BREADCRUMBS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.breadcrumb.navigationServiceUnavailable',
            'Navigation service unavailable'
          ),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.breadcrumb.navigationServiceIsUnderMaintenance',
            'Navigation service is under maintenance'
          ),
          API_BREADCRUMBS,
          {
            retryAfter: '120',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.breadcrumb.navigationServiceTimedOut', 'Navigation service timed out'),
          API_BREADCRUMBS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_BREADCRUMBS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(5000);
      return HttpResponse.json({
        breadcrumbs: createFakeBreadcrumbs(4),
        currentPath: '/home/documents/projects/current',
      });
    }),
  ],

  networkError: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_BREADCRUMBS, async () => {
      await delay(300);
      return HttpResponse.json({
        breadcrumbs: [],
        currentPath: '/',
      });
    }),
  ],
};
