import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD ANALYTICS HANDLERS
// Enterprise-grade MSW handlers for website analytics dashboard page
// ============================================================================

// API Endpoints
const API_ANALYTICS = '/api/dashboard/analytics';
const API_ANALYTICS_VISITORS = '/api/dashboard/analytics/visitors';
const API_ANALYTICS_PAGEVIEWS = '/api/dashboard/analytics/pageviews';
const API_ANALYTICS_SOURCES = '/api/dashboard/analytics/sources';
const API_ANALYTICS_DEVICES = '/api/dashboard/analytics/devices';
const API_ANALYTICS_PAGES = '/api/dashboard/analytics/pages';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardAnalyticsHandlers = [
  http.get(API_ANALYTICS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalVisitors: faker.number.int({ min: 10_000, max: 100_000 }),
      uniqueVisitors: faker.number.int({ min: 5000, max: 50_000 }),
      pageViews: faker.number.int({ min: 50_000, max: 500_000 }),
      bounceRate: faker.number.float({ min: 30, max: 70, fractionDigits: 1 }),
      avgSessionDuration: faker.number.int({ min: 60, max: 300 }),
      pagesPerSession: faker.number.float({ min: 1.5, max: 5, fractionDigits: 1 }),
    });
  }),

  http.get(API_ANALYTICS_VISITORS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const visitorData = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      visitors: faker.number.int({ min: 500, max: 5000 }),
      uniqueVisitors: faker.number.int({ min: 300, max: 3000 }),
      newVisitors: faker.number.int({ min: 100, max: 1000 }),
      returningVisitors: faker.number.int({ min: 200, max: 2000 }),
    }));
    return HttpResponse.json({ visitorData });
  }),

  http.get(API_ANALYTICS_PAGEVIEWS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      pageViews: faker.number.int({ min: 100, max: 2000 }),
    }));
    return HttpResponse.json({ hourlyData });
  }),

  http.get(API_ANALYTICS_SOURCES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const sources = [
      {
        name: i18n.t('handler.dashboardAnalytics.organicSearch', 'Organic Search'),
        visitors: faker.number.int({ min: 3000, max: 30_000 }),
        percentage: 40,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.direct', 'Direct'),
        visitors: faker.number.int({ min: 2000, max: 20_000 }),
        percentage: 25,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.socialMedia', 'Social Media'),
        visitors: faker.number.int({ min: 1500, max: 15_000 }),
        percentage: 20,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.referral', 'Referral'),
        visitors: faker.number.int({ min: 500, max: 5000 }),
        percentage: 10,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.email', 'Email'),
        visitors: faker.number.int({ min: 300, max: 3000 }),
        percentage: 5,
      },
    ];
    return HttpResponse.json({ sources });
  }),

  http.get(API_ANALYTICS_DEVICES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const devices = [
      {
        type: i18n.t('handler.dashboardAnalytics.desktop', 'Desktop'),
        sessions: faker.number.int({ min: 3000, max: 30_000 }),
        percentage: 55,
      },
      {
        type: i18n.t('handler.dashboardAnalytics.mobile', 'Mobile'),
        sessions: faker.number.int({ min: 2500, max: 25_000 }),
        percentage: 35,
      },
      {
        type: i18n.t('handler.dashboardAnalytics.tablet', 'Tablet'),
        sessions: faker.number.int({ min: 500, max: 5000 }),
        percentage: 10,
      },
    ];
    const browsers = [
      {
        name: i18n.t('handler.dashboardAnalytics.chrome', 'Chrome'),
        sessions: faker.number.int({ min: 4000, max: 40_000 }),
        percentage: 65,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.safari', 'Safari'),
        sessions: faker.number.int({ min: 1500, max: 15_000 }),
        percentage: 20,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.firefox', 'Firefox'),
        sessions: faker.number.int({ min: 500, max: 5000 }),
        percentage: 10,
      },
      {
        name: i18n.t('handler.dashboardAnalytics.edge', 'Edge'),
        sessions: faker.number.int({ min: 200, max: 2000 }),
        percentage: 5,
      },
    ];
    return HttpResponse.json({ devices, browsers });
  }),

  http.get(API_ANALYTICS_PAGES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const topPages = [
      {
        path: '/',
        title: i18n.t('handler.dashboardAnalytics.home', 'Home'),
        views: faker.number.int({ min: 10_000, max: 50_000 }),
        avgTime: faker.number.int({ min: 30, max: 180 }),
      },
      {
        path: '/products',
        title: i18n.t('handler.dashboardAnalytics.products', 'Products'),
        views: faker.number.int({ min: 5000, max: 25_000 }),
        avgTime: faker.number.int({ min: 60, max: 240 }),
      },
      {
        path: '/about',
        title: i18n.t('handler.dashboardAnalytics.aboutUs', 'About Us'),
        views: faker.number.int({ min: 2000, max: 10_000 }),
        avgTime: faker.number.int({ min: 45, max: 120 }),
      },
      {
        path: '/contact',
        title: i18n.t('handler.dashboardAnalytics.contact', 'Contact'),
        views: faker.number.int({ min: 1000, max: 5000 }),
        avgTime: faker.number.int({ min: 30, max: 90 }),
      },
      {
        path: '/blog',
        title: i18n.t('handler.dashboardAnalytics.blog', 'Blog'),
        views: faker.number.int({ min: 3000, max: 15_000 }),
        avgTime: faker.number.int({ min: 90, max: 300 }),
      },
    ];
    return HttpResponse.json({ topPages });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardAnalyticsStatusHandlers = {
  success: dashboardAnalyticsHandlers,
  badRequest: [
    http.get(API_ANALYTICS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.dashboardAnalytics.invalidRequestParameters',
            'Invalid request parameters'
          ),
          API_ANALYTICS,
          {
            field: 'data',
            error: i18n.t('handler.dashboardAnalytics.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ANALYTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardAnalytics.authenticationRequired', 'Authentication required'),
          API_ANALYTICS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_ANALYTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardAnalytics.accessToAnalyticsDashboardDenied',
            'Access to analytics dashboard denied'
          ),
          API_ANALYTICS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_ANALYTICS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardAnalytics.requestValidationFailed', 'Request validation failed'),
          API_ANALYTICS,
          {
            field: 'data',
            error: i18n.t('handler.dashboardAnalytics.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_ANALYTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardAnalytics.failedToLoadAnalyticsDashboard',
            'Failed to load analytics dashboard'
          ),
          API_ANALYTICS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_ANALYTICS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_ANALYTICS, () => HttpResponse.error())],
  emptyData: [
    http.get(API_ANALYTICS_VISITORS, async () => {
      await delay(100);
      return HttpResponse.json({ visitorData: [] });
    }),
  ],
};
