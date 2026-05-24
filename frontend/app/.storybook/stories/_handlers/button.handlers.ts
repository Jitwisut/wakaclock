import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_BUTTON_ACTION = '/api/button/action';
const API_BUTTON_SUBMIT = '/api/button/submit';
const API_PAYMENT_PROCESS = '/api/payment/process';

// Default success handlers
export const buttonHandlers = [
  // POST /api/button/action - Generic button action
  http.post(API_BUTTON_ACTION, async ({ request }) => {
    const body = (await request.json()) as { action?: string };
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({
      success: true,
      action: body.action ?? 'click',
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/button/submit - Form submit action
  http.post(API_BUTTON_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      data: body,
      id: faker.string.uuid(),
      timestamp: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const buttonStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: buttonHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.button.invalidButtonActionSpecified', 'Invalid button action specified'),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.button.authenticationRequiredForThisAction',
            'Authentication required for this action'
          ),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.button.youDoNotHavePermission',
            'You do not have permission to perform this action'
          ),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.button.resourceNotFound', 'Resource not found'),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t('handler.button.resourceAlreadyExists', 'Resource already exists'),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.button.validationFailedActionFieldIs',
            'Validation failed: action field is invalid'
          ),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.button.tooManyRequests', 'Too many requests'),
          API_BUTTON_ACTION,
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
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ACTION_FAILED',
          i18n.t('handler.button.failedToProcessButtonAction', 'Failed to process button action'),
          API_BUTTON_ACTION,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.button.actionServiceUnavailable', 'Action service unavailable'),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.button.serviceIsUnderMaintenance', 'Service is under maintenance'),
          API_BUTTON_ACTION,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.button.requestTimedOut', 'Request timed out'),
          API_BUTTON_ACTION
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        action: 'click',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_BUTTON_ACTION, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  // ============ ANALYTICS TRACKING ============
  analyticsSuccess: [
    http.post('/api/analytics/track', async ({ request }) => {
      const body = await request.json();
      await delay(100);
      return HttpResponse.json({
        success: true,
        eventId: `evt_${Date.now()}`,
        receivedAt: new Date().toISOString(),
        data: body,
      });
    }),
  ],

  analyticsError: [
    http.post('/api/analytics/track', async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ANALYTICS_ERROR',
          i18n.t('handler.button.failedToTrackEvent', 'Failed to track event'),
          '/api/analytics/track'
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // ============ PAYMENT HANDLERS ============
  paymentSuccess: [
    http.post(API_PAYMENT_PROCESS, async ({ request }) => {
      const body = (await request.json()) as { amount?: number };
      await delay(2000);
      return HttpResponse.json({
        success: true,
        transactionId: `txn_${Date.now()}`,
        amount: body?.amount ?? 0,
        currency: 'USD',
        status: 'completed',
        processedAt: new Date().toISOString(),
      });
    }),
  ],

  paymentDeclined: [
    http.post(API_PAYMENT_PROCESS, async () => {
      await delay(1500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'PAYMENT_DECLINED',
          i18n.t('handler.button.cardWasDeclined', 'Card was declined'),
          API_PAYMENT_PROCESS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  paymentTimeout: [
    http.post(API_PAYMENT_PROCESS, async () => {
      await delay(30_000);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'PAYMENT_TIMEOUT',
          i18n.t('handler.button.paymentProcessingTimedOut', 'Payment processing timed out'),
          API_PAYMENT_PROCESS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ FORM SUBMISSION ============
  formSubmitSuccess: [
    http.post('/api/form/submit', async ({ request }) => {
      const body = await request.json();
      await delay(1000);
      return HttpResponse.json({
        success: true,
        submissionId: `sub_${Date.now()}`,
        data: body,
        submittedAt: new Date().toISOString(),
      });
    }),
  ],

  formSubmitValidationError: [
    http.post('/api/form/submit', async () => {
      await delay(500);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.BAD_REQUEST,
            'VALIDATION_ERROR',
            i18n.t('handler.button.formValidationFailed', 'Form validation failed'),
            '/api/form/submit'
          ),
          errors: {
            email: i18n.t('handler.button.invalidEmailFormat', 'Invalid email format'),
            password: i18n.t(
              'handler.button.passwordMustBeAtLeast',
              'Password must be at least 8 characters'
            ),
          },
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
};
