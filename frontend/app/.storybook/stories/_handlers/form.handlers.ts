import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeFormSubmitResponse } from '../_factories/form.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_FORM_SUBMIT = '/api/form/submit';
const API_VALIDATE_EMAIL = '/api/validate/email';
const API_VALIDATE_USERNAME = '/api/validate/username';
const API_VERIFY_OTP = '/api/verify/otp';
const API_UPLOAD = '/api/upload';
const API_CONTACT = '/api/contact';

// Default success handlers
export const formHandlers = [
  // POST /api/form/submit
  http.post(API_FORM_SUBMIT, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    await delay(faker.number.int({ min: 500, max: 1500 }));

    // Simulate basic validation
    if (body.email && !body.email.includes('@')) {
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'VALIDATION_ERROR',
          i18n.t('handler.form.invalidEmailFormat', 'Invalid email format'),
          API_FORM_SUBMIT,
          {
            email: i18n.t('handler.form.invalidEmailFormat', 'Invalid email format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    return HttpResponse.json(createFakeFormSubmitResponse(true));
  }),

  // POST /api/validate/email
  http.post(API_VALIDATE_EMAIL, async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    await delay(faker.number.int({ min: 200, max: 500 }));

    const isAvailable = !email.includes('taken');
    return HttpResponse.json({
      available: isAvailable,
      message: isAvailable
        ? i18n.t('handler.form.emailIsAvailable', 'Email is available')
        : i18n.t('handler.form.emailIsAlreadyRegistered', 'Email is already registered'),
    });
  }),

  // POST /api/validate/username
  http.post(API_VALIDATE_USERNAME, async ({ request }) => {
    const { username } = (await request.json()) as { username: string };
    await delay(faker.number.int({ min: 200, max: 500 }));

    const isAvailable = !username.includes('admin');
    return HttpResponse.json({
      available: isAvailable,
      message: isAvailable
        ? i18n.t('handler.form.usernameIsAvailable', 'Username is available')
        : i18n.t('handler.form.usernameIsAlreadyTaken', 'Username is already taken'),
    });
  }),

  // POST /api/verify/otp
  http.post(API_VERIFY_OTP, async ({ request }) => {
    const { otp } = (await request.json()) as { otp: string };
    await delay(faker.number.int({ min: 300, max: 800 }));

    const isValid = otp === '123456';
    return HttpResponse.json(
      {
        valid: isValid,
        message: isValid
          ? i18n.t('handler.form.otpVerified', 'OTP verified')
          : i18n.t('handler.form.invalidOtpCode', 'Invalid OTP code'),
      },
      { status: isValid ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST }
    );
  }),

  // POST /api/upload
  http.post(API_UPLOAD, async () => {
    await delay(faker.number.int({ min: 1000, max: 3000 }));
    return HttpResponse.json(
      {
        url: faker.image.url(),
        filename: faker.system.fileName(),
        size: faker.number.int({ min: 1000, max: 5_000_000 }),
      },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // POST /api/contact
  http.post(API_CONTACT, async () => {
    await delay(faker.number.int({ min: 500, max: 1500 }));
    return HttpResponse.json({
      success: true,
      ticketId: `TICKET-${faker.string.numeric(6)}`,
      message: i18n.t(
        'handler.form.yourMessageHasBeenReceived',
        'Your message has been received. We will get back to you soon.'
      ),
    });
  }),
];

// Status-specific handlers for stories
export const formStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: formHandlers,

  created: [
    http.post(API_FORM_SUBMIT, async ({ request }) => {
      const body = await request.json();
      await delay(800);
      return HttpResponse.json(
        { ...(body as object), id: faker.string.uuid(), createdAt: new Date().toISOString() },
        { status: HTTP_STATUS.CREATED }
      );
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_REQUEST',
          i18n.t('handler.form.requestBodyIsMalformed', 'Request body is malformed'),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.form.yourSessionHasExpired', 'Your session has expired'),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PERMISSION_DENIED',
          i18n.t('handler.form.youCannotSubmitThisForm', 'You cannot submit this form'),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.form.formValidationFailed', 'Form validation failed'),
          API_FORM_SUBMIT,
          {
            name: i18n.t('handler.form.nameMustBeAtLeast', 'Name must be at least 2 characters'),
            email: i18n.t(
              'handler.form.pleaseEnterAValidEmail',
              'Please enter a valid email address'
            ),
            phone: i18n.t(
              'handler.form.phoneNumberFormat1Xxx',
              'Phone number format: +1 (xxx) xxx-xxxx'
            ),
            password: i18n.t(
              'handler.form.passwordMustContainAtLeast',
              'Password must contain at least one uppercase letter, one number, and one special character'
            ),
            confirmPassword: i18n.t('handler.form.passwordsDoNotMatch', 'Passwords do not match'),
            terms: i18n.t(
              'handler.form.youMustAcceptTheTerms',
              'You must accept the terms and conditions'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  conflict: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ALREADY_SUBMITTED',
          i18n.t('handler.form.thisFormHasAlreadyBeen', 'This form has already been submitted'),
          API_FORM_SUBMIT,
          {
            previousSubmissionId: faker.string.uuid(),
            submittedAt: faker.date.recent().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  payloadTooLarge: [
    http.post(API_UPLOAD, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.PAYLOAD_TOO_LARGE,
          'FILE_TOO_LARGE',
          i18n.t('handler.form.fileSizeExceedsMaximumLimit', 'File size exceeds maximum limit'),
          API_UPLOAD,
          {
            maxSize: '10MB',
            receivedSize: '25MB',
          }
        ),
        { status: HTTP_STATUS.PAYLOAD_TOO_LARGE }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.form.tooManySubmissions', 'Too many submissions'),
          API_FORM_SUBMIT,
          {
            limit: '10/minute',
            retryAfter: '45',
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  notFound: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'FORM_NOT_FOUND',
          i18n.t('handler.form.formConfigurationNotFound', 'Form configuration not found'),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'PROCESSING_ERROR',
          i18n.t('handler.form.failedToProcessForm', 'Failed to process form'),
          API_FORM_SUBMIT,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.form.formProcessingServiceUnavailable',
            'Form processing service unavailable'
          ),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.form.formSubmissionIsTemporarilyDisabled',
            'Form submission is temporarily disabled'
          ),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.form.formProcessingTimedOut', 'Form processing timed out'),
          API_FORM_SUBMIT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowSubmission: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(5000);
      return HttpResponse.json(createFakeFormSubmitResponse(true));
    }),
  ],

  networkError: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(400);
      return HttpResponse.error();
    }),
  ],

  slowResponse: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(5000);
      return HttpResponse.json(createFakeFormSubmitResponse(true));
    }),
  ],

  emptyData: [
    http.post(API_FORM_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json({
        success: true,
        data: null,
        message: i18n.t('handler.form.noDataAvailable', 'No data available'),
      });
    }),
  ],

  // Alias for backward compatibility
  get empty() {
    return this.emptyData;
  },

  // ============ OTP SPECIFIC ============
  otpExpired: [
    http.post(API_VERIFY_OTP, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GONE,
          'OTP_EXPIRED',
          i18n.t('handler.form.thisOtpHasExpired', 'This OTP has expired'),
          API_VERIFY_OTP,
          {
            expiredAt: faker.date.recent().toISOString(),
          }
        ),
        { status: HTTP_STATUS.GONE }
      );
    }),
  ],

  otpMaxAttempts: [
    http.post(API_VERIFY_OTP, async () => {
      await delay(400);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'MAX_ATTEMPTS',
          i18n.t('handler.form.maximumOtpAttemptsExceeded', 'Maximum OTP attempts exceeded'),
          API_VERIFY_OTP,
          {
            attempts: '5',
            maxAttempts: '5',
            lockoutUntil: new Date(Date.now() + 900_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ VALIDATION SPECIFIC ============
  emailTaken: [
    http.post(API_VALIDATE_EMAIL, async () => {
      await delay(300);
      return HttpResponse.json({
        available: false,
        message: i18n.t(
          'handler.form.thisEmailIsAlreadyRegistered',
          'This email is already registered'
        ),
      });
    }),
  ],

  emailAvailable: [
    http.post(API_VALIDATE_EMAIL, async () => {
      await delay(300);
      return HttpResponse.json({
        available: true,
        message: i18n.t('handler.form.emailIsAvailable', 'Email is available'),
      });
    }),
  ],
};
