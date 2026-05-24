import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD SALES HANDLERS
// Enterprise-grade MSW handlers for sales dashboard page
// ============================================================================

// API Endpoints
const API_SALES = '/api/dashboard/sales';
const API_SALES_REVENUE = '/api/dashboard/sales/revenue';
const API_SALES_ORDERS = '/api/dashboard/sales/orders';
const API_SALES_PRODUCTS = '/api/dashboard/sales/products';
const API_SALES_REGIONS = '/api/dashboard/sales/regions';
const API_SALES_REPS = '/api/dashboard/sales/reps';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardSalesHandlers = [
  http.get(API_SALES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalRevenue: faker.number.float({ min: 500_000, max: 5_000_000, fractionDigits: 2 }),
      totalOrders: faker.number.int({ min: 1000, max: 10_000 }),
      avgOrderValue: faker.number.float({ min: 100, max: 500, fractionDigits: 2 }),
      conversionRate: faker.number.float({ min: 2, max: 10, fractionDigits: 2 }),
      newCustomers: faker.number.int({ min: 100, max: 1000 }),
      returningCustomers: faker.number.float({ min: 30, max: 70, fractionDigits: 1 }),
    });
  }),

  http.get(API_SALES_REVENUE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
      revenue: faker.number.float({ min: 50_000, max: 500_000, fractionDigits: 2 }),
      target: faker.number.float({ min: 60_000, max: 450_000, fractionDigits: 2 }),
      growth: faker.number.float({ min: -10, max: 30, fractionDigits: 1 }),
    }));
    return HttpResponse.json({ monthlyRevenue });
  }),

  http.get(API_SALES_ORDERS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const orders = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      orderNumber: `ORD-${faker.string.numeric(6)}`,
      customer: faker.person.fullName(),
      company: faker.company.name(),
      total: faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
      status: faker.helpers.arrayElement([
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
      ]),
      date: faker.date.recent().toISOString(),
      items: faker.number.int({ min: 1, max: 10 }),
      salesRep: faker.person.fullName(),
    }));
    return HttpResponse.json({ orders, total: orders.length });
  }),

  http.get(API_SALES_PRODUCTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const products = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      category: faker.commerce.department(),
      unitsSold: faker.number.int({ min: 100, max: 5000 }),
      revenue: faker.number.float({ min: 5000, max: 200_000, fractionDigits: 2 }),
      growth: faker.number.float({ min: -20, max: 50, fractionDigits: 1 }),
      rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
    }));
    return HttpResponse.json({ products, total: products.length });
  }),

  http.get(API_SALES_REGIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const regions = [
      {
        name: i18n.t('handler.dashboardSales.northAmerica', 'North America'),
        revenue: faker.number.float({ min: 200_000, max: 2_000_000, fractionDigits: 2 }),
        orders: faker.number.int({ min: 500, max: 5000 }),
        growth: faker.number.float({ min: 0, max: 20, fractionDigits: 1 }),
      },
      {
        name: i18n.t('handler.dashboardSales.europe', 'Europe'),
        revenue: faker.number.float({ min: 150_000, max: 1_500_000, fractionDigits: 2 }),
        orders: faker.number.int({ min: 400, max: 4000 }),
        growth: faker.number.float({ min: -5, max: 25, fractionDigits: 1 }),
      },
      {
        name: i18n.t('handler.dashboardSales.asiaPacific', 'Asia Pacific'),
        revenue: faker.number.float({ min: 100_000, max: 1_000_000, fractionDigits: 2 }),
        orders: faker.number.int({ min: 300, max: 3000 }),
        growth: faker.number.float({ min: 5, max: 40, fractionDigits: 1 }),
      },
      {
        name: i18n.t('handler.dashboardSales.latinAmerica', 'Latin America'),
        revenue: faker.number.float({ min: 50_000, max: 500_000, fractionDigits: 2 }),
        orders: faker.number.int({ min: 100, max: 1000 }),
        growth: faker.number.float({ min: 0, max: 30, fractionDigits: 1 }),
      },
    ];
    return HttpResponse.json({ regions });
  }),

  http.get(API_SALES_REPS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const salesReps = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      revenue: faker.number.float({ min: 50_000, max: 500_000, fractionDigits: 2 }),
      deals: faker.number.int({ min: 10, max: 100 }),
      quota: faker.number.float({ min: 80, max: 120, fractionDigits: 1 }),
      region: faker.helpers.arrayElement([
        i18n.t('handler.dashboardSales.northAmerica', 'North America'),
        i18n.t('handler.dashboardSales.europe', 'Europe'),
        i18n.t('handler.dashboardSales.asiaPacific', 'Asia Pacific'),
      ]),
    }));
    return HttpResponse.json({ salesReps, total: salesReps.length });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardSalesStatusHandlers = {
  success: dashboardSalesHandlers,
  badRequest: [
    http.get(API_SALES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardSales.invalidRequestParameters', 'Invalid request parameters'),
          API_SALES,
          {
            field: 'data',
            error: i18n.t('handler.dashboardSales.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SALES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardSales.authenticationRequired', 'Authentication required'),
          API_SALES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_SALES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardSales.accessToSalesDashboardDenied',
            'Access to sales dashboard denied'
          ),
          API_SALES
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_SALES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardSales.requestValidationFailed', 'Request validation failed'),
          API_SALES,
          {
            field: 'data',
            error: i18n.t('handler.dashboardSales.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_SALES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardSales.failedToLoadSalesDashboard',
            'Failed to load sales dashboard'
          ),
          API_SALES
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_SALES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_SALES, () => HttpResponse.error())],
  emptyData: [
    http.get(API_SALES_ORDERS, async () => {
      await delay(100);
      return HttpResponse.json({ orders: [], total: 0 });
    }),
  ],
};
