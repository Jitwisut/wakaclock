import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// SETTINGS HANDLERS
// Enterprise-grade MSW handlers for settings pages:
// - Account settings
// - Appearance settings
// - Billing settings
// - Display settings
// - Notifications settings
// ============================================================================

// API Endpoints
const API_SETTINGS = '/api/settings';
const API_SETTINGS_ACCOUNT = '/api/settings/account';
const API_SETTINGS_APPEARANCE = '/api/settings/appearance';
const API_SETTINGS_BILLING = '/api/settings/billing';
const API_SETTINGS_DISPLAY = '/api/settings/display';
const API_SETTINGS_NOTIFICATIONS = '/api/settings/notifications';
const API_SETTINGS_PAYMENT_METHODS = '/api/settings/payment-methods';
const API_SETTINGS_TRANSACTIONS = '/api/settings/transactions';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const settingsHandlers = [
  // Get all settings
  http.get(API_SETTINGS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      account: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        dob: faker.date.birthdate().toISOString(),
        language: 'en',
      },
      appearance: {
        theme: 'light',
        font: 'inter',
      },
      display: {
        sidebarItems: ['recents', 'home', 'documents'],
      },
      notifications: {
        notifyType: 'all',
        communicationEmails: true,
        marketingEmails: false,
        socialEmails: true,
        securityEmails: true,
        mobileSettings: false,
      },
    });
  }),

  // Account settings
  http.get(API_SETTINGS_ACCOUNT, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      dob: faker.date.birthdate().toISOString(),
      language: faker.helpers.arrayElement(['en', 'fr', 'de', 'es', 'ja']),
      timezone: faker.location.timeZone(),
      avatar: faker.image.avatar(),
    });
  }),

  http.patch(API_SETTINGS_ACCOUNT, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.settings.accountSettingsUpdatedSuccessfully',
        'Account settings updated successfully'
      ),
      data: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Appearance settings
  http.get(API_SETTINGS_APPEARANCE, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
      font: faker.helpers.arrayElement(['inter', 'manrope', 'system']),
      accentColor: faker.color.rgb(),
      fontSize: 'medium',
      reducedMotion: false,
    });
  }),

  http.patch(API_SETTINGS_APPEARANCE, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 600 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.settings.appearancePreferencesUpdated',
        'Appearance preferences updated'
      ),
      data: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Billing settings
  http.get(API_SETTINGS_BILLING, async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));
    return HttpResponse.json({
      plan: {
        name: faker.helpers.arrayElement([
          i18n.t('handler.settings.free', 'Free'),
          'Pro',
          i18n.t('handler.settings.enterprise', 'Enterprise'),
        ]),
        price: faker.commerce.price({ min: 0, max: 199 }),
        billingCycle: 'monthly',
        nextPaymentDate: faker.date.future().toISOString(),
      },
      paymentMethods: [
        {
          id: faker.string.uuid(),
          type: 'card',
          brand: i18n.t('handler.settings.visa', 'Visa'),
          last4: faker.finance.creditCardNumber('visa').slice(-4),
          expiryMonth: faker.date.future().getMonth() + 1,
          expiryYear: faker.date.future().getFullYear(),
          isPrimary: true,
          holderName: faker.person.fullName(),
        },
        {
          id: faker.string.uuid(),
          type: 'card',
          brand: i18n.t('handler.settings.mastercard', 'Mastercard'),
          last4: faker.finance.creditCardNumber('mastercard').slice(-4),
          expiryMonth: faker.date.future().getMonth() + 1,
          expiryYear: faker.date.future().getFullYear(),
          isPrimary: false,
          holderName: faker.person.fullName(),
        },
      ],
    });
  }),

  http.post(API_SETTINGS_PAYMENT_METHODS, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 1000 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.settings.paymentMethodAddedSuccessfully',
        'Payment method added successfully'
      ),
      paymentMethod: {
        id: faker.string.uuid(),
        ...body,
        createdAt: new Date().toISOString(),
      },
    });
  }),

  http.delete(`${API_SETTINGS_PAYMENT_METHODS}/:id`, async ({ params }) => {
    await delay(faker.number.int({ min: 300, max: 600 }));
    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.settings.paymentMethodRemoved', 'Payment method removed'),
      deletedId: params.id,
    });
  }),

  // Transactions
  http.get(API_SETTINGS_TRANSACTIONS, async () => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    const transactions = Array.from({ length: faker.number.int({ min: 5, max: 10 }) }, () => ({
      id: `#${faker.string.numeric(5)}`,
      product: faker.commerce.productName(),
      status: faker.helpers.arrayElement(['paid', 'pending', 'failed']),
      date: faker.date.recent().toISOString(),
      amount: faker.commerce.price({ min: 29, max: 299 }),
    }));
    return HttpResponse.json({
      transactions,
      total: transactions.length,
    });
  }),

  // Display settings
  http.get(API_SETTINGS_DISPLAY, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      sidebarItems: ['recents', 'home', 'applications', 'documents'],
      compactMode: false,
      showIcons: true,
      gridView: false,
    });
  }),

  http.patch(API_SETTINGS_DISPLAY, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 600 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.settings.displaySettingsUpdated', 'Display settings updated'),
      data: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Notifications settings
  http.get(API_SETTINGS_NOTIFICATIONS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      notifyType: faker.helpers.arrayElement(['all', 'mentions', 'none']),
      communicationEmails: faker.datatype.boolean(),
      marketingEmails: faker.datatype.boolean(),
      socialEmails: faker.datatype.boolean(),
      securityEmails: true,
      mobileSettings: faker.datatype.boolean(),
      pushNotifications: faker.datatype.boolean(),
      smsNotifications: false,
    });
  }),

  http.patch(API_SETTINGS_NOTIFICATIONS, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 600 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.settings.notificationPreferencesUpdated',
        'Notification preferences updated'
      ),
      data: body,
      updatedAt: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const settingsStatusHandlers = {
  success: settingsHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.patch(API_SETTINGS_ACCOUNT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'VALIDATION_ERROR',
          i18n.t('handler.settings.invalidSettingsData', 'Invalid settings data'),
          API_SETTINGS_ACCOUNT,
          {
            name: i18n.t('handler.settings.nameCannotBeEmpty', 'Name cannot be empty'),
            language: i18n.t('handler.settings.invalidLanguageCode', 'Invalid language code'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SETTINGS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.settings.pleaseLogInToAccess', 'Please log in to access settings'),
          API_SETTINGS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.patch(API_SETTINGS_BILLING, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.settings.youDoNotHavePermission',
            'You do not have permission to modify billing settings'
          ),
          API_SETTINGS_BILLING
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(`${API_SETTINGS_PAYMENT_METHODS}/:id`, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Payment method ${params.id} not found`,
          `${API_SETTINGS_PAYMENT_METHODS}/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.patch(API_SETTINGS_ACCOUNT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.settings.validationFailed', 'Validation failed'),
          API_SETTINGS_ACCOUNT,
          {
            email: i18n.t('handler.settings.invalidEmailFormat', 'Invalid email format'),
            dob: i18n.t('handler.settings.dateOfBirthMustBe', 'Date of birth must be in the past'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SETTINGS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.settings.anUnexpectedErrorOccurredWhile',
            'An unexpected error occurred while loading settings'
          ),
          API_SETTINGS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SETTINGS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_DOWN',
          i18n.t(
            'handler.settings.settingsServiceIsTemporarilyUnavailable',
            'Settings service is temporarily unavailable'
          ),
          API_SETTINGS
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SETTINGS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SETTINGS_ACCOUNT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SETTINGS_BILLING, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SETTINGS, async () => {
      await delay(5000);
      return HttpResponse.json({
        account: { name: i18n.t('handler.settings.johnDoe', 'John Doe'), language: 'en' },
        appearance: { theme: 'light', font: 'inter' },
      });
    }),
  ],

  networkError: [
    http.get(API_SETTINGS, () => HttpResponse.error()),
    http.patch(API_SETTINGS_ACCOUNT, () => HttpResponse.error()),
  ],

  emptyData: [
    http.get(API_SETTINGS_TRANSACTIONS, async () => {
      await delay(300);
      return HttpResponse.json({
        transactions: [],
        total: 0,
      });
    }),
  ],
};
