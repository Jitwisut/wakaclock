import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD FINANCE HANDLERS
// Enterprise-grade MSW handlers for finance dashboard page
// ============================================================================

// API Endpoints
const API_FINANCE = '/api/dashboard/finance';
const API_FINANCE_ACCOUNTS = '/api/dashboard/finance/accounts';
const API_FINANCE_TRANSACTIONS = '/api/dashboard/finance/transactions';
const API_FINANCE_BUDGETS = '/api/dashboard/finance/budgets';
const API_FINANCE_INVESTMENTS = '/api/dashboard/finance/investments';
const API_FINANCE_REPORTS = '/api/dashboard/finance/reports';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardFinanceHandlers = [
  http.get(API_FINANCE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalBalance: faker.number.float({ min: 50_000, max: 500_000, fractionDigits: 2 }),
      income: faker.number.float({ min: 10_000, max: 50_000, fractionDigits: 2 }),
      expenses: faker.number.float({ min: 5000, max: 30_000, fractionDigits: 2 }),
      savings: faker.number.float({ min: 5000, max: 20_000, fractionDigits: 2 }),
      investments: faker.number.float({ min: 20_000, max: 200_000, fractionDigits: 2 }),
      netWorth: faker.number.float({ min: 100_000, max: 1_000_000, fractionDigits: 2 }),
    });
  }),

  http.get(API_FINANCE_ACCOUNTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const accounts = [
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.dashboardFinance.checkingAccount', 'Checking Account'),
        type: 'checking',
        balance: faker.number.float({ min: 5000, max: 50_000, fractionDigits: 2 }),
        institution: i18n.t('handler.dashboardFinance.chaseBank', 'Chase Bank'),
        lastUpdated: faker.date.recent().toISOString(),
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.dashboardFinance.savingsAccount', 'Savings Account'),
        type: 'savings',
        balance: faker.number.float({ min: 10_000, max: 100_000, fractionDigits: 2 }),
        institution: i18n.t('handler.dashboardFinance.chaseBank', 'Chase Bank'),
        lastUpdated: faker.date.recent().toISOString(),
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.dashboardFinance.creditCard', 'Credit Card'),
        type: 'credit',
        balance: faker.number.float({ min: -5000, max: 0, fractionDigits: 2 }),
        institution: i18n.t('handler.dashboardFinance.americanExpress', 'American Express'),
        lastUpdated: faker.date.recent().toISOString(),
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.dashboardFinance.investmentAccount', 'Investment Account'),
        type: 'investment',
        balance: faker.number.float({ min: 50_000, max: 300_000, fractionDigits: 2 }),
        institution: i18n.t('handler.dashboardFinance.fidelity', 'Fidelity'),
        lastUpdated: faker.date.recent().toISOString(),
      },
    ];
    return HttpResponse.json({ accounts, total: accounts.length });
  }),

  http.get(API_FINANCE_TRANSACTIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const transactions = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      date: faker.date.recent().toISOString(),
      description: faker.finance.transactionDescription(),
      amount: faker.number.float({ min: -2000, max: 5000, fractionDigits: 2 }),
      category: faker.helpers.arrayElement([
        i18n.t('handler.dashboardFinance.food', 'Food'),
        i18n.t('handler.dashboardFinance.transportation', 'Transportation'),
        i18n.t('handler.dashboardFinance.entertainment', 'Entertainment'),
        i18n.t('handler.dashboardFinance.shopping', 'Shopping'),
        i18n.t('handler.dashboardFinance.bills', 'Bills'),
        i18n.t('handler.dashboardFinance.income', 'Income'),
        i18n.t('handler.dashboardFinance.transfer', 'Transfer'),
      ]),
      account: faker.helpers.arrayElement([
        i18n.t('handler.dashboardFinance.checking', 'Checking'),
        i18n.t('handler.dashboardFinance.savings', 'Savings'),
        i18n.t('handler.dashboardFinance.creditCard', 'Credit Card'),
      ]),
      status: faker.helpers.arrayElement(['completed', 'pending', 'cancelled']),
    }));
    return HttpResponse.json({ transactions, total: transactions.length });
  }),

  http.get(API_FINANCE_BUDGETS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const budgets = [
      {
        category: i18n.t('handler.dashboardFinance.foodDining', 'Food & Dining'),
        budgeted: 800,
        spent: faker.number.float({ min: 400, max: 900, fractionDigits: 2 }),
      },
      {
        category: i18n.t('handler.dashboardFinance.transportation', 'Transportation'),
        budgeted: 400,
        spent: faker.number.float({ min: 200, max: 500, fractionDigits: 2 }),
      },
      {
        category: i18n.t('handler.dashboardFinance.entertainment', 'Entertainment'),
        budgeted: 300,
        spent: faker.number.float({ min: 100, max: 400, fractionDigits: 2 }),
      },
      {
        category: i18n.t('handler.dashboardFinance.shopping', 'Shopping'),
        budgeted: 500,
        spent: faker.number.float({ min: 200, max: 600, fractionDigits: 2 }),
      },
      {
        category: i18n.t('handler.dashboardFinance.billsUtilities', 'Bills & Utilities'),
        budgeted: 1500,
        spent: faker.number.float({ min: 1200, max: 1600, fractionDigits: 2 }),
      },
    ];
    return HttpResponse.json({ budgets });
  }),

  http.get(API_FINANCE_INVESTMENTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const investments = [
      {
        symbol: 'SPY',
        name: i18n.t('handler.dashboardFinance.sp500Etf', 'S&P 500 ETF'),
        shares: faker.number.float({ min: 10, max: 100, fractionDigits: 4 }),
        value: faker.number.float({ min: 5000, max: 50_000, fractionDigits: 2 }),
        gain: faker.number.float({ min: -1000, max: 5000, fractionDigits: 2 }),
      },
      {
        symbol: 'QQQ',
        name: i18n.t('handler.dashboardFinance.nasdaq100Etf', 'Nasdaq 100 ETF'),
        shares: faker.number.float({ min: 5, max: 50, fractionDigits: 4 }),
        value: faker.number.float({ min: 3000, max: 30_000, fractionDigits: 2 }),
        gain: faker.number.float({ min: -500, max: 3000, fractionDigits: 2 }),
      },
      {
        symbol: 'AAPL',
        name: i18n.t('handler.dashboardFinance.appleInc', 'Apple Inc.'),
        shares: faker.number.float({ min: 10, max: 100, fractionDigits: 4 }),
        value: faker.number.float({ min: 2000, max: 20_000, fractionDigits: 2 }),
        gain: faker.number.float({ min: -200, max: 2000, fractionDigits: 2 }),
      },
    ];
    return HttpResponse.json({
      investments,
      totalValue: investments.reduce((sum, i) => sum + i.value, 0),
    });
  }),

  http.get(API_FINANCE_REPORTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
      income: faker.number.float({ min: 8000, max: 15_000, fractionDigits: 2 }),
      expenses: faker.number.float({ min: 4000, max: 10_000, fractionDigits: 2 }),
    }));
    return HttpResponse.json({ monthlyData });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardFinanceStatusHandlers = {
  success: dashboardFinanceHandlers,
  badRequest: [
    http.get(API_FINANCE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardFinance.invalidRequestParameters', 'Invalid request parameters'),
          API_FINANCE,
          {
            field: 'data',
            error: i18n.t('handler.dashboardFinance.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_FINANCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardFinance.authenticationRequired', 'Authentication required'),
          API_FINANCE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_FINANCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardFinance.accessToFinanceDashboardDenied',
            'Access to finance dashboard denied'
          ),
          API_FINANCE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_FINANCE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardFinance.requestValidationFailed', 'Request validation failed'),
          API_FINANCE,
          {
            field: 'data',
            error: i18n.t('handler.dashboardFinance.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_FINANCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardFinance.failedToLoadFinanceDashboard',
            'Failed to load finance dashboard'
          ),
          API_FINANCE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_FINANCE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_FINANCE, () => HttpResponse.error())],
  emptyData: [
    http.get(API_FINANCE_TRANSACTIONS, async () => {
      await delay(100);
      return HttpResponse.json({ transactions: [], total: 0 });
    }),
  ],
};
