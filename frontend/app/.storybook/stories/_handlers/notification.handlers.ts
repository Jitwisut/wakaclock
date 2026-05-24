import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeNotifications,
  createFakeNotificationsResponse,
} from '../_factories/notification.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_NOTIFICATIONS = '/api/notifications';
const API_NOTIFICATION_BY_ID = '/api/notifications/:id';
const API_NOTIFICATION_READ = '/api/notifications/:id/read';
const API_NOTIFICATIONS_READ_ALL = '/api/notifications/read-all';
const API_NOTIFICATIONS_UNREAD_COUNT = '/api/notifications/unread-count';

// Default success handlers
export const notificationHandlers = [
  // GET /api/notifications
  http.get(API_NOTIFICATIONS, async () => {
    await delay(faker.number.int({ min: 200, max: 600 }));
    return HttpResponse.json(createFakeNotificationsResponse());
  }),

  // GET /api/notifications/:id
  http.get(API_NOTIFICATION_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 150, max: 400 }));
    const [notification] = createFakeNotifications(1);
    return HttpResponse.json({ ...notification, id: params.id });
  }),

  // POST /api/notifications/:id/read
  http.post(API_NOTIFICATION_READ, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json({ success: true });
  }),

  // POST /api/notifications/read-all
  http.post(API_NOTIFICATIONS_READ_ALL, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({ success: true, count: faker.number.int({ min: 1, max: 20 }) });
  }),

  // DELETE /api/notifications/:id
  http.delete(API_NOTIFICATION_BY_ID, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // DELETE /api/notifications (clear all)
  http.delete(API_NOTIFICATIONS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/notifications/unread-count
  http.get(API_NOTIFICATIONS_UNREAD_COUNT, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json({ count: faker.number.int({ min: 0, max: 25 }) });
  }),
];

// Status-specific handlers for stories
export const notificationStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: notificationHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_NOTIFICATION_READ, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ID',
          i18n.t(
            'handler.notification.invalidNotificationIdFormat',
            'Invalid notification ID format'
          ),
          API_NOTIFICATION_READ
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.notification.pleaseLogInToView', 'Please log in to view notifications'),
          API_NOTIFICATIONS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.delete(API_NOTIFICATION_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.notification.cannotDeleteSystemNotifications',
            'Cannot delete system notifications'
          ),
          API_NOTIFICATION_BY_ID
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_NOTIFICATION_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Notification ${params.id} not found`,
          `/api/notifications/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.post(API_NOTIFICATION_READ, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Notification ${params.id} not found`,
          `/api/notifications/${params.id}/read`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.delete(API_NOTIFICATION_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Notification ${params.id} not found`,
          `/api/notifications/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.notification.requestValidationFailed', 'Request validation failed'),
          API_NOTIFICATIONS,
          {
            field: 'data',
            error: i18n.t('handler.notification.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.notification.tooManyRequests', 'Too many requests'),
          API_NOTIFICATIONS,
          {
            limit: '60/minute',
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
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_ERROR',
          i18n.t(
            'handler.notification.failedToFetchNotifications',
            'Failed to fetch notifications'
          ),
          API_NOTIFICATIONS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.notification.notificationServiceUnavailable',
            'Notification service unavailable'
          ),
          API_NOTIFICATIONS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.notification.notificationServiceUnderMaintenance',
            'Notification service under maintenance'
          ),
          API_NOTIFICATIONS,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.notification.requestTimedOut', 'Request timed out'),
          API_NOTIFICATIONS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(5000);
      return HttpResponse.json(createFakeNotificationsResponse());
    }),
  ],

  networkError: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  empty: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      return HttpResponse.json({ notifications: [], unreadCount: 0, total: 0 });
    }),
  ],

  // Alias for consistency
  get emptyData() {
    return this.empty;
  },

  manyUnread: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      const notifications = createFakeNotifications(25).map((n) => ({ ...n, read: false }));
      return HttpResponse.json({ notifications, unreadCount: 25, total: 25 });
    }),
  ],

  allRead: [
    http.get(API_NOTIFICATIONS, async () => {
      await delay(300);
      const notifications = createFakeNotifications(10).map((n) => ({ ...n, read: true }));
      return HttpResponse.json({ notifications, unreadCount: 0, total: 10 });
    }),
  ],
};
