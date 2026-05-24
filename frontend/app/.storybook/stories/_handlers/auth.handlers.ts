import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// AUTH HANDLERS
// Enterprise-grade MSW handlers for authentication pages:
// - Login (v1, v2)
// - Register (v1, v2)
// - Forgot Password
// ============================================================================

// API Endpoints
const API_AUTH = '/api/auth';
const API_AUTH_LOGIN = '/api/auth/login';
const API_AUTH_REGISTER = '/api/auth/register';
const API_AUTH_FORGOT_PASSWORD = '/api/auth/forgot-password';
const API_AUTH_RESET_PASSWORD = '/api/auth/reset-password';
const API_AUTH_VERIFY_EMAIL = '/api/auth/verify-email';
const API_AUTH_RESEND_VERIFICATION = '/api/auth/resend-verification';
const API_AUTH_LOGOUT = '/api/auth/logout';
const API_AUTH_ME = '/api/auth/me';
const API_AUTH_REFRESH = '/api/auth/refresh';
const API_AUTH_SOCIAL = '/api/auth/social';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const authHandlers = [
  // Login
  http.post(API_AUTH_LOGIN, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 800 }));
    const body = (await request.json()) as {
      email: string;
      password: string;
      rememberMe?: boolean;
    };

    return HttpResponse.json({
      success: true,
      user: {
        id: faker.string.uuid(),
        email: body.email,
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
        role: faker.helpers.arrayElement(['user', 'admin', 'moderator']),
        verified: true,
        createdAt: faker.date.past().toISOString(),
      },
      token: {
        accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${faker.string.alphanumeric(100)}`,
        refreshToken: faker.string.alphanumeric(64),
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
  }),

  // Register
  http.post(API_AUTH_REGISTER, async ({ request }) => {
    await delay(faker.number.int({ min: 400, max: 1000 }));
    const body = (await request.json()) as { email: string; name: string; password: string };

    return HttpResponse.json({
      success: true,
      user: {
        id: faker.string.uuid(),
        email: body.email,
        name: body.name,
        role: 'user',
        verified: false,
        createdAt: new Date().toISOString(),
      },
      message: i18n.t(
        'handler.auth.registrationSuccessfulPleaseCheckYour',
        'Registration successful. Please check your email to verify your account.'
      ),
      verificationEmailSent: true,
    });
  }),

  // Forgot Password
  http.post(API_AUTH_FORGOT_PASSWORD, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    const body = (await request.json()) as { email: string };

    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.auth.passwordResetInstructionsSentTo',
        'Password reset instructions sent to {{email}}',
        { email: body.email }
      ),
      expiresIn: 3600,
    });
  }),

  // Reset Password
  http.post(API_AUTH_RESET_PASSWORD, async ({ request }) => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    const body = (await request.json()) as { password: string; token: string };

    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.auth.passwordHasBeenResetSuccessfully',
        'Password has been reset successfully'
      ),
      token: body.token,
    });
  }),

  // Verify Email
  http.post(API_AUTH_VERIFY_EMAIL, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { token: string };

    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.auth.emailVerifiedSuccessfully', 'Email verified successfully'),
      verified: true,
      token: body.token,
    });
  }),

  // Resend Verification
  http.post(API_AUTH_RESEND_VERIFICATION, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { email: string };

    return HttpResponse.json({
      success: true,
      message: i18n.t(
        'handler.auth.verificationEmailSentTo',
        'Verification email sent to {{email}}',
        { email: body.email }
      ),
      sentAt: new Date().toISOString(),
    });
  }),

  // Logout
  http.post(API_AUTH_LOGOUT, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.auth.loggedOutSuccessfully', 'Logged out successfully'),
      loggedOutAt: new Date().toISOString(),
    });
  }),

  // Get Current User
  http.get(API_AUTH_ME, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));

    return HttpResponse.json({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement(['user', 'admin']),
      verified: true,
      createdAt: faker.date.past().toISOString(),
      lastLogin: faker.date.recent().toISOString(),
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: true,
      },
    });
  }),

  // Refresh Token
  http.post(API_AUTH_REFRESH, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${faker.string.alphanumeric(100)}`,
      expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }),

  // Social Auth
  http.post(`${API_AUTH_SOCIAL}/:provider`, async ({ params }) => {
    await delay(faker.number.int({ min: 500, max: 1000 }));
    const provider = params.provider as string;

    return HttpResponse.json({
      success: true,
      provider,
      authUrl: `https://accounts.${provider}.com/oauth/authorize?client_id=${faker.string.alphanumeric(20)}`,
      state: faker.string.alphanumeric(32),
    });
  }),

  // Auth Status
  http.get(API_AUTH, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));

    return HttpResponse.json({
      version: '1.0.0',
      providers: ['email', 'google', 'github', 'twitter'],
      features: {
        registration: true,
        socialLogin: true,
        passwordReset: true,
        emailVerification: true,
        twoFactor: false,
      },
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const authStatusHandlers = {
  success: authHandlers,

  // Invalid Credentials
  invalidCredentials: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'INVALID_CREDENTIALS',
          i18n.t('handler.auth.invalidEmailOrPassword', 'Invalid email or password'),
          API_AUTH_LOGIN
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  // Account Locked
  accountLocked: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCOUNT_LOCKED',
          i18n.t(
            'handler.auth.accountIsLockedPleaseContact',
            'Account is locked. Please contact support.'
          ),
          API_AUTH_LOGIN
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  // Email Not Verified
  emailNotVerified: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'EMAIL_NOT_VERIFIED',
          i18n.t(
            'handler.auth.pleaseVerifyYourEmailBefore',
            'Please verify your email before logging in'
          ),
          API_AUTH_LOGIN
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  // Email Already Exists
  emailExists: [
    http.post(API_AUTH_REGISTER, async () => {
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'EMAIL_EXISTS',
          i18n.t(
            'handler.auth.anAccountWithThisEmail',
            'An account with this email already exists'
          ),
          API_AUTH_REGISTER
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // Weak Password
  weakPassword: [
    http.post(API_AUTH_REGISTER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'WEAK_PASSWORD',
          i18n.t(
            'handler.auth.passwordMustBeAtLeast',
            'Password must be at least 8 characters with uppercase, lowercase, and numbers'
          ),
          API_AUTH_REGISTER
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // Invalid Reset Token
  invalidResetToken: [
    http.post(API_AUTH_RESET_PASSWORD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_TOKEN',
          i18n.t(
            'handler.auth.passwordResetLinkIsInvalid',
            'Password reset link is invalid or has expired'
          ),
          API_AUTH_RESET_PASSWORD
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  // Too Many Attempts
  tooManyAttempts: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'TOO_MANY_ATTEMPTS',
          i18n.t(
            'handler.auth.tooManyLoginAttemptsPlease',
            'Too many login attempts. Please try again in 15 minutes.'
          ),
          API_AUTH_LOGIN
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // Session Expired
  sessionExpired: [
    http.get(API_AUTH_ME, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t(
            'handler.auth.yourSessionHasExpiredPlease',
            'Your session has expired. Please log in again.'
          ),
          API_AUTH_ME
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  // Server Error
  badRequest: [
    http.post(API_AUTH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.auth.invalidRequestParameters', 'Invalid request parameters'),
          API_AUTH,
          {
            field: 'data',
            error: i18n.t('handler.auth.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_AUTH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.auth.authenticationRequired', 'Authentication required'),
          API_AUTH
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_AUTH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.auth.accessDeniedToThisResource', 'Access denied to this resource'),
          API_AUTH
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_AUTH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.auth.requestValidationFailed', 'Request validation failed'),
          API_AUTH,
          {
            field: 'data',
            error: i18n.t('handler.auth.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.auth.anUnexpectedErrorOccurredPlease',
            'An unexpected error occurred. Please try again later.'
          ),
          API_AUTH_LOGIN
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // Service Unavailable
  serviceUnavailable: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_DOWN',
          i18n.t(
            'handler.auth.authenticationServiceIsTemporarilyUnavailable',
            'Authentication service is temporarily unavailable'
          ),
          API_AUTH_LOGIN
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  // Loading States
  loading: [
    http.post(API_AUTH_LOGIN, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.post(API_AUTH_REGISTER, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.post(API_AUTH_FORGOT_PASSWORD, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  // Network Error
  networkError: [
    http.post(API_AUTH_LOGIN, () => HttpResponse.error()),
    http.post(API_AUTH_REGISTER, () => HttpResponse.error()),
  ],

  // Slow Response
  slowResponse: [
    http.post(API_AUTH_LOGIN, async ({ request }) => {
      await delay(5000);
      const body = (await request.json()) as { email: string };
      return HttpResponse.json({
        success: true,
        user: {
          id: faker.string.uuid(),
          email: body.email,
          name: faker.person.fullName(),
        },
        token: { accessToken: faker.string.alphanumeric(100) },
      });
    }),
  ],
};
