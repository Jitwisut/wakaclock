import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD ECOMMERCE HANDLERS
// Enterprise-grade MSW handlers for ecommerce dashboard page
// ============================================================================

// API Endpoints
const API_ECOMMERCE = '/api/dashboard/ecommerce';
const API_ECOMMERCE_SALES = '/api/dashboard/ecommerce/sales';
const API_ECOMMERCE_ORDERS = '/api/dashboard/ecommerce/orders';
const API_ECOMMERCE_PRODUCTS = '/api/dashboard/ecommerce/products';
const API_ECOMMERCE_CUSTOMERS = '/api/dashboard/ecommerce/customers';
const API_ECOMMERCE_INVENTORY = '/api/dashboard/ecommerce/inventory';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardEcommerceHandlers = [
  http.get(API_ECOMMERCE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalSales: faker.number.int({ min: 100_000, max: 1_000_000 }),
      totalOrders: faker.number.int({ min: 500, max: 5000 }),
      avgOrderValue: faker.number.float({ min: 50, max: 200, fractionDigits: 2 }),
      totalCustomers: faker.number.int({ min: 1000, max: 10_000 }),
      returningCustomers: faker.number.float({ min: 20, max: 60, fractionDigits: 1 }),
      cartAbandonment: faker.number.float({ min: 50, max: 80, fractionDigits: 1 }),
    });
  }),

  http.get(API_ECOMMERCE_SALES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const salesData = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revenue: faker.number.int({ min: 5000, max: 50_000 }),
      orders: faker.number.int({ min: 20, max: 200 }),
      profit: faker.number.int({ min: 1000, max: 15_000 }),
    }));
    return HttpResponse.json({ salesData });
  }),

  http.get(API_ECOMMERCE_ORDERS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const orders = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      orderNumber: `ORD-${faker.string.numeric(6)}`,
      customer: faker.person.fullName(),
      email: faker.internet.email(),
      total: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
      status: faker.helpers.arrayElement([
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
      ]),
      items: faker.number.int({ min: 1, max: 10 }),
      date: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ orders, total: orders.length });
  }),

  http.get(API_ECOMMERCE_PRODUCTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const products = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      sku: faker.string.alphanumeric(8).toUpperCase(),
      price: faker.number.float({ min: 10, max: 500, fractionDigits: 2 }),
      stock: faker.number.int({ min: 0, max: 500 }),
      sold: faker.number.int({ min: 10, max: 1000 }),
      category: faker.commerce.department(),
      status: faker.helpers.arrayElement(['active', 'draft', 'archived']),
    }));
    return HttpResponse.json({ products, total: products.length });
  }),

  http.get(API_ECOMMERCE_CUSTOMERS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const customers = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      orders: faker.number.int({ min: 1, max: 50 }),
      totalSpent: faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
      lastOrder: faker.date.recent().toISOString(),
      status: faker.helpers.arrayElement(['active', 'inactive', 'vip']),
    }));
    return HttpResponse.json({ customers, total: customers.length });
  }),

  http.get(API_ECOMMERCE_INVENTORY, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalProducts: faker.number.int({ min: 100, max: 1000 }),
      lowStock: faker.number.int({ min: 5, max: 50 }),
      outOfStock: faker.number.int({ min: 0, max: 20 }),
      totalValue: faker.number.int({ min: 50_000, max: 500_000 }),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardEcommerceStatusHandlers = {
  success: dashboardEcommerceHandlers,
  badRequest: [
    http.get(API_ECOMMERCE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.dashboardEcommerce.invalidRequestParameters',
            'Invalid request parameters'
          ),
          API_ECOMMERCE,
          {
            field: 'data',
            error: i18n.t('handler.dashboardEcommerce.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ECOMMERCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardEcommerce.authenticationRequired', 'Authentication required'),
          API_ECOMMERCE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_ECOMMERCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardEcommerce.accessToEcommerceDashboardDenied',
            'Access to ecommerce dashboard denied'
          ),
          API_ECOMMERCE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_ECOMMERCE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardEcommerce.requestValidationFailed', 'Request validation failed'),
          API_ECOMMERCE,
          {
            field: 'data',
            error: i18n.t('handler.dashboardEcommerce.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_ECOMMERCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardEcommerce.failedToLoadEcommerceDashboard',
            'Failed to load ecommerce dashboard'
          ),
          API_ECOMMERCE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_ECOMMERCE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_ECOMMERCE, () => HttpResponse.error())],
  emptyData: [
    http.get(API_ECOMMERCE_ORDERS, async () => {
      await delay(100);
      return HttpResponse.json({ orders: [], total: 0 });
    }),
  ],
};
