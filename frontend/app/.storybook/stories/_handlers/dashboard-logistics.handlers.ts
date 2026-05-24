import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD LOGISTICS HANDLERS
// Enterprise-grade MSW handlers for logistics dashboard page
// ============================================================================

// API Endpoints
const API_LOGISTICS = '/api/dashboard/logistics';
const API_LOGISTICS_SHIPMENTS = '/api/dashboard/logistics/shipments';
const API_LOGISTICS_FLEET = '/api/dashboard/logistics/fleet';
const API_LOGISTICS_WAREHOUSES = '/api/dashboard/logistics/warehouses';
const API_LOGISTICS_ROUTES = '/api/dashboard/logistics/routes';
const API_LOGISTICS_METRICS = '/api/dashboard/logistics/metrics';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardLogisticsHandlers = [
  http.get(API_LOGISTICS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalShipments: faker.number.int({ min: 500, max: 5000 }),
      inTransit: faker.number.int({ min: 100, max: 1000 }),
      delivered: faker.number.int({ min: 300, max: 3000 }),
      delayed: faker.number.int({ min: 10, max: 100 }),
      onTimeRate: faker.number.float({ min: 85, max: 99, fractionDigits: 1 }),
      totalVehicles: faker.number.int({ min: 50, max: 200 }),
    });
  }),

  http.get(API_LOGISTICS_SHIPMENTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const shipments = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      trackingNumber: `TRK${faker.string.alphanumeric(12).toUpperCase()}`,
      origin: faker.location.city(),
      destination: faker.location.city(),
      status: faker.helpers.arrayElement([
        'pending',
        'picked-up',
        'in-transit',
        'out-for-delivery',
        'delivered',
        'delayed',
      ]),
      estimatedDelivery: faker.date.soon().toISOString(),
      weight: faker.number.float({ min: 0.5, max: 100, fractionDigits: 2 }),
      carrier: faker.helpers.arrayElement(['FedEx', 'UPS', 'DHL', 'USPS']),
      customer: faker.company.name(),
    }));
    return HttpResponse.json({ shipments, total: shipments.length });
  }),

  http.get(API_LOGISTICS_FLEET, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const vehicles = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      vehicleId: `VH-${faker.string.numeric(4)}`,
      type: faker.helpers.arrayElement([
        'Van',
        i18n.t('handler.dashboardLogistics.truck', 'Truck'),
        i18n.t('handler.dashboardLogistics.trailer', 'Trailer'),
        i18n.t('handler.dashboardLogistics.container', 'Container'),
      ]),
      driver: faker.person.fullName(),
      status: faker.helpers.arrayElement(['active', 'idle', 'maintenance', 'off-duty']),
      location: { lat: faker.location.latitude(), lng: faker.location.longitude() },
      currentRoute: faker.helpers.maybe(
        () => `${faker.location.city()} → ${faker.location.city()}`
      ),
      fuelLevel: faker.number.int({ min: 10, max: 100 }),
      mileage: faker.number.int({ min: 10_000, max: 200_000 }),
    }));
    return HttpResponse.json({ vehicles, total: vehicles.length });
  }),

  http.get(API_LOGISTICS_WAREHOUSES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const warehouses = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      name: `${faker.location.city()} Distribution Center`,
      location: faker.location.city(),
      capacity: faker.number.int({ min: 10_000, max: 100_000 }),
      utilization: faker.number.float({ min: 40, max: 95, fractionDigits: 1 }),
      inventory: faker.number.int({ min: 5000, max: 80_000 }),
      pendingOrders: faker.number.int({ min: 50, max: 500 }),
      staff: faker.number.int({ min: 20, max: 100 }),
    }));
    return HttpResponse.json({ warehouses, total: warehouses.length });
  }),

  http.get(API_LOGISTICS_ROUTES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const routes = Array.from({ length: 8 }, () => ({
      id: faker.string.uuid(),
      name: `Route ${faker.string.alpha(1).toUpperCase()}${faker.string.numeric(3)}`,
      origin: faker.location.city(),
      destination: faker.location.city(),
      distance: faker.number.int({ min: 50, max: 2000 }),
      estimatedTime: faker.number.int({ min: 1, max: 48 }),
      stops: faker.number.int({ min: 1, max: 10 }),
      status: faker.helpers.arrayElement(['active', 'completed', 'scheduled']),
    }));
    return HttpResponse.json({ routes, total: routes.length });
  }),

  http.get(API_LOGISTICS_METRICS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const dailyMetrics = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      deliveries: faker.number.int({ min: 100, max: 500 }),
      onTime: faker.number.int({ min: 90, max: 480 }),
      delayed: faker.number.int({ min: 5, max: 50 }),
    }));
    return HttpResponse.json({ dailyMetrics });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardLogisticsStatusHandlers = {
  success: dashboardLogisticsHandlers,
  badRequest: [
    http.get(API_LOGISTICS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.dashboardLogistics.invalidRequestParameters',
            'Invalid request parameters'
          ),
          API_LOGISTICS,
          {
            field: 'data',
            error: i18n.t('handler.dashboardLogistics.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_LOGISTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardLogistics.authenticationRequired', 'Authentication required'),
          API_LOGISTICS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_LOGISTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardLogistics.accessToLogisticsDashboardDenied',
            'Access to logistics dashboard denied'
          ),
          API_LOGISTICS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_LOGISTICS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardLogistics.requestValidationFailed', 'Request validation failed'),
          API_LOGISTICS,
          {
            field: 'data',
            error: i18n.t('handler.dashboardLogistics.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_LOGISTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardLogistics.failedToLoadLogisticsDashboard',
            'Failed to load logistics dashboard'
          ),
          API_LOGISTICS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_LOGISTICS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_LOGISTICS, () => HttpResponse.error())],
  emptyData: [
    http.get(API_LOGISTICS_SHIPMENTS, async () => {
      await delay(100);
      return HttpResponse.json({ shipments: [], total: 0 });
    }),
  ],
};
