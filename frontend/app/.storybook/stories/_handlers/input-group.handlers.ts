import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_INPUT_GROUP_SEARCH = '/api/input-group/search';
const API_INPUT_GROUP_VALIDATE = '/api/input-group/validate';
const API_INPUT_GROUP_SUBMIT = '/api/input-group/submit';

// Default success handlers
export const inputGroupHandlers = [
  // GET /api/input-group/search - Search with input group
  http.get(API_INPUT_GROUP_SEARCH, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const type = url.searchParams.get('type') ?? 'all';
    await delay(faker.number.int({ min: 150, max: 400 }));

    const results = query
      ? Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () => ({
          id: faker.string.uuid(),
          title: faker.lorem.sentence(),
          type,
          relevance: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 }),
        }))
      : [];

    return HttpResponse.json({
      query,
      type,
      results,
      total: results.length,
      searchTime: faker.number.int({ min: 10, max: 200 }),
    });
  }),

  // POST /api/input-group/validate - Validate input group values
  http.post(API_INPUT_GROUP_VALIDATE, async ({ request }) => {
    const body = (await request.json()) as { fields: Record<string, string> };
    await delay(faker.number.int({ min: 100, max: 250 }));

    const errors: Record<string, string> = {};
    let isValid = true;

    // Simulate validation for common field patterns
    for (const [field, value] of Object.entries(body.fields)) {
      if (field.includes('email') && value && !value.includes('@')) {
        errors[field] = i18n.t('handler.inputGroup.invalidEmailFormat', 'Invalid email format');
        isValid = false;
      }
      if (field.includes('phone') && value && !/^\+?[\d\s-]+$/.test(value)) {
        errors[field] = i18n.t(
          'handler.inputGroup.invalidPhoneNumberFormat',
          'Invalid phone number format'
        );
        isValid = false;
      }
      if (field.includes('url') && value && !value.startsWith('http')) {
        errors[field] = i18n.t(
          'handler.inputGroup.urlMustStartWithHttp',
          'URL must start with http:// or https://'
        );
        isValid = false;
      }
    }

    return HttpResponse.json({
      valid: isValid,
      errors: isValid ? undefined : errors,
      validatedAt: new Date().toISOString(),
    });
  }),

  // POST /api/input-group/submit - Submit input group form
  http.post(API_INPUT_GROUP_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      data: body,
      submittedAt: new Date().toISOString(),
      submissionId: faker.string.uuid(),
    });
  }),
];

// Status-specific handlers for stories
export const inputGroupStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: inputGroupHandlers,

  // ============ 4xx CLIENT ERRORS ============
  validationError: [
    http.post(API_INPUT_GROUP_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json({
        valid: false,
        errors: {
          email: i18n.t(
            'handler.inputGroup.pleaseEnterAValidEmail',
            'Please enter a valid email address'
          ),
          phone: i18n.t('handler.inputGroup.phoneNumberIsRequired', 'Phone number is required'),
          website: i18n.t('handler.inputGroup.invalidUrlFormat', 'Invalid URL format'),
        },
      });
    }),
  ],

  badRequest: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.inputGroup.invalidFormData', 'Invalid form data'),
          API_INPUT_GROUP_SUBMIT,
          {
            general: i18n.t(
              'handler.inputGroup.oneOrMoreFieldsHaveInvalidValues',
              'One or more fields have invalid values'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.inputGroup.pleaseLogInToSubmit', 'Please log in to submit'),
          API_INPUT_GROUP_SUBMIT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.inputGroup.youDoNotHavePermission',
            'You do not have permission to submit'
          ),
          API_INPUT_GROUP_SUBMIT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_INPUT_GROUP_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.inputGroup.searchEndpointNotFound', 'Search endpoint not found'),
          API_INPUT_GROUP_SEARCH
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.inputGroup.dataConflictDetectedAnotherSubmission',
            'Data conflict detected. Another submission is in progress.'
          ),
          API_INPUT_GROUP_SUBMIT,
          {
            suggestion: i18n.t(
              'handler.inputGroup.pleaseWaitAndTryAgain',
              'Please wait and try again'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          i18n.t('handler.inputGroup.unableToProcessFormData', 'Unable to process form data'),
          API_INPUT_GROUP_SUBMIT,
          {
            email: i18n.t('handler.inputGroup.emailFormatIsInvalid', 'Email format is invalid'),
            phone: i18n.t(
              'handler.inputGroup.phoneNumberMustIncludeCountry',
              'Phone number must include country code'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.inputGroup.tooManySubmissionsPleaseWait',
            'Too many submissions. Please wait before trying again'
          ),
          API_INPUT_GROUP_SUBMIT,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SUBMIT_FAILED',
          i18n.t('handler.inputGroup.failedToSubmitForm', 'Failed to submit form'),
          API_INPUT_GROUP_SUBMIT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.inputGroup.formServiceTemporarilyUnavailable',
            'Form service temporarily unavailable'
          ),
          API_INPUT_GROUP_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.inputGroup.serviceIsUnderMaintenance', 'Service is under maintenance'),
          API_INPUT_GROUP_SUBMIT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_INPUT_GROUP_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.inputGroup.requestTimedOutPleaseTry',
            'Request timed out. Please try again'
          ),
          API_INPUT_GROUP_SUBMIT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_INPUT_GROUP_SEARCH, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_INPUT_GROUP_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(5000);
      return HttpResponse.json({
        query,
        results: [
          {
            id: '1',
            title: i18n.t('handler.inputGroup.slowResponseResult', 'Slow response result'),
          },
        ],
        total: 1,
      });
    }),
  ],

  slowSearch: [
    http.get(API_INPUT_GROUP_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(3000);
      return HttpResponse.json({
        query,
        results: [{ id: '1', title: i18n.t('handler.inputGroup.slowResult', 'Slow result') }],
        total: 1,
      });
    }),
  ],

  networkError: [
    http.get(API_INPUT_GROUP_SEARCH, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  noResults: [
    http.get(API_INPUT_GROUP_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(200);
      return HttpResponse.json({
        query,
        results: [],
        total: 0,
        message: i18n.t(
          'handler.inputGroup.noResultsFoundForYour',
          'No results found for your search'
        ),
      });
    }),
  ],

  // ============ PREFIX/SUFFIX VALIDATION HANDLERS ============
  prefixValidation: [
    http.post(API_INPUT_GROUP_VALIDATE, async ({ request }) => {
      const body = (await request.json()) as { type?: string; value?: string };
      await delay(faker.number.int({ min: 100, max: 300 }));

      const value = body.value ?? '';
      const type = body.type ?? 'text';
      let isValid = true;
      let error: string | undefined;

      // URL validation - check prefix
      if (type === 'url') {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          isValid = false;
          error = i18n.t(
            'handler.inputGroup.urlMustIncludeHttpOr',
            'URL must include http:// or https:// prefix'
          );
        } else if (!value.includes('.')) {
          isValid = false;
          error = i18n.t(
            'handler.inputGroup.urlMustIncludeAValid',
            'URL must include a valid domain'
          );
        }
      }

      // Email validation
      if (type === 'email') {
        if (!value.includes('@')) {
          isValid = false;
          error = i18n.t(
            'handler.inputGroup.emailMustIncludeSymbol',
            'Email must include @ symbol'
          );
        } else if (!value.includes('.')) {
          isValid = false;
          error = i18n.t(
            'handler.inputGroup.emailMustIncludeAValid',
            'Email must include a valid domain'
          );
        }
      }

      // Currency validation
      if (type === 'currency') {
        const numValue = Number.parseFloat(value);
        if (Number.isNaN(numValue)) {
          isValid = false;
          error = i18n.t(
            'handler.inputGroup.pleaseEnterAValidAmount',
            'Please enter a valid amount'
          );
        } else if (numValue < 0) {
          isValid = false;
          error = i18n.t('handler.inputGroup.amountCannotBeNegative', 'Amount cannot be negative');
        }
      }

      // Phone validation
      if (type === 'phone') {
        const phoneRegex = /^\+?[\d\s()-]{7,}$/;
        if (!phoneRegex.test(value)) {
          isValid = false;
          error = i18n.t(
            'handler.inputGroup.pleaseEnterAValidPhone',
            'Please enter a valid phone number'
          );
        }
      }

      return HttpResponse.json({
        valid: isValid,
        error,
        type,
        value,
        validatedAt: new Date().toISOString(),
      });
    }),
  ],

  suffixClearAction: [
    http.post('/api/input-group/clear', async () => {
      await delay(faker.number.int({ min: 50, max: 150 }));
      return HttpResponse.json({
        success: true,
        clearedAt: new Date().toISOString(),
      });
    }),
  ],

  autocompleteSearch: [
    http.get('/api/input-group/autocomplete', async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(faker.number.int({ min: 100, max: 300 }));

      if (!query) {
        return HttpResponse.json({ suggestions: [] });
      }

      const suggestions = Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
        id: faker.string.uuid(),
        text: `${query}${faker.lorem.word()}`,
        type: faker.helpers.arrayElement(['recent', 'suggestion', 'popular']),
      }));

      return HttpResponse.json({
        query,
        suggestions,
        total: suggestions.length,
      });
    }),
  ],

  inputFocusTracker: [
    http.post('/api/input-group/focus', async ({ request }) => {
      const body = (await request.json()) as { focused?: boolean; inputId?: string };
      await delay(50);
      return HttpResponse.json({
        focused: body.focused,
        inputId: body.inputId,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  addonInteraction: [
    http.post('/api/input-group/addon-action', async ({ request }) => {
      const body = (await request.json()) as { action?: string; addonPosition?: string };
      await delay(faker.number.int({ min: 100, max: 250 }));
      return HttpResponse.json({
        success: true,
        action: body.action ?? 'click',
        addonPosition: body.addonPosition ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
    }),
  ],
};
