import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeAlerts } from '../_factories/alert.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_ALERTS = '/api/alerts';
const API_ALERTS_DISMISS = '/api/alerts/:id/dismiss';
const API_ALERTS_BY_ID = '/api/alerts/:id';

// Default success handlers
export const alertHandlers = [
  // GET /api/alerts
  http.get(API_ALERTS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const alerts = createFakeAlerts(limit);
    return HttpResponse.json({
      alerts,
      total: alerts.length,
    });
  }),

  // POST /api/alerts/:id/dismiss
  http.post(API_ALERTS_DISMISS, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      id: params.id,
      dismissed: true,
      dismissedAt: new Date().toISOString(),
    });
  }),

  // DELETE /api/alerts/:id
  http.delete(API_ALERTS_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),
];

// Status-specific handlers for stories
export const alertStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: alertHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.alert.invalidQueryParameters', 'Invalid query parameters'),
          API_ALERTS,
          {
            limit: i18n.t('handler.alert.mustBeAPositiveInteger', 'Must be a positive integer'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_ALERTS_DISMISS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_REQUEST',
          i18n.t('handler.alert.alertAlreadyDismissed', 'Alert already dismissed'),
          API_ALERTS_DISMISS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.alert.authenticationRequired', 'Authentication required'),
          API_ALERTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.alert.accessDeniedToAlertData', 'Access denied to alert data'),
          API_ALERTS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.delete(API_ALERTS_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.alert.cannotDeleteSystemAlerts', 'Cannot delete system alerts'),
          API_ALERTS_BY_ID
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_ALERTS_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'ALERT_NOT_FOUND',
          `Alert ${params.id} not found`,
          API_ALERTS_BY_ID
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_ALERTS_DISMISS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ALREADY_DISMISSED',
          i18n.t('handler.alert.alertHasAlreadyBeenDismissed', 'Alert has already been dismissed'),
          API_ALERTS_DISMISS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.alert.requestValidationFailedForAlert',
            'Request validation failed for alert data'
          ),
          API_ALERTS,
          {
            field: 'severity',
            error: i18n.t(
              'handler.alert.invalidAlertSeverityLevel',
              'Invalid alert severity level'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_ALERTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.alert.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_ALERTS,
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
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.alert.failedToFetchAlertData', 'Failed to fetch alert data'),
          API_ALERTS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.alert.alertServiceUnavailable', 'Alert service unavailable'),
          API_ALERTS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.alert.alertServiceUnderMaintenance', 'Alert service under maintenance'),
          API_ALERTS,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.alert.alertServiceTimedOut', 'Alert service timed out'),
          API_ALERTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_ALERTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_ALERTS, async () => {
      await delay(5000);
      return HttpResponse.json({
        alerts: createFakeAlerts(10),
        total: 10,
      });
    }),
  ],

  networkError: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_ALERTS, async () => {
      await delay(300);
      return HttpResponse.json({
        alerts: [],
        total: 0,
      });
    }),
  ],
};
