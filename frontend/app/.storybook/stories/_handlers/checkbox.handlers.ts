import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

const API_CHECKBOX_PREFERENCE = '/api/checkbox/preference';
const API_CHECKBOX_PREFERENCES = '/api/checkbox/preferences';
const API_CHECKBOX_TOGGLE = '/api/checkbox/toggle';
const API_CHECKBOX_BULK_UPDATE = '/api/checkbox/bulk-update';
const API_TERMS_ACCEPT = '/api/terms/accept';
const API_COOKIE_CONSENT = '/api/cookie/consent';

// ═══════════════════════════════════════════════════════════════
// DEFAULT SUCCESS HANDLERS
// ═══════════════════════════════════════════════════════════════

export const checkboxHandlers = [
  // POST /api/checkbox/preference - Save single checkbox preference
  http.post(API_CHECKBOX_PREFERENCE, async ({ request }) => {
    const body = (await request.json()) as { checked: boolean; id: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      preference: {
        id: body.id,
        checked: body.checked,
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  // GET /api/checkbox/preferences - Get all checkbox preferences
  http.get(API_CHECKBOX_PREFERENCES, async () => {
    await delay(faker.number.int({ min: 150, max: 400 }));

    return HttpResponse.json({
      preferences: [
        {
          id: 'terms',
          checked: true,
          label: i18n.t('handler.checkbox.acceptTerms', 'Accept terms'),
        },
        {
          id: 'newsletter',
          checked: false,
          label: i18n.t('handler.checkbox.subscribeToNewsletter', 'Subscribe to newsletter'),
        },
        {
          id: 'marketing',
          checked: false,
          label: i18n.t('handler.checkbox.receiveMarketingEmails', 'Receive marketing emails'),
        },
        {
          id: 'analytics',
          checked: true,
          label: i18n.t('handler.checkbox.allowAnalytics', 'Allow analytics'),
        },
      ],
    });
  }),

  // POST /api/checkbox/toggle - Toggle checkbox state
  http.post(API_CHECKBOX_TOGGLE, async ({ request }) => {
    const body = (await request.json()) as { currentState: boolean; id: string };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      id: body.id,
      checked: !body.currentState,
      toggledAt: new Date().toISOString(),
    });
  }),

  // POST /api/checkbox/bulk-update - Bulk update multiple checkboxes
  http.post(API_CHECKBOX_BULK_UPDATE, async ({ request }) => {
    const body = (await request.json()) as { items: Array<{ checked: boolean; id: string }> };
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({
      success: true,
      updated: body.items.length,
      items: body.items.map((item) => ({
        ...item,
        updatedAt: new Date().toISOString(),
      })),
    });
  }),

  // POST /api/terms/accept - Accept terms and conditions
  http.post(API_TERMS_ACCEPT, async ({ request }) => {
    const body = (await request.json()) as { accepted: boolean; version: string };
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      accepted: body.accepted,
      version: body.version,
      acceptedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  // POST /api/cookie/consent - Save cookie consent preferences
  http.post(API_COOKIE_CONSENT, async ({ request }) => {
    const body = (await request.json()) as {
      analytics: boolean;
      essential: boolean;
      marketing: boolean;
      preferences: boolean;
    };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      consent: {
        ...body,
        consentedAt: new Date().toISOString(),
        ipAddress: faker.internet.ipv4(),
      },
    });
  }),
];

// ═══════════════════════════════════════════════════════════════
// STATUS-SPECIFIC HANDLERS FOR STORIES
// ═══════════════════════════════════════════════════════════════

export const checkboxStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: checkboxHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PREFERENCE',
          i18n.t('handler.checkbox.invalidPreferenceData', 'Invalid preference data'),
          API_CHECKBOX_PREFERENCE,
          { id: i18n.t('handler.checkbox.preferenceIdIsRequired', 'Preference ID is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.checkbox.authenticationRequiredToSavePreferences',
            'Authentication required to save preferences'
          ),
          API_CHECKBOX_PREFERENCE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.checkbox.cannotModifySystemPreferences',
            'Cannot modify system preferences'
          ),
          API_CHECKBOX_PREFERENCE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PREFERENCE_NOT_FOUND',
          i18n.t('handler.checkbox.preferenceNotFound', 'Preference not found'),
          API_CHECKBOX_PREFERENCE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.checkbox.preferenceAlreadyExistsWithDifferent',
            'Preference already exists with different value'
          ),
          API_CHECKBOX_PREFERENCE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.checkbox.requestValidationFailed', 'Request validation failed'),
          API_CHECKBOX_PREFERENCE,
          {
            field: 'data',
            error: i18n.t('handler.checkbox.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.checkbox.tooManyPreferenceUpdates', 'Too many preference updates'),
          API_CHECKBOX_PREFERENCE,
          {
            limit: '10/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t(
            'handler.checkbox.failedToSaveCheckboxPreference',
            'Failed to save checkbox preference'
          ),
          API_CHECKBOX_PREFERENCE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.checkbox.preferenceServiceUnavailable', 'Preference service unavailable'),
          API_CHECKBOX_PREFERENCE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.checkbox.preferenceServiceUnderMaintenance',
            'Preference service under maintenance'
          ),
          API_CHECKBOX_PREFERENCE,
          { retryAfter: '300' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.checkbox.requestTimedOut', 'Request timed out'),
          API_CHECKBOX_PREFERENCE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_CHECKBOX_PREFERENCE, async ({ request }) => {
      const body = (await request.json()) as { checked: boolean; id: string };
      await delay(3000);
      return HttpResponse.json({
        success: true,
        preference: { id: body.id, checked: body.checked },
      });
    }),
  ],

  verySlowResponse: [
    http.post(API_CHECKBOX_PREFERENCE, async ({ request }) => {
      const body = (await request.json()) as { checked: boolean; id: string };
      await delay(8000);
      return HttpResponse.json({
        success: true,
        preference: { id: body.id, checked: body.checked },
      });
    }),
  ],

  networkError: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // ============ VALIDATION STATES ============
  validationError: [
    http.post(API_CHECKBOX_PREFERENCE, async () => {
      await delay(200);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            'VALIDATION_ERROR',
            i18n.t('handler.checkbox.preferenceValidationFailed', 'Preference validation failed'),
            API_CHECKBOX_PREFERENCE
          ),
          errors: {
            terms: i18n.t(
              'handler.checkbox.youMustAcceptTheTerms',
              'You must accept the terms to continue'
            ),
          },
        },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ TERMS & CONDITIONS HANDLERS ============
  termsSuccess: [
    http.post(API_TERMS_ACCEPT, async ({ request }) => {
      const body = (await request.json()) as { accepted: boolean };
      await delay(500);
      return HttpResponse.json({
        success: true,
        accepted: body.accepted,
        acceptedAt: new Date().toISOString(),
      });
    }),
  ],

  termsRequired: [
    http.post(API_TERMS_ACCEPT, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.BAD_REQUEST,
            'TERMS_REQUIRED',
            i18n.t(
              'handler.checkbox.youMustAcceptTheTerms',
              'You must accept the terms to continue'
            ),
            API_TERMS_ACCEPT
          ),
          field: 'terms',
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  termsExpired: [
    http.post(API_TERMS_ACCEPT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GONE,
          'TERMS_EXPIRED',
          i18n.t(
            'handler.checkbox.termsVersionHasExpiredPlease',
            'Terms version has expired. Please review the new terms.'
          ),
          API_TERMS_ACCEPT
        ),
        { status: HTTP_STATUS.GONE }
      );
    }),
  ],

  // ============ COOKIE CONSENT HANDLERS ============
  cookieConsentSuccess: [
    http.post(API_COOKIE_CONSENT, async ({ request }) => {
      const body = (await request.json()) as Record<string, boolean>;
      await delay(200);
      return HttpResponse.json({
        success: true,
        consent: body,
        savedAt: new Date().toISOString(),
      });
    }),
  ],

  cookieConsentRequired: [
    http.post(API_COOKIE_CONSENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'ESSENTIAL_REQUIRED',
          i18n.t(
            'handler.checkbox.essentialCookiesMustBeAccepted',
            'Essential cookies must be accepted'
          ),
          API_COOKIE_CONSENT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  // ============ BULK UPDATE HANDLERS ============
  bulkUpdateSuccess: [
    http.post(API_CHECKBOX_BULK_UPDATE, async ({ request }) => {
      const body = (await request.json()) as { items: Array<{ checked: boolean; id: string }> };
      await delay(faker.number.int({ min: 300, max: 700 }));
      return HttpResponse.json({
        success: true,
        updated: body.items.length,
        items: body.items,
      });
    }),
  ],

  bulkUpdatePartialFailure: [
    http.post(API_CHECKBOX_BULK_UPDATE, async ({ request }) => {
      const body = (await request.json()) as { items: Array<{ checked: boolean; id: string }> };
      await delay(500);
      const failedIndex = Math.floor(body.items.length / 2);
      return HttpResponse.json(
        {
          success: false,
          updated: failedIndex,
          failed: body.items.length - failedIndex,
          errors: body.items.slice(failedIndex).map((item) => ({
            id: item.id,
            error: i18n.t('handler.checkbox.failedToUpdate', 'Failed to update'),
          })),
        },
        { status: 207 }
      );
    }),
  ],
};
