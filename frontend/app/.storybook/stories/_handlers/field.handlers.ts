import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_FIELD_VALIDATE = '/api/field/validate';
const API_FIELD_AUTOCOMPLETE = '/api/field/autocomplete';
const API_FIELD_SUBMIT = '/api/field/submit';

// Default success handlers
export const fieldHandlers = [
  // POST /api/field/validate - Validate field value
  http.post(API_FIELD_VALIDATE, async ({ request }) => {
    const body = (await request.json()) as {
      fieldName: string;
      rules?: string[];
      value: string;
    };
    await delay(faker.number.int({ min: 100, max: 300 }));

    // Simulate validation logic
    const validationResults: Record<string, { message?: string; valid: boolean }> = {
      email: {
        valid: body.value.includes('@') && body.value.includes('.'),
        message: i18n.t(
          'handler.field.pleaseEnterAValidEmail',
          'Please enter a valid email address'
        ),
      },
      password: {
        valid: body.value.length >= 8,
        message: i18n.t(
          'handler.field.passwordMustBeAtLeast',
          'Password must be at least 8 characters'
        ),
      },
      username: {
        valid: body.value.length >= 3 && /^[a-z0-9_]+$/i.test(body.value),
        message: i18n.t(
          'handler.field.usernameMustBeAtLeast',
          'Username must be at least 3 characters and contain only letters, numbers, and underscores'
        ),
      },
    };

    const result = validationResults[body.fieldName] ?? { valid: true };

    return HttpResponse.json({
      fieldName: body.fieldName,
      value: body.value,
      valid: result.valid,
      message: result.valid ? undefined : result.message,
    });
  }),

  // GET /api/field/autocomplete - Get autocomplete suggestions
  http.get(API_FIELD_AUTOCOMPLETE, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const fieldType = url.searchParams.get('type') ?? 'default';
    await delay(faker.number.int({ min: 150, max: 350 }));

    const suggestions: Record<string, string[]> = {
      email: ['@gmail.com', '@outlook.com', '@yahoo.com', '@icloud.com'].map(
        (domain) => `${query.split('@')[0]}${domain}`
      ),
      country: [
        i18n.t('handler.field.unitedStates', 'United States'),
        i18n.t('handler.field.unitedKingdom', 'United Kingdom'),
        i18n.t('handler.field.canada', 'Canada'),
        i18n.t('handler.field.australia', 'Australia'),
        i18n.t('handler.field.germany', 'Germany'),
      ].filter((c) => c.toLowerCase().includes(query.toLowerCase())),
      city: [
        i18n.t('handler.field.newYork', 'New York'),
        i18n.t('handler.field.losAngeles', 'Los Angeles'),
        i18n.t('handler.field.london', 'London'),
        i18n.t('handler.field.tokyo', 'Tokyo'),
        i18n.t('handler.field.paris', 'Paris'),
      ].filter((c) => c.toLowerCase().includes(query.toLowerCase())),
    };

    return HttpResponse.json({
      query,
      suggestions: suggestions[fieldType] ?? [],
      total: (suggestions[fieldType] ?? []).length,
    });
  }),

  // POST /api/field/submit - Submit field value
  http.post(API_FIELD_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as { fieldName: string; value: string };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      fieldName: body.fieldName,
      savedValue: body.value,
      savedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const fieldStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: fieldHandlers,

  // ============ 4xx CLIENT ERRORS ============
  validationError: [
    http.post(API_FIELD_VALIDATE, async ({ request }) => {
      const body = (await request.json()) as { fieldName: string };
      await delay(200);
      return HttpResponse.json({
        fieldName: body.fieldName,
        valid: false,
        message: i18n.t('handler.field.thisFieldHasAnInvalid', 'This field has an invalid value'),
        errors: [
          i18n.t('handler.field.valueIsRequired', 'Value is required'),
          i18n.t('handler.field.valueDoesNotMatchPattern', 'Value does not match pattern'),
        ],
      });
    }),
  ],

  badRequest: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_FIELD',
          i18n.t('handler.field.invalidFieldData', 'Invalid field data'),
          API_FIELD_SUBMIT,
          { fieldName: i18n.t('handler.field.fieldNameIsRequired', 'Field name is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.field.authenticationRequired', 'Authentication required'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.field.accessDenied', 'Access denied'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.field.unableToProcessField', 'Unable to process field'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.field.tooManyRequests', 'Too many requests'),
          API_FIELD_SUBMIT,
          {
            limit: '100/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  notFound: [
    http.get(API_FIELD_AUTOCOMPLETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'FIELD_NOT_FOUND',
          i18n.t('handler.field.fieldConfigurationNotFound', 'Field configuration not found'),
          API_FIELD_AUTOCOMPLETE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'FIELD_NOT_FOUND',
          i18n.t('handler.field.fieldNotFound', 'Field not found'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_FIELD_VALIDATE, async ({ request }) => {
      const body = (await request.json()) as { fieldName: string; value: string };
      await delay(200);
      return HttpResponse.json({
        fieldName: body.fieldName,
        value: body.value,
        valid: false,
        message: i18n.t('handler.field.thisValueIsAlreadyTaken', 'This value is already taken'),
        conflict: true,
      });
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_FIELD_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'VALIDATION_FAILED',
          i18n.t('handler.field.failedToValidateField', 'Failed to validate field'),
          API_FIELD_VALIDATE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.field.badGateway', 'Bad gateway'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t('handler.field.serviceUnavailable', 'Service unavailable'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.field.gatewayTimeout', 'Gateway timeout'),
          API_FIELD_SUBMIT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  slowSubmission: [
    http.post(API_FIELD_SUBMIT, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        fieldName: 'slow',
        savedValue: 'slow-value',
        savedAt: new Date().toISOString(),
      });
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_FIELD_VALIDATE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowValidation: [
    http.post(API_FIELD_VALIDATE, async ({ request }) => {
      const body = (await request.json()) as { fieldName: string; value: string };
      await delay(2000);
      return HttpResponse.json({
        fieldName: body.fieldName,
        value: body.value,
        valid: true,
      });
    }),
  ],

  slowResponse: [
    http.post(API_FIELD_VALIDATE, async ({ request }) => {
      const body = (await request.json()) as { fieldName: string; value: string };
      await delay(5000);
      return HttpResponse.json({
        fieldName: body.fieldName,
        value: body.value,
        valid: true,
      });
    }),
    http.post(API_FIELD_SUBMIT, async ({ request }) => {
      const body = (await request.json()) as { fieldName: string; value: string };
      await delay(5000);
      return HttpResponse.json({
        success: true,
        fieldName: body.fieldName,
        savedValue: body.value,
        savedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_FIELD_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // Autocomplete specific
  noSuggestions: [
    http.get(API_FIELD_AUTOCOMPLETE, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(200);
      return HttpResponse.json({
        query,
        suggestions: [],
        total: 0,
      });
    }),
  ],

  // Empty data state
  emptyData: [
    http.post(API_FIELD_VALIDATE, async ({ request }) => {
      const body = (await request.json()) as { fieldName: string };
      await delay(200);
      return HttpResponse.json({
        fieldName: body.fieldName,
        value: null,
        valid: true,
        isEmpty: true,
      });
    }),
  ],
};
