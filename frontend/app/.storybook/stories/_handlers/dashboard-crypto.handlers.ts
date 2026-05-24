import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD CRYPTO HANDLERS
// Enterprise-grade MSW handlers for crypto dashboard page
// ============================================================================

// API Endpoints
const API_CRYPTO = '/api/dashboard/crypto';
const API_CRYPTO_PORTFOLIO = '/api/dashboard/crypto/portfolio';
const API_CRYPTO_PRICES = '/api/dashboard/crypto/prices';
const API_CRYPTO_TRANSACTIONS = '/api/dashboard/crypto/transactions';
const API_CRYPTO_WATCHLIST = '/api/dashboard/crypto/watchlist';
const API_CRYPTO_MARKET = '/api/dashboard/crypto/market';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardCryptoHandlers = [
  http.get(API_CRYPTO, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalBalance: faker.number.float({ min: 10_000, max: 500_000, fractionDigits: 2 }),
      totalProfit: faker.number.float({ min: -10_000, max: 50_000, fractionDigits: 2 }),
      profitPercent: faker.number.float({ min: -20, max: 100, fractionDigits: 2 }),
      btcBalance: faker.number.float({ min: 0.1, max: 5, fractionDigits: 8 }),
      ethBalance: faker.number.float({ min: 1, max: 50, fractionDigits: 8 }),
    });
  }),

  http.get(API_CRYPTO_PORTFOLIO, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const holdings = [
      {
        symbol: 'BTC',
        name: i18n.t('handler.dashboardCrypto.bitcoin', 'Bitcoin'),
        amount: faker.number.float({ min: 0.1, max: 5, fractionDigits: 8 }),
        value: faker.number.float({ min: 5000, max: 200_000, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -10, max: 15, fractionDigits: 2 }),
      },
      {
        symbol: 'ETH',
        name: i18n.t('handler.dashboardCrypto.ethereum', 'Ethereum'),
        amount: faker.number.float({ min: 1, max: 50, fractionDigits: 8 }),
        value: faker.number.float({ min: 2000, max: 100_000, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -10, max: 15, fractionDigits: 2 }),
      },
      {
        symbol: 'SOL',
        name: i18n.t('handler.dashboardCrypto.solana', 'Solana'),
        amount: faker.number.float({ min: 10, max: 500, fractionDigits: 8 }),
        value: faker.number.float({ min: 1000, max: 50_000, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -10, max: 15, fractionDigits: 2 }),
      },
      {
        symbol: 'USDT',
        name: i18n.t('handler.dashboardCrypto.tether', 'Tether'),
        amount: faker.number.float({ min: 1000, max: 50_000, fractionDigits: 2 }),
        value: faker.number.float({ min: 1000, max: 50_000, fractionDigits: 2 }),
        change24h: 0,
      },
    ];
    return HttpResponse.json({ holdings, total: holdings.length });
  }),

  http.get(API_CRYPTO_PRICES, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const prices = [
      {
        symbol: 'BTC',
        price: faker.number.float({ min: 40_000, max: 70_000, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -5, max: 10, fractionDigits: 2 }),
        volume24h: faker.number.int({ min: 10_000_000_000, max: 50_000_000_000 }),
      },
      {
        symbol: 'ETH',
        price: faker.number.float({ min: 2000, max: 4000, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -5, max: 10, fractionDigits: 2 }),
        volume24h: faker.number.int({ min: 5_000_000_000, max: 20_000_000_000 }),
      },
      {
        symbol: 'SOL',
        price: faker.number.float({ min: 50, max: 200, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -8, max: 15, fractionDigits: 2 }),
        volume24h: faker.number.int({ min: 1_000_000_000, max: 5_000_000_000 }),
      },
      {
        symbol: 'BNB',
        price: faker.number.float({ min: 200, max: 500, fractionDigits: 2 }),
        change24h: faker.number.float({ min: -5, max: 10, fractionDigits: 2 }),
        volume24h: faker.number.int({ min: 500_000_000, max: 2_000_000_000 }),
      },
    ];
    return HttpResponse.json({ prices, lastUpdated: new Date().toISOString() });
  }),

  http.get(API_CRYPTO_TRANSACTIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const transactions = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['buy', 'sell', 'transfer', 'receive']),
      symbol: faker.helpers.arrayElement(['BTC', 'ETH', 'SOL', 'USDT']),
      amount: faker.number.float({ min: 0.001, max: 10, fractionDigits: 8 }),
      value: faker.number.float({ min: 100, max: 50_000, fractionDigits: 2 }),
      fee: faker.number.float({ min: 0.1, max: 50, fractionDigits: 2 }),
      status: faker.helpers.arrayElement(['completed', 'pending', 'failed']),
      timestamp: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ transactions, total: transactions.length });
  }),

  http.get(API_CRYPTO_WATCHLIST, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const watchlist = ['BTC', 'ETH', 'SOL', 'MATIC', 'AVAX', 'DOT'];
    return HttpResponse.json({ watchlist });
  }),

  http.get(API_CRYPTO_MARKET, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalMarketCap: faker.number.int({ min: 1_000_000_000_000, max: 3_000_000_000_000 }),
      totalVolume24h: faker.number.int({ min: 50_000_000_000, max: 200_000_000_000 }),
      btcDominance: faker.number.float({ min: 40, max: 55, fractionDigits: 1 }),
      activeCoins: faker.number.int({ min: 10_000, max: 20_000 }),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardCryptoStatusHandlers = {
  success: dashboardCryptoHandlers,
  badRequest: [
    http.get(API_CRYPTO, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardCrypto.invalidRequestParameters', 'Invalid request parameters'),
          API_CRYPTO,
          {
            field: 'data',
            error: i18n.t('handler.dashboardCrypto.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CRYPTO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardCrypto.authenticationRequired', 'Authentication required'),
          API_CRYPTO
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_CRYPTO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardCrypto.accessToCryptoDashboardDenied',
            'Access to crypto dashboard denied'
          ),
          API_CRYPTO
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_CRYPTO, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardCrypto.requestValidationFailed', 'Request validation failed'),
          API_CRYPTO,
          {
            field: 'data',
            error: i18n.t('handler.dashboardCrypto.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_CRYPTO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardCrypto.failedToLoadCryptoDashboard',
            'Failed to load crypto dashboard'
          ),
          API_CRYPTO
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_CRYPTO, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_CRYPTO, () => HttpResponse.error())],
  emptyData: [
    http.get(API_CRYPTO_PORTFOLIO, async () => {
      await delay(100);
      return HttpResponse.json({ holdings: [], total: 0 });
    }),
  ],
};
