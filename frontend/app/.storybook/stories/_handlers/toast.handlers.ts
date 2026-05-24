import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TOAST_SHOW = '/api/toast/show';
const API_TOAST_DISMISS = '/api/toast/dismiss';
const API_TOAST_QUEUE = '/api/toast/queue';
const API_TOAST_CONFIG = '/api/toast/config';

// Default success handlers
export const toastHandlers = [
  // POST /api/toast/show - Show a toast
  http.post(API_TOAST_SHOW, async ({ request }) => {
    const body = (await request.json()) as {
      action?: { label: string; onClick: string };
      description?: string;
      title: string;
      variant?: 'default' | 'destructive';
    };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      toastId: faker.string.uuid(),
      variant: body.variant ?? 'default',
      title: body.title,
      description: body.description,
      action: body.action,
      shownAt: new Date().toISOString(),
      duration: faker.number.int({ min: 3000, max: 10_000 }),
    });
  }),

  // POST /api/toast/dismiss - Dismiss a toast
  http.post(API_TOAST_DISMISS, async ({ request }) => {
    const body = (await request.json()) as { all?: boolean; toastId?: string };
    await delay(faker.number.int({ min: 50, max: 100 }));

    return HttpResponse.json({
      success: true,
      dismissedIds: body.all
        ? Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.string.uuid())
        : [body.toastId],
      dismissedAt: new Date().toISOString(),
    });
  }),

  // GET /api/toast/queue - Get toast queue
  http.get(API_TOAST_QUEUE, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    const queue = Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
      id: faker.string.uuid(),
      variant: faker.helpers.arrayElement(['default', 'destructive']),
      title: faker.lorem.sentence({ min: 2, max: 5 }),
      description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
      createdAt: faker.date.recent().toISOString(),
      duration: faker.number.int({ min: 3000, max: 10_000 }),
    }));

    return HttpResponse.json({
      queue,
      total: queue.length,
      maxVisible: 3,
    });
  }),

  // GET /api/toast/config - Get toast configuration
  http.get(API_TOAST_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      position: faker.helpers.arrayElement([
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]),
      maxVisible: faker.number.int({ min: 1, max: 5 }),
      defaultDuration: faker.number.int({ min: 3000, max: 10_000 }),
      swipeDirection: faker.helpers.arrayElement(['left', 'right', 'up', 'down']),
      closeButton: faker.datatype.boolean({ probability: 0.7 }),
    });
  }),
];

// Status-specific handlers for stories
export const toastStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: toastHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_TOAST',
          i18n.t('handler.toast.invalidToastConfiguration', 'Invalid toast configuration'),
          API_TOAST_SHOW,
          { title: i18n.t('handler.toast.titleIsRequired', 'Title is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_TOAST_QUEUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.toast.authenticationRequired', 'Authentication required'),
          API_TOAST_QUEUE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.toast.toastNotificationsAreDisabledFor',
            'Toast notifications are disabled for this user'
          ),
          API_TOAST_SHOW
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_TOAST_DISMISS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'TOAST_NOT_FOUND',
          i18n.t('handler.toast.toastNotFoundOrAlready', 'Toast not found or already dismissed'),
          API_TOAST_DISMISS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'QUEUE_FULL',
          i18n.t('handler.toast.toastQueueIsFull', 'Toast queue is full'),
          API_TOAST_SHOW
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.toast.invalidToastData', 'Invalid toast data'),
          API_TOAST_SHOW,
          { variant: i18n.t('handler.toast.unknownToastVariant', 'Unknown toast variant') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.toast.tooManyToastNotifications', 'Too many toast notifications'),
          API_TOAST_SHOW,
          { retryAfter: '5' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'TOAST_FAILED',
          i18n.t('handler.toast.failedToShowToast', 'Failed to show toast'),
          API_TOAST_SHOW,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TOAST_QUEUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.toast.toastServiceTemporarilyUnavailable',
            'Toast service temporarily unavailable'
          ),
          API_TOAST_QUEUE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.toast.toastServiceIsUnderMaintenance',
            'Toast service is under maintenance'
          ),
          API_TOAST_SHOW,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_TOAST_QUEUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.toast.toastQueueRequestTimedOut', 'Toast queue request timed out'),
          API_TOAST_QUEUE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TOAST_QUEUE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        toastId: faker.string.uuid(),
        shownAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_TOAST_SHOW, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TOAST_QUEUE, async () => {
      await delay(200);
      return HttpResponse.json({
        queue: [],
        total: 0,
        maxVisible: 3,
      });
    }),
  ],
};
