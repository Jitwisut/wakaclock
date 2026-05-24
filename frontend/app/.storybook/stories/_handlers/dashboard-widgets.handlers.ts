import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD WIDGETS HANDLERS
// Enterprise-grade MSW handlers for dashboard widgets pages (analytics, ecommerce, fitness)
// ============================================================================

// API Endpoints
const API_WIDGETS = '/api/dashboard/widgets';
const API_WIDGETS_ANALYTICS = '/api/dashboard/widgets/analytics';
const API_WIDGETS_ECOMMERCE = '/api/dashboard/widgets/ecommerce';
const API_WIDGETS_FITNESS = '/api/dashboard/widgets/fitness';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardWidgetsHandlers = [
  http.get(API_WIDGETS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      availableWidgets: ['analytics', 'ecommerce', 'fitness'],
      activeWidgets: faker.number.int({ min: 3, max: 10 }),
      lastUpdated: new Date().toISOString(),
    });
  }),

  // Analytics Widgets
  http.get(API_WIDGETS_ANALYTICS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      realTimeUsers: faker.number.int({ min: 100, max: 1000 }),
      pageViewsToday: faker.number.int({ min: 5000, max: 50_000 }),
      bounceRate: faker.number.float({ min: 30, max: 70, fractionDigits: 1 }),
      avgSessionDuration: `${faker.number.int({ min: 1, max: 5 })}m ${faker.number.int({ min: 0, max: 59 })}s`,
      topPages: [
        { path: '/', views: faker.number.int({ min: 1000, max: 10_000 }) },
        { path: '/products', views: faker.number.int({ min: 500, max: 5000 }) },
        { path: '/blog', views: faker.number.int({ min: 300, max: 3000 }) },
      ],
      trafficSources: [
        { source: i18n.t('handler.dashboardWidgets.organic', 'Organic'), percentage: 45 },
        { source: i18n.t('handler.dashboardWidgets.direct', 'Direct'), percentage: 30 },
        { source: i18n.t('handler.dashboardWidgets.social', 'Social'), percentage: 15 },
        { source: i18n.t('handler.dashboardWidgets.referral', 'Referral'), percentage: 10 },
      ],
      hourlyTraffic: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        visitors: faker.number.int({ min: 50, max: 500 }),
      })),
    });
  }),

  // E-commerce Widgets
  http.get(API_WIDGETS_ECOMMERCE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      todayRevenue: faker.number.float({ min: 5000, max: 50_000, fractionDigits: 2 }),
      todayOrders: faker.number.int({ min: 50, max: 500 }),
      pendingOrders: faker.number.int({ min: 10, max: 100 }),
      lowStockItems: faker.number.int({ min: 5, max: 30 }),
      topSellingProducts: Array.from({ length: 5 }, () => ({
        name: faker.commerce.productName(),
        sales: faker.number.int({ min: 10, max: 100 }),
        revenue: faker.number.float({ min: 500, max: 5000, fractionDigits: 2 }),
      })),
      recentOrders: Array.from({ length: 5 }, () => ({
        id: `ORD-${faker.string.numeric(6)}`,
        customer: faker.person.fullName(),
        total: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
        status: faker.helpers.arrayElement(['pending', 'processing', 'shipped']),
      })),
      salesChart: Array.from({ length: 7 }, (_, i) => ({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
        sales: faker.number.float({ min: 2000, max: 10_000, fractionDigits: 2 }),
      })),
    });
  }),

  // Fitness Widgets
  http.get(API_WIDGETS_FITNESS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      todaySteps: faker.number.int({ min: 2000, max: 15_000 }),
      stepsGoal: 10_000,
      caloriesBurned: faker.number.int({ min: 500, max: 3000 }),
      caloriesGoal: 2500,
      activeMinutes: faker.number.int({ min: 15, max: 120 }),
      activeGoal: 60,
      heartRate: faker.number.int({ min: 60, max: 100 }),
      sleepHours: faker.number.float({ min: 5, max: 9, fractionDigits: 1 }),
      waterIntake: faker.number.int({ min: 4, max: 12 }),
      weeklyActivity: Array.from({ length: 7 }, (_, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        steps: faker.number.int({ min: 3000, max: 15_000 }),
        calories: faker.number.int({ min: 1500, max: 3000 }),
        activeMinutes: faker.number.int({ min: 20, max: 90 }),
      })),
      workoutHistory: Array.from({ length: 5 }, () => ({
        type: faker.helpers.arrayElement([
          i18n.t('handler.dashboardWidgets.running', 'Running'),
          i18n.t('handler.dashboardWidgets.cycling', 'Cycling'),
          i18n.t('handler.dashboardWidgets.swimming', 'Swimming'),
          i18n.t('handler.dashboardWidgets.yoga', 'Yoga'),
          i18n.t('handler.dashboardWidgets.weightlifting', 'Weightlifting'),
        ]),
        duration: faker.number.int({ min: 15, max: 90 }),
        calories: faker.number.int({ min: 100, max: 500 }),
        date: faker.date.recent().toISOString(),
      })),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardWidgetsStatusHandlers = {
  success: dashboardWidgetsHandlers,
  badRequest: [
    http.get(API_WIDGETS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardWidgets.invalidRequestParameters', 'Invalid request parameters'),
          API_WIDGETS,
          {
            field: 'data',
            error: i18n.t('handler.dashboardWidgets.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_WIDGETS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardWidgets.authenticationRequired', 'Authentication required'),
          API_WIDGETS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_WIDGETS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t('handler.dashboardWidgets.accessToWidgetsDenied', 'Access to widgets denied'),
          API_WIDGETS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_WIDGETS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardWidgets.requestValidationFailed', 'Request validation failed'),
          API_WIDGETS,
          {
            field: 'data',
            error: i18n.t('handler.dashboardWidgets.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_WIDGETS_ANALYTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardWidgets.failedToLoadAnalyticsWidgets',
            'Failed to load analytics widgets'
          ),
          API_WIDGETS_ANALYTICS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_WIDGETS_ANALYTICS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_WIDGETS_ECOMMERCE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_WIDGETS_FITNESS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_WIDGETS, () => HttpResponse.error())],
  emptyData: [
    http.get(API_WIDGETS_ECOMMERCE, async () => {
      await delay(100);
      return HttpResponse.json({
        todayRevenue: 0,
        todayOrders: 0,
        pendingOrders: 0,
        lowStockItems: 0,
        topSellingProducts: [],
        recentOrders: [],
        salesChart: [],
      });
    }),
  ],
};
