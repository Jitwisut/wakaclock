import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PROMPT LOADER HANDLERS
// Enterprise-grade MSW handlers for prompt loader component
// ============================================================================

// API Endpoints
const API_LOADER = '/api/loader';
const API_LOADER_STATUS = '/api/loader/status';
const API_LOADER_PROGRESS = '/api/loader/progress';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const promptLoaderHandlers = [
  http.get(API_LOADER_STATUS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      status: faker.helpers.arrayElement(['idle', 'loading', 'streaming', 'complete']),
      message: faker.helpers.arrayElement([
        i18n.t('handler.promptLoader.processing', 'Processing...'),
        i18n.t('handler.promptLoader.generatingResponse', 'Generating response...'),
        i18n.t('handler.promptLoader.almostDone', 'Almost done...'),
      ]),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(API_LOADER_PROGRESS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({
      progress: faker.number.int({ min: 0, max: 100 }),
      tokensGenerated: faker.number.int({ min: 0, max: 500 }),
      estimatedTotal: faker.number.int({ min: 500, max: 2000 }),
    });
  }),

  http.get(API_LOADER, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0' });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const promptLoaderStatusHandlers = {
  success: promptLoaderHandlers,
  badRequest: [
    http.get(API_LOADER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.promptLoader.invalidRequestParameters', 'Invalid request parameters'),
          API_LOADER,
          {
            field: 'data',
            error: i18n.t('handler.promptLoader.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_LOADER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.promptLoader.authenticationRequired', 'Authentication required'),
          API_LOADER
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_LOADER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.promptLoader.accessDeniedToThisResource',
            'Access denied to this resource'
          ),
          API_LOADER
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.promptLoader.loaderStatusNotFound', 'Loader status not found'),
          API_LOADER_STATUS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'LOADER_CONFLICT',
          i18n.t('handler.promptLoader.loaderStateConflict', 'Loader state conflict'),
          API_LOADER_STATUS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.promptLoader.tooManyLoaderStatusRequests',
            'Too many loader status requests'
          ),
          API_LOADER_STATUS,
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
  unprocessableEntity: [
    http.get(API_LOADER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.promptLoader.requestValidationFailed', 'Request validation failed'),
          API_LOADER,
          {
            field: 'data',
            error: i18n.t('handler.promptLoader.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.promptLoader.failedToGetLoaderStatus', 'Failed to get loader status'),
          API_LOADER_STATUS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.promptLoader.loaderServiceUnavailable', 'Loader service unavailable'),
          API_LOADER_STATUS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptLoader.loaderServiceIsUnderMaintenance',
            'Loader service is under maintenance'
          ),
          API_LOADER_STATUS,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.promptLoader.loaderRequestTimedOut', 'Loader request timed out'),
          API_LOADER_STATUS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(5000);
      return HttpResponse.json({
        status: 'loading',
        message: i18n.t('handler.promptLoader.processing', 'Processing...'),
        timestamp: new Date().toISOString(),
      });
    }),
  ],
  loading: [
    http.get(API_LOADER_STATUS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_LOADER_STATUS, () => HttpResponse.error())],
  streaming: [
    http.get(API_LOADER_STATUS, async () => {
      await delay(100);
      return HttpResponse.json({
        status: 'streaming',
        message: i18n.t('handler.promptLoader.generating', 'Generating...'),
        timestamp: new Date().toISOString(),
      });
    }),
  ],
};
