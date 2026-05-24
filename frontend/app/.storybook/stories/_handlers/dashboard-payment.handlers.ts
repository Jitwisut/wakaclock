import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD PAYMENT HANDLERS
// Enterprise-grade MSW handlers for payment dashboard page
// ============================================================================

// API Endpoints
const API_PAYMENT = '/api/dashboard/payment';
const API_PAYMENT_TRANSACTIONS = '/api/dashboard/payment/transactions';
const API_PAYMENT_METHODS = '/api/dashboard/payment/methods';
const API_PAYMENT_ANALYTICS = '/api/dashboard/payment/analytics';
const API_PAYMENT_DISPUTES = '/api/dashboard/payment/disputes';
const API_PAYMENT_PAYOUTS = '/api/dashboard/payment/payouts';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardPaymentHandlers = [
  http.get(API_PAYMENT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalVolume: faker.number.float({ min: 100_000, max: 1_000_000, fractionDigits: 2 }),
      totalTransactions: faker.number.int({ min: 1000, max: 10_000 }),
      successRate: faker.number.float({ min: 95, max: 99.9, fractionDigits: 2 }),
      avgTransactionValue: faker.number.float({ min: 50, max: 200, fractionDigits: 2 }),
      pendingPayouts: faker.number.float({ min: 10_000, max: 100_000, fractionDigits: 2 }),
      disputeRate: faker.number.float({ min: 0.1, max: 2, fractionDigits: 2 }),
    });
  }),

  http.get(API_PAYMENT_TRANSACTIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const transactions = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      transactionId: `TXN_${faker.string.alphanumeric(12)}`,
      amount: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'JPY']),
      status: faker.helpers.arrayElement([
        'succeeded',
        'pending',
        'failed',
        'refunded',
        'disputed',
      ]),
      paymentMethod: faker.helpers.arrayElement([
        'card',
        'bank_transfer',
        'paypal',
        'apple_pay',
        'google_pay',
      ]),
      customer: faker.person.fullName(),
      email: faker.internet.email(),
      createdAt: faker.date.recent().toISOString(),
      metadata: { orderId: faker.string.uuid() },
    }));
    return HttpResponse.json({ transactions, total: transactions.length });
  }),

  http.get(API_PAYMENT_METHODS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const methods = [
      {
        type: 'card',
        brand: i18n.t('handler.dashboardPayment.visa', 'Visa'),
        volume: faker.number.float({ min: 30_000, max: 400_000, fractionDigits: 2 }),
        percentage: 45,
      },
      {
        type: 'card',
        brand: i18n.t('handler.dashboardPayment.mastercard', 'Mastercard'),
        volume: faker.number.float({ min: 20_000, max: 300_000, fractionDigits: 2 }),
        percentage: 30,
      },
      {
        type: 'paypal',
        brand: i18n.t('handler.dashboardPayment.paypal', 'PayPal'),
        volume: faker.number.float({ min: 10_000, max: 150_000, fractionDigits: 2 }),
        percentage: 15,
      },
      {
        type: 'bank_transfer',
        brand: i18n.t('handler.dashboardPayment.bank', 'Bank'),
        volume: faker.number.float({ min: 5000, max: 100_000, fractionDigits: 2 }),
        percentage: 10,
      },
    ];
    return HttpResponse.json({ methods });
  }),

  http.get(API_PAYMENT_ANALYTICS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const dailyData = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      volume: faker.number.float({ min: 5000, max: 50_000, fractionDigits: 2 }),
      transactions: faker.number.int({ min: 50, max: 500 }),
      successRate: faker.number.float({ min: 95, max: 99.9, fractionDigits: 2 }),
    }));
    return HttpResponse.json({ dailyData });
  }),

  http.get(API_PAYMENT_DISPUTES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const disputes = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      disputeId: `DIS_${faker.string.alphanumeric(10)}`,
      transactionId: `TXN_${faker.string.alphanumeric(12)}`,
      amount: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
      reason: faker.helpers.arrayElement([
        'fraudulent',
        'product_not_received',
        'product_unacceptable',
        'duplicate',
        'subscription_canceled',
      ]),
      status: faker.helpers.arrayElement(['needs_response', 'under_review', 'won', 'lost']),
      dueDate: faker.date.soon().toISOString(),
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ disputes, total: disputes.length });
  }),

  http.get(API_PAYMENT_PAYOUTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const payouts = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      payoutId: `PO_${faker.string.alphanumeric(10)}`,
      amount: faker.number.float({ min: 1000, max: 50_000, fractionDigits: 2 }),
      status: faker.helpers.arrayElement(['pending', 'in_transit', 'paid', 'failed', 'cancelled']),
      arrivalDate: faker.date.soon().toISOString(),
      destination: `****${faker.string.numeric(4)}`,
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ payouts, total: payouts.length });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardPaymentStatusHandlers = {
  success: dashboardPaymentHandlers,
  badRequest: [
    http.get(API_PAYMENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardPayment.invalidRequestParameters', 'Invalid request parameters'),
          API_PAYMENT,
          {
            field: 'data',
            error: i18n.t('handler.dashboardPayment.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_PAYMENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardPayment.authenticationRequired', 'Authentication required'),
          API_PAYMENT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_PAYMENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardPayment.accessToPaymentDashboardDenied',
            'Access to payment dashboard denied'
          ),
          API_PAYMENT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_PAYMENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardPayment.requestValidationFailed', 'Request validation failed'),
          API_PAYMENT,
          {
            field: 'data',
            error: i18n.t('handler.dashboardPayment.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_PAYMENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardPayment.failedToLoadPaymentDashboard',
            'Failed to load payment dashboard'
          ),
          API_PAYMENT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_PAYMENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_PAYMENT, () => HttpResponse.error())],
  emptyData: [
    http.get(API_PAYMENT_TRANSACTIONS, async () => {
      await delay(100);
      return HttpResponse.json({ transactions: [], total: 0 });
    }),
  ],
};
