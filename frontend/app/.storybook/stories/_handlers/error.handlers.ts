import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_ERROR_REPORT = '/api/error/report';
const API_ERROR_LOG = '/api/error/log';
const API_ERROR_FEEDBACK = '/api/error/feedback';

// Default success handlers
export const errorHandlers = [
  // POST /api/error/report - Report an error
  http.post(API_ERROR_REPORT, async ({ request }) => {
    const body = (await request.json()) as { errorCode?: string; message?: string; stack?: string };
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({
      success: true,
      reportId: faker.string.uuid(),
      errorCode: body.errorCode ?? 'UNKNOWN',
      acknowledged: true,
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/error/log - Log an error for debugging
  http.post(API_ERROR_LOG, async ({ request }) => {
    const body = (await request.json()) as { context?: Record<string, unknown>; level?: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      logId: `log_${Date.now()}`,
      level: body.level ?? 'error',
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/error/feedback - Submit user feedback about an error
  http.post(API_ERROR_FEEDBACK, async ({ request }) => {
    const body = (await request.json()) as { errorId?: string; feedback?: string };
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      feedbackId: faker.string.uuid(),
      errorId: body.errorId,
      receivedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const errorStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: errorHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ERROR_FORMAT',
          i18n.t('handler.error.invalidErrorReportFormat', 'Invalid error report format'),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.error.authenticationRequiredToReportErrors',
            'Authentication required to report errors'
          ),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.error.youDoNotHavePermission',
            'You do not have permission to report errors'
          ),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.error.errorReportingEndpointNotFound',
            'Error reporting endpoint not found'
          ),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'DUPLICATE_REPORT',
          i18n.t('handler.error.thisErrorHasAlreadyBeen', 'This error has already been reported'),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.error.validationFailedErrorDetailsAre',
            'Validation failed: error details are incomplete'
          ),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.error.tooManyErrorReportsSubmitted', 'Too many error reports submitted'),
          API_ERROR_REPORT,
          {
            limit: '50/minute',
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
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'REPORT_FAILED',
          i18n.t('handler.error.failedToProcessErrorReport', 'Failed to process error report'),
          API_ERROR_REPORT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.error.errorReportingServiceUnavailable',
            'Error reporting service unavailable'
          ),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.error.errorReportingServiceIsUnder',
            'Error reporting service is under maintenance'
          ),
          API_ERROR_REPORT,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.error.errorReportRequestTimedOut', 'Error report request timed out'),
          API_ERROR_REPORT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_ERROR_REPORT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        reportId: faker.string.uuid(),
        acknowledged: true,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_ERROR_REPORT, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  // ============ ERROR PAGE SPECIFIC HANDLERS ============
  error404PageData: [
    http.get('/api/error/404/suggestions', async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json({
        success: true,
        suggestions: [
          {
            title: i18n.t('handler.error.home', 'Home'),
            path: '/',
            description: i18n.t('handler.error.returnToTheHomepage', 'Return to the homepage'),
          },
          {
            title: i18n.t('handler.error.dashboard', 'Dashboard'),
            path: '/dashboard',
            description: i18n.t('handler.error.goToYourDashboard', 'Go to your dashboard'),
          },
          {
            title: i18n.t('handler.error.helpCenter', 'Help Center'),
            path: '/help',
            description: i18n.t('handler.error.getHelpAndSupport', 'Get help and support'),
          },
        ],
        popularPages: [
          {
            title: i18n.t('handler.error.gettingStarted', 'Getting Started'),
            path: '/docs/getting-started',
          },
          { title: i18n.t('handler.error.apiReference', 'API Reference'), path: '/docs/api' },
          { title: i18n.t('handler.error.contactUs', 'Contact Us'), path: '/contact' },
        ],
      });
    }),
  ],

  error500PageData: [
    http.get('/api/error/500/status', async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json({
        success: true,
        systemStatus: 'degraded',
        estimatedRecovery: new Date(Date.now() + 15 * 60_000).toISOString(),
        affectedServices: ['authentication', 'database'],
        statusPageUrl: 'https://status.example.com',
      });
    }),
  ],

  errorFeedbackSuccess: [
    http.post(API_ERROR_FEEDBACK, async ({ request }) => {
      const body = (await request.json()) as {
        email?: string;
        errorId?: string;
        feedback?: string;
      };
      await delay(faker.number.int({ min: 300, max: 600 }));
      return HttpResponse.json({
        success: true,
        feedbackId: faker.string.uuid(),
        errorId: body.errorId,
        message: i18n.t('handler.error.thankYouForYourFeedback', 'Thank you for your feedback'),
        receivedAt: new Date().toISOString(),
      });
    }),
  ],

  errorFeedbackFailed: [
    http.post(API_ERROR_FEEDBACK, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FEEDBACK_FAILED',
          i18n.t('handler.error.failedToSubmitFeedback', 'Failed to submit feedback'),
          API_ERROR_FEEDBACK
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  errorLogSuccess: [
    http.post(API_ERROR_LOG, async ({ request }) => {
      const body = (await request.json()) as {
        context?: Record<string, unknown>;
        level?: string;
        message?: string;
      };
      await delay(100);
      return HttpResponse.json({
        success: true,
        logId: `log_${Date.now()}`,
        level: body.level ?? 'error',
        indexed: true,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  errorLogFailed: [
    http.post(API_ERROR_LOG, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOG_FAILED',
          i18n.t('handler.error.failedToLogError', 'Failed to log error'),
          API_ERROR_LOG
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  maintenanceMode: [
    http.get('/api/error/maintenance', async () => {
      await delay(200);
      return HttpResponse.json({
        success: true,
        maintenance: true,
        message: i18n.t(
          'handler.error.systemIsUndergoingScheduledMaintenance',
          'System is undergoing scheduled maintenance'
        ),
        startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
        estimatedEnd: new Date(Date.now() + 60 * 60_000).toISOString(),
        statusPageUrl: 'https://status.example.com',
      });
    }),
  ],
};
