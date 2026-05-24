import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD HOTEL HANDLERS
// Enterprise-grade MSW handlers for hotel dashboard page
// ============================================================================

// API Endpoints
const API_HOTEL = '/api/dashboard/hotel';
const API_HOTEL_ROOMS = '/api/dashboard/hotel/rooms';
const API_HOTEL_BOOKINGS = '/api/dashboard/hotel/bookings';
const API_HOTEL_GUESTS = '/api/dashboard/hotel/guests';
const API_HOTEL_REVENUE = '/api/dashboard/hotel/revenue';
const API_HOTEL_HOUSEKEEPING = '/api/dashboard/hotel/housekeeping';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardHotelHandlers = [
  http.get(API_HOTEL, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalRooms: faker.number.int({ min: 100, max: 500 }),
      occupiedRooms: faker.number.int({ min: 50, max: 400 }),
      occupancyRate: faker.number.float({ min: 50, max: 95, fractionDigits: 1 }),
      todayCheckIns: faker.number.int({ min: 5, max: 30 }),
      todayCheckOuts: faker.number.int({ min: 5, max: 30 }),
      avgDailyRate: faker.number.float({ min: 100, max: 500, fractionDigits: 2 }),
      revPAR: faker.number.float({ min: 80, max: 400, fractionDigits: 2 }),
    });
  }),

  http.get(API_HOTEL_ROOMS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const rooms = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      number: faker.string.numeric(3),
      type: faker.helpers.arrayElement([
        i18n.t('handler.dashboardHotel.standard', 'Standard'),
        i18n.t('handler.dashboardHotel.deluxe', 'Deluxe'),
        i18n.t('handler.dashboardHotel.suite', 'Suite'),
        i18n.t('handler.dashboardHotel.executive', 'Executive'),
        i18n.t('handler.dashboardHotel.presidential', 'Presidential'),
      ]),
      floor: faker.number.int({ min: 1, max: 20 }),
      status: faker.helpers.arrayElement(['available', 'occupied', 'maintenance', 'cleaning']),
      price: faker.number.float({ min: 100, max: 1000, fractionDigits: 2 }),
      amenities: faker.helpers.arrayElements(
        [
          'WiFi',
          'TV',
          i18n.t('handler.dashboardHotel.minibar', 'Minibar'),
          i18n.t('handler.dashboardHotel.safe', 'Safe'),
          i18n.t('handler.dashboardHotel.balcony', 'Balcony'),
          i18n.t('handler.dashboardHotel.oceanView', 'Ocean View'),
        ],
        3
      ),
    }));
    return HttpResponse.json({ rooms, total: rooms.length });
  }),

  http.get(API_HOTEL_BOOKINGS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const bookings = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      confirmationNumber: `BK${faker.string.numeric(8)}`,
      guestName: faker.person.fullName(),
      roomNumber: faker.string.numeric(3),
      roomType: faker.helpers.arrayElement([
        i18n.t('handler.dashboardHotel.standard', 'Standard'),
        i18n.t('handler.dashboardHotel.deluxe', 'Deluxe'),
        i18n.t('handler.dashboardHotel.suite', 'Suite'),
      ]),
      checkIn: faker.date.soon().toISOString(),
      checkOut: faker.date.future().toISOString(),
      nights: faker.number.int({ min: 1, max: 14 }),
      totalAmount: faker.number.float({ min: 200, max: 5000, fractionDigits: 2 }),
      status: faker.helpers.arrayElement(['confirmed', 'checked-in', 'checked-out', 'cancelled']),
      source: faker.helpers.arrayElement(['direct', 'booking.com', 'expedia', 'airbnb']),
    }));
    return HttpResponse.json({ bookings, total: bookings.length });
  }),

  http.get(API_HOTEL_GUESTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const guests = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      nationality: faker.location.country(),
      roomNumber: faker.string.numeric(3),
      checkInDate: faker.date.recent().toISOString(),
      vipStatus: faker.helpers.arrayElement(['regular', 'silver', 'gold', 'platinum']),
      totalStays: faker.number.int({ min: 1, max: 20 }),
    }));
    return HttpResponse.json({ guests, total: guests.length });
  }),

  http.get(API_HOTEL_REVENUE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
      roomRevenue: faker.number.float({ min: 100_000, max: 500_000, fractionDigits: 2 }),
      fbRevenue: faker.number.float({ min: 20_000, max: 100_000, fractionDigits: 2 }),
      otherRevenue: faker.number.float({ min: 5000, max: 30_000, fractionDigits: 2 }),
    }));
    return HttpResponse.json({ monthlyRevenue });
  }),

  http.get(API_HOTEL_HOUSEKEEPING, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const tasks = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      roomNumber: faker.string.numeric(3),
      type: faker.helpers.arrayElement(['cleaning', 'turndown', 'deep-clean', 'maintenance']),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      assignedTo: faker.person.fullName(),
      status: faker.helpers.arrayElement(['pending', 'in-progress', 'completed']),
      scheduledFor: faker.date.soon().toISOString(),
    }));
    return HttpResponse.json({ tasks, total: tasks.length });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardHotelStatusHandlers = {
  success: dashboardHotelHandlers,
  badRequest: [
    http.get(API_HOTEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardHotel.invalidRequestParameters', 'Invalid request parameters'),
          API_HOTEL,
          {
            field: 'data',
            error: i18n.t('handler.dashboardHotel.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_HOTEL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardHotel.authenticationRequired', 'Authentication required'),
          API_HOTEL
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_HOTEL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardHotel.accessToHotelDashboardDenied',
            'Access to hotel dashboard denied'
          ),
          API_HOTEL
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_HOTEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardHotel.requestValidationFailed', 'Request validation failed'),
          API_HOTEL,
          {
            field: 'data',
            error: i18n.t('handler.dashboardHotel.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_HOTEL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardHotel.failedToLoadHotelDashboard',
            'Failed to load hotel dashboard'
          ),
          API_HOTEL
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_HOTEL, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_HOTEL, () => HttpResponse.error())],
  emptyData: [
    http.get(API_HOTEL_BOOKINGS, async () => {
      await delay(100);
      return HttpResponse.json({ bookings: [], total: 0 });
    }),
  ],
};
