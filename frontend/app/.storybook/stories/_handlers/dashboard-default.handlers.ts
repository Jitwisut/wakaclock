import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD DEFAULT HANDLERS
// Enterprise-grade MSW handlers for default dashboard page
// ============================================================================

// API Endpoints
const API_DASHBOARD = '/api/dashboard';
const API_DASHBOARD_STATS = '/api/dashboard/stats';
const API_DASHBOARD_RECENT = '/api/dashboard/recent';
const API_DASHBOARD_ACTIVITY = '/api/dashboard/activity';
const API_DASHBOARD_NOTIFICATIONS = '/api/dashboard/notifications';
const API_DASHBOARD_WIDGETS = '/api/dashboard/widgets';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardDefaultHandlers = [
  http.get(API_DASHBOARD, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalUsers: faker.number.int({ min: 1000, max: 50_000 }),
      activeUsers: faker.number.int({ min: 500, max: 10_000 }),
      totalRevenue: faker.number.int({ min: 100_000, max: 1_000_000 }),
      newOrders: faker.number.int({ min: 50, max: 500 }),
      conversionRate: faker.number.float({ min: 2, max: 15, fractionDigits: 1 }),
      growthRate: faker.number.float({ min: -5, max: 25, fractionDigits: 1 }),
    });
  }),

  http.get(API_DASHBOARD_STATS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const chartData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
      revenue: faker.number.int({ min: 50_000, max: 150_000 }),
      orders: faker.number.int({ min: 200, max: 800 }),
      users: faker.number.int({ min: 100, max: 500 }),
    }));
    return HttpResponse.json({ chartData });
  }),

  http.get(API_DASHBOARD_RECENT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const recentItems = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['order', 'user', 'product', 'review']),
      title: faker.commerce.productName(),
      description: faker.lorem.sentence(),
      timestamp: faker.date.recent().toISOString(),
      status: faker.helpers.arrayElement(['pending', 'completed', 'processing']),
    }));
    return HttpResponse.json({ items: recentItems });
  }),

  http.get(API_DASHBOARD_ACTIVITY, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const activities = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      user: faker.person.fullName(),
      avatar: faker.image.avatar(),
      action: faker.helpers.arrayElement([
        'created',
        'updated',
        'deleted',
        'commented',
        'approved',
      ]),
      target: faker.helpers.arrayElement(['order', 'product', 'user', 'post']),
      targetId: faker.string.uuid(),
      timestamp: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ activities });
  }),

  http.get(API_DASHBOARD_NOTIFICATIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const notifications = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['info', 'warning', 'success', 'error']),
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      message: faker.lorem.sentence(),
      read: faker.datatype.boolean(),
      timestamp: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  }),

  http.get(API_DASHBOARD_WIDGETS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const widgets = [
      {
        id: 'revenue',
        title: i18n.t('handler.dashboardDefault.revenue', 'Revenue'),
        enabled: true,
        position: 0,
      },
      {
        id: 'users',
        title: i18n.t('handler.dashboardDefault.users', 'Users'),
        enabled: true,
        position: 1,
      },
      {
        id: 'orders',
        title: i18n.t('handler.dashboardDefault.orders', 'Orders'),
        enabled: true,
        position: 2,
      },
      {
        id: 'activity',
        title: i18n.t('handler.dashboardDefault.activity', 'Activity'),
        enabled: true,
        position: 3,
      },
      {
        id: 'chart',
        title: i18n.t('handler.dashboardDefault.analytics', 'Analytics'),
        enabled: true,
        position: 4,
      },
    ];
    return HttpResponse.json({ widgets });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardDefaultStatusHandlers = {
  success: dashboardDefaultHandlers,
  badRequest: [
    http.get(API_DASHBOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardDefault.invalidRequestParameters', 'Invalid request parameters'),
          API_DASHBOARD,
          {
            field: 'data',
            error: i18n.t('handler.dashboardDefault.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_DASHBOARD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardDefault.authenticationRequired', 'Authentication required'),
          API_DASHBOARD
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_DASHBOARD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t('handler.dashboardDefault.accessToDashboardDenied', 'Access to dashboard denied'),
          API_DASHBOARD
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_DASHBOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardDefault.requestValidationFailed', 'Request validation failed'),
          API_DASHBOARD,
          {
            field: 'data',
            error: i18n.t('handler.dashboardDefault.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_DASHBOARD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.dashboardDefault.failedToLoadDashboard', 'Failed to load dashboard'),
          API_DASHBOARD
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_DASHBOARD, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_DASHBOARD, () => HttpResponse.error())],
  emptyData: [
    http.get(API_DASHBOARD_RECENT, async () => {
      await delay(100);
      return HttpResponse.json({ items: [] });
    }),
  ],
};
