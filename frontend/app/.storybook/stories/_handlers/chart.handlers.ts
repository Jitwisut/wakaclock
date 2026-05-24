import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeAreaChartData,
  createFakeBarChartData,
  createFakeChartData,
  createFakeChartStatsCards,
  createFakeGaugeData,
  createFakeMultiSeriesData,
  createFakePieChartData,
  createFakeRadarChartData,
  createFakeScatterData,
  createFakeTimeSeriesData,
} from '../_factories/chart.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_CHARTS = '/api/charts';
const API_CHART_BY_TYPE = '/api/charts/:type';
const API_CHART_STATS = '/api/charts/stats';
const API_CHART_TIMESERIES = '/api/charts/timeseries';

// Default success handlers
export const chartHandlers = [
  // GET /api/charts - Get default chart data
  http.get(API_CHARTS, async ({ request }) => {
    const url = new URL(request.url);
    const points = Number(url.searchParams.get('points') ?? 12);

    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      data: createFakeChartData(points),
      type: 'bar',
    });
  }),

  // GET /api/charts/:type - Get specific chart type data
  http.get(API_CHART_BY_TYPE, async ({ params, request }) => {
    const { type } = params;
    const url = new URL(request.url);
    const points = Number(url.searchParams.get('points') ?? 12);

    await delay(faker.number.int({ min: 200, max: 500 }));

    let data;
    switch (type) {
      case 'bar': {
        data = createFakeBarChartData(points);
        break;
      }
      case 'pie': {
        data = createFakePieChartData(points);
        break;
      }
      case 'area': {
        data = createFakeAreaChartData(points);
        break;
      }
      case 'radar': {
        data = createFakeRadarChartData();
        break;
      }
      case 'scatter': {
        data = createFakeScatterData(points);
        break;
      }
      case 'gauge': {
        data = createFakeGaugeData();
        break;
      }
      case 'multi': {
        data = createFakeMultiSeriesData(points);
        break;
      }
      default: {
        data = createFakeChartData(points);
      }
    }

    return HttpResponse.json({ data, type });
  }),

  // GET /api/charts/stats - Get stats cards
  http.get(API_CHART_STATS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 4);

    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      stats: createFakeChartStatsCards(count),
    });
  }),

  // GET /api/charts/timeseries - Get time series data
  http.get(API_CHART_TIMESERIES, async ({ request }) => {
    const url = new URL(request.url);
    const points = Number(url.searchParams.get('points') ?? 30);

    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      data: createFakeTimeSeriesData(points),
    });
  }),
];

// Status-specific handlers for stories
export const chartStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: chartHandlers,

  // ============ LOADING STATES ============
  loading: [
    http.get(API_CHARTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_CHART_BY_TYPE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_CHART_STATS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_CHARTS, async () => {
      await delay(5000);
      return HttpResponse.json({
        data: createFakeChartData(12),
        type: 'bar',
      });
    }),
    http.get(API_CHART_BY_TYPE, async ({ params }) => {
      await delay(5000);
      return HttpResponse.json({
        data: createFakeChartData(12),
        type: params.type,
      });
    }),
    http.get(API_CHART_STATS, async () => {
      await delay(5000);
      return HttpResponse.json({
        stats: createFakeChartStatsCards(4),
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.chart.invalidChartParameters', 'Invalid chart parameters'),
          API_CHARTS,
          {
            points: i18n.t('handler.chart.mustBeBetween1And', 'Must be between 1 and 100'),
            type: i18n.t('handler.chart.invalidChartType', 'Invalid chart type'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.get(API_CHART_BY_TYPE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_TYPE',
          i18n.t('handler.chart.unsupportedChartType', 'Unsupported chart type'),
          API_CHART_BY_TYPE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.chart.authenticationRequiredToAccessChart',
            'Authentication required to access chart data'
          ),
          API_CHARTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.get(API_CHART_STATS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.chart.authenticationRequiredToAccessStats',
            'Authentication required to access stats'
          ),
          API_CHART_STATS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.chart.insufficientPermissionsToViewChart',
            'Insufficient permissions to view chart data'
          ),
          API_CHARTS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.get(API_CHART_STATS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.chart.premiumSubscriptionRequiredForStats',
            'Premium subscription required for stats'
          ),
          API_CHART_STATS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_CHART_BY_TYPE, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Chart type '${params.type}' not found`,
          `/api/charts/${params.type}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'DATA_CONFLICT',
          i18n.t('handler.chart.chartDataConflictDetected', 'Chart data conflict detected'),
          API_CHARTS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_CHARTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.chart.chartApiRateLimitExceeded', 'Chart API rate limit exceeded'),
          API_CHARTS,
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

  unprocessableEntity: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.chart.chartDataValidationFailed', 'Chart data validation failed'),
          API_CHARTS,
          {
            points: i18n.t(
              'handler.chart.pointsMustBeBetween1',
              'Points must be between 1 and 100'
            ),
            type: i18n.t('handler.chart.invalidChartTypeSpecified', 'Invalid chart type specified'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CHART_SERVICE_ERROR',
          i18n.t('handler.chart.failedToGenerateChartData', 'Failed to generate chart data'),
          API_CHARTS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_CHART_STATS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'STATS_SERVICE_ERROR',
          i18n.t('handler.chart.failedToCalculateStatistics', 'Failed to calculate statistics'),
          API_CHART_STATS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.chart.analyticsServiceUnavailable', 'Analytics service unavailable'),
          API_CHARTS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.chart.chartServiceIsUnderMaintenance',
            'Chart service is under maintenance'
          ),
          API_CHARTS,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.chart.chartDataQueryTimedOut', 'Chart data query timed out'),
          API_CHARTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  networkError: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_CHART_BY_TYPE, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.get(API_CHART_STATS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json({
        data: [],
        type: 'bar',
      });
    }),
    http.get(API_CHART_STATS, async () => {
      await delay(300);
      return HttpResponse.json({
        stats: [],
      });
    }),
  ],

  // Alias for backward compatibility
  get empty() {
    return this.emptyData;
  },

  partialData: [
    http.get(API_CHARTS, async () => {
      await delay(300);
      return HttpResponse.json({
        data: createFakeChartData(3),
        type: 'bar',
        warning: i18n.t(
          'handler.chart.incompleteDataDueToSource',
          'Incomplete data due to source limitations'
        ),
      });
    }),
  ],

  realtimeUpdate: [
    http.get(API_CHART_TIMESERIES, async () => {
      await delay(1000);
      return HttpResponse.json({
        data: createFakeTimeSeriesData(30),
        nextUpdate: new Date(Date.now() + 5000).toISOString(),
      });
    }),
  ],
};
