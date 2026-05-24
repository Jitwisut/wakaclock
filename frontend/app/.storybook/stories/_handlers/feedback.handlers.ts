import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeSkeleton,
  createFakeSonnerToast,
  createFakeSpinner,
  createFakeToastItem,
} from '../_factories/feedback.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TOASTS = '/api/toasts';
const API_NOTIFICATIONS = '/api/feedback/notifications';
const API_LOADING_STATE = '/api/feedback/loading';

// Default success handlers
export const feedbackHandlers = [
  // GET /api/toasts - Fetch toast notifications
  http.get(API_TOASTS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);
    await delay(faker.number.int({ min: 200, max: 500 }));

    const toasts = Array.from({ length: count }, () => createFakeToastItem());
    return HttpResponse.json({ toasts, total: toasts.length });
  }),

  // POST /api/toasts - Create toast notification
  http.post(API_TOASTS, async ({ request }) => {
    const body = (await request.json()) as Partial<ReturnType<typeof createFakeToastItem>>;
    await delay(faker.number.int({ min: 200, max: 400 }));

    const toast = createFakeToastItem(body);
    return HttpResponse.json({ toast }, { status: 201 });
  }),

  // GET /api/feedback/notifications - Sonner notifications
  http.get(API_NOTIFICATIONS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 3);
    await delay(faker.number.int({ min: 200, max: 500 }));

    const notifications = Array.from({ length: count }, () => createFakeSonnerToast());
    return HttpResponse.json({ notifications, total: notifications.length });
  }),

  // GET /api/feedback/loading - Loading state data
  http.get(API_LOADING_STATE, async ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'spinner';
    await delay(faker.number.int({ min: 200, max: 500 }));

    if (type === 'skeleton') {
      const skeletons = Array.from({ length: 5 }, () => createFakeSkeleton());
      return HttpResponse.json({ skeletons });
    }

    const spinner = createFakeSpinner();
    return HttpResponse.json({ spinner });
  }),
];

// Status-specific handlers for stories
export const feedbackStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: feedbackHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.feedback.invalidToastParameters', 'Invalid toast parameters'),
          API_TOASTS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.feedback.authenticationRequired', 'Authentication required'),
          API_TOASTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.feedback.accessDeniedToNotifications', 'Access denied to notifications'),
          API_TOASTS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.feedback.toastNotFound', 'Toast not found'),
          API_TOASTS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.feedback.requestValidationFailed', 'Request validation failed'),
          API_TOASTS,
          {
            field: 'data',
            error: i18n.t('handler.feedback.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_TOASTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.feedback.tooManyRequests', 'Too many requests'),
          API_TOASTS,
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
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.feedback.failedToFetchNotifications', 'Failed to fetch notifications'),
          API_TOASTS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.feedback.notificationServiceUnavailable',
            'Notification service unavailable'
          ),
          API_TOASTS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.feedback.serviceUnderMaintenance', 'Service under maintenance'),
          API_TOASTS,
          {
            retryAfter: '120',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.feedback.requestTimedOut', 'Request timed out'),
          API_TOASTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TOASTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_TOASTS, async () => {
      await delay(5000);
      const toasts = Array.from({ length: 3 }, () => createFakeToastItem());
      return HttpResponse.json({ toasts, total: toasts.length });
    }),
  ],

  networkError: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TOASTS, async () => {
      await delay(300);
      return HttpResponse.json({ toasts: [], total: 0 });
    }),
  ],
};
