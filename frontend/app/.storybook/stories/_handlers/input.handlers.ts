import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_INPUT_VALIDATE = '/api/input/validate';
const API_INPUT_AUTOCOMPLETE = '/api/input/autocomplete';
const API_INPUT_SUBMIT = '/api/input/submit';
const API_OTP_VERIFY = '/api/otp/verify';
const API_OTP_RESEND = '/api/otp/resend';

// Default success handlers
export const inputHandlers = [
  // POST /api/input/validate - Validate input value
  http.post(API_INPUT_VALIDATE, async ({ request }) => {
    const body = (await request.json()) as { field: string; value: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    const isValid = body.value && body.value.length >= 2;
    return HttpResponse.json({
      valid: isValid,
      field: body.field,
      message: isValid
        ? i18n.t('handler.input.validInput', 'Valid input')
        : i18n.t('handler.input.inputTooShort', 'Input too short'),
    });
  }),

  // GET /api/input/autocomplete - Autocomplete suggestions
  http.get(API_INPUT_AUTOCOMPLETE, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    await delay(faker.number.int({ min: 150, max: 400 }));

    const suggestions = query
      ? Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
          id: faker.string.uuid(),
          label: `${query}${faker.lorem.word()}`,
          value: faker.lorem.slug(),
        }))
      : [];

    return HttpResponse.json({ suggestions, query });
  }),

  // POST /api/input/submit - Submit form input
  http.post(API_INPUT_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      data: body,
      id: faker.string.uuid(),
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/otp/verify - Verify OTP code
  http.post(API_OTP_VERIFY, async ({ request }) => {
    const body = (await request.json()) as { code: string };
    await delay(faker.number.int({ min: 300, max: 500 }));

    const isValid = body.code && body.code.length === 6;
    if (isValid) {
      return HttpResponse.json({
        success: true,
        verified: true,
        token: faker.string.alphanumeric(32),
      });
    }
    return HttpResponse.json(
      createApiError(
        HTTP_STATUS.BAD_REQUEST,
        'INVALID_OTP',
        i18n.t('handler.input.invalidVerificationCode', 'Invalid verification code'),
        API_OTP_VERIFY
      ),
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }),

  // POST /api/otp/resend - Resend OTP code
  http.post(API_OTP_RESEND, async () => {
    await delay(faker.number.int({ min: 500, max: 1000 }));

    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.input.newCodeSent', 'New code sent'),
      expiresIn: 300,
    });
  }),
];

// Status-specific handlers for stories
export const inputStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: inputHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_INPUT_VALIDATE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'VALIDATION_ERROR',
          i18n.t('handler.input.invalidInputFormat', 'Invalid input format'),
          API_INPUT_VALIDATE,
          {
            field: i18n.t('handler.input.requiredFieldMissing', 'Required field missing'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.input.authenticationRequired', 'Authentication required'),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.input.youCannotSubmitThisForm', 'You cannot submit this form'),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.input.formEndpointNotFound', 'Form endpoint not found'),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.input.dataConflictDetectedInputWas',
            'Data conflict detected. Input was modified by another session.'
          ),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  validationError: [
    http.post(API_INPUT_VALIDATE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          i18n.t('handler.input.validationFailed', 'Validation failed'),
          API_INPUT_VALIDATE,
          {
            email: i18n.t('handler.input.invalidEmailFormat', 'Invalid email format'),
            password: i18n.t(
              'handler.input.passwordMustBeAtLeast',
              'Password must be at least 8 characters'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.input.unableToProcessInput', 'Unable to process input'),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_OTP_RESEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.input.tooManyOtpRequests', 'Too many OTP requests'),
          API_OTP_RESEND,
          {
            limit: '3/hour',
            remaining: '0',
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SUBMIT_FAILED',
          i18n.t('handler.input.failedToProcessInput', 'Failed to process input'),
          API_INPUT_SUBMIT,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.input.formServiceUnavailable', 'Form service unavailable'),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.input.serviceUnderMaintenance', 'Service under maintenance'),
          API_INPUT_SUBMIT,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.input.requestTimedOut', 'Request timed out'),
          API_INPUT_SUBMIT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        id: faker.string.uuid(),
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  slowSubmission: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(6000);
      return HttpResponse.json({
        success: true,
        id: faker.string.uuid(),
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_INPUT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyAutocomplete: [
    http.get(API_INPUT_AUTOCOMPLETE, async () => {
      await delay(300);
      return HttpResponse.json({ suggestions: [], query: '' });
    }),
  ],
};
