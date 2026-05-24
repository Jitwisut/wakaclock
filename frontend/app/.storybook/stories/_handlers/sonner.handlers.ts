import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SONNER_SHOW = '/api/sonner/show';
const API_SONNER_DISMISS = '/api/sonner/dismiss';
const API_SONNER_HISTORY = '/api/sonner/history';

// Default success handlers
export const sonnerHandlers = [
  // POST /api/sonner/show - Show a toast notification
  http.post(API_SONNER_SHOW, async ({ request }) => {
    const body = (await request.json()) as {
      description?: string;
      title: string;
      type?: 'error' | 'info' | 'success' | 'warning';
    };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      toastId: faker.string.uuid(),
      type: body.type ?? 'info',
      title: body.title,
      description: body.description,
      shownAt: new Date().toISOString(),
    });
  }),

  // POST /api/sonner/dismiss - Dismiss a toast
  http.post(API_SONNER_DISMISS, async ({ request }) => {
    const body = (await request.json()) as { toastId: string };
    await delay(faker.number.int({ min: 50, max: 100 }));

    return HttpResponse.json({
      success: true,
      toastId: body.toastId,
      dismissedAt: new Date().toISOString(),
    });
  }),

  // GET /api/sonner/history - Get toast history
  http.get(API_SONNER_HISTORY, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 100, max: 300 }));

    const history = Array.from({ length: limit }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['success', 'error', 'warning', 'info']),
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
      timestamp: faker.date.recent().toISOString(),
      dismissed: faker.datatype.boolean({ probability: 0.7 }),
    }));

    return HttpResponse.json({
      history,
      total: history.length,
    });
  }),
];

// Status-specific handlers for stories
export const sonnerStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: sonnerHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_TOAST',
          i18n.t('handler.sonner.invalidToastConfiguration', 'Invalid toast configuration'),
          API_SONNER_SHOW,
          { title: i18n.t('handler.sonner.titleIsRequired', 'Title is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SONNER_HISTORY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.sonner.authenticationRequiredToViewToast',
            'Authentication required to view toast history'
          ),
          API_SONNER_HISTORY
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.sonner.toastNotificationsAreDisabled',
            'Toast notifications are disabled'
          ),
          API_SONNER_SHOW
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_SONNER_DISMISS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'TOAST_NOT_FOUND',
          i18n.t('handler.sonner.toastNotFoundOrAlready', 'Toast not found or already dismissed'),
          API_SONNER_DISMISS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'TOAST_LIMIT',
          i18n.t('handler.sonner.maximumNumberOfToastsReached', 'Maximum number of toasts reached'),
          API_SONNER_SHOW
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.sonner.invalidToastContent', 'Invalid toast content'),
          API_SONNER_SHOW,
          { type: i18n.t('handler.sonner.unknownToastType', 'Unknown toast type') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.sonner.tooManyToastNotifications', 'Too many toast notifications'),
          API_SONNER_SHOW,
          { retryAfter: '5' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'TOAST_FAILED',
          i18n.t(
            'handler.sonner.failedToShowToastNotification',
            'Failed to show toast notification'
          ),
          API_SONNER_SHOW,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SONNER_HISTORY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.sonner.toastServiceTemporarilyUnavailable',
            'Toast service temporarily unavailable'
          ),
          API_SONNER_HISTORY
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.sonner.toastServiceIsUnderMaintenance',
            'Toast service is under maintenance'
          ),
          API_SONNER_SHOW,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SONNER_HISTORY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.sonner.toastHistoryRequestTimedOut', 'Toast history request timed out'),
          API_SONNER_HISTORY
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SONNER_HISTORY, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        toastId: faker.string.uuid(),
        shownAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_SONNER_SHOW, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SONNER_HISTORY, async () => {
      await delay(200);
      return HttpResponse.json({
        history: [],
        total: 0,
      });
    }),
  ],
};
