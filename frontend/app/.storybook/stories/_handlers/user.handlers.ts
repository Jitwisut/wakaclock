import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeUser, createFakeUsers, createFakeUserSession } from '../_factories/user.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_USER_ME = '/api/user/me';
const API_USERS = '/api/users';
const API_USER_BY_ID = '/api/user/:id';
const API_AUTH_LOGIN = '/api/auth/login';
const API_AUTH_LOGOUT = '/api/auth/logout';

// Default success handlers
export const userHandlers = [
  // GET /api/user/me
  http.get(API_USER_ME, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json(createFakeUser({ role: 'admin' }));
  }),

  // GET /api/users
  http.get(API_USERS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    await delay(faker.number.int({ min: 300, max: 800 }));
    return HttpResponse.json({
      users: createFakeUsers(limit),
      total: faker.number.int({ min: limit, max: 100 }),
    });
  }),

  // GET /api/user/:id
  http.get(API_USER_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json(createFakeUser({ id: params.id as string }));
  }),

  // POST /api/users
  http.post(API_USERS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 300, max: 600 }));
    return HttpResponse.json(createFakeUser({ ...(body as object), id: faker.string.uuid() }), {
      status: HTTP_STATUS.CREATED,
    });
  }),

  // PATCH /api/user/:id
  http.patch(API_USER_BY_ID, async ({ params, request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 600 }));
    return HttpResponse.json(createFakeUser({ ...(body as object), id: params.id as string }));
  }),

  // DELETE /api/user/:id
  http.delete(API_USER_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // POST /api/auth/login
  http.post(API_AUTH_LOGIN, async () => {
    await delay(faker.number.int({ min: 500, max: 1000 }));
    return HttpResponse.json(createFakeUserSession());
  }),

  // POST /api/auth/logout
  http.post(API_AUTH_LOGOUT, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),
];

// Status-specific handlers for stories
export const userStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: userHandlers,

  created: [
    http.post(API_USERS, async ({ request }) => {
      const body = await request.json();
      await delay(faker.number.int({ min: 300, max: 600 }));
      return HttpResponse.json(createFakeUser({ ...(body as object), id: faker.string.uuid() }), {
        status: HTTP_STATUS.CREATED,
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'VALIDATION_ERROR',
          i18n.t('handler.user.invalidUserData', 'Invalid user data'),
          API_USERS,
          {
            email: i18n.t('handler.user.invalidEmailFormat', 'Invalid email format'),
            name: i18n.t('handler.user.nameIsRequired', 'Name is required'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.patch(API_USER_BY_ID, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.user.requestBodyIsMalformed', 'Request body is malformed'),
          API_USER_BY_ID
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_USER_ME, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.user.pleaseLogInToContinue', 'Please log in to continue'),
          API_USER_ME
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'TOKEN_EXPIRED',
          i18n.t('handler.user.yourSessionHasExpired', 'Your session has expired'),
          API_USERS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.user.adminAccessRequired', 'Admin access required'),
          API_USERS,
          {
            requiredRole: 'admin',
            currentRole: 'user',
          }
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.delete(API_USER_BY_ID, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.user.cannotDeleteYourOwnAccount', 'Cannot delete your own account'),
          API_USER_BY_ID
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_USER_BY_ID, async ({ params }) => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'USER_NOT_FOUND',
          `User ${params.id} not found`,
          `/api/user/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.delete(API_USER_BY_ID, async ({ params }) => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'USER_NOT_FOUND',
          `User ${params.id} not found`,
          `/api/user/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_USERS, async ({ request }) => {
      const body = (await request.json()) as { email?: string };
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'EMAIL_EXISTS',
          i18n.t('handler.user.emailAlreadyRegistered', 'Email already registered'),
          API_USERS,
          {
            email: body.email ?? 'user@example.com',
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.user.validationFailed', 'Validation failed'),
          API_USERS,
          {
            email: i18n.t('handler.user.emailFormatIsInvalid', 'Email format is invalid'),
            password: i18n.t(
              'handler.user.passwordMustBeAtLeast',
              'Password must be at least 8 characters'
            ),
            name: i18n.t('handler.user.nameMustBeAtLeast', 'Name must be at least 2 characters'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
    http.patch(API_USER_BY_ID, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.user.validationFailed', 'Validation failed'),
          API_USER_BY_ID,
          {
            email: i18n.t('handler.user.emailFormatIsInvalid', 'Email format is invalid'),
            phone: i18n.t('handler.user.phoneNumberMustBe10', 'Phone number must be 10 digits'),
            role: i18n.t('handler.user.invalidRoleSpecified', 'Invalid role specified'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 100, max: 300 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.user.rateLimitExceeded', 'Rate limit exceeded'),
          API_USERS,
          {
            limit: '100',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_AUTH_LOGIN, async () => {
      await delay(faker.number.int({ min: 100, max: 300 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'LOGIN_ATTEMPTS_EXCEEDED',
          i18n.t('handler.user.tooManyLoginAttempts', 'Too many login attempts'),
          API_AUTH_LOGIN,
          {
            attempts: '5',
            lockoutUntil: new Date(Date.now() + 900_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.user.anUnexpectedErrorOccurred', 'An unexpected error occurred'),
          API_USERS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_USER_ME, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.user.databaseConnectionFailed', 'Database connection failed'),
          API_USER_ME
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.user.invalidResponseFromUpstreamServer',
            'Invalid response from upstream server'
          ),
          API_USERS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.user.systemUnderMaintenance', 'System under maintenance'),
          API_USERS,
          {
            retryAfter: '300',
            estimatedEnd: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.user.requestTimedOut', 'Request timed out'),
          API_USERS,
          {
            timeout: '30000',
          }
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_USERS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_USER_ME, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 3000, max: 5000 }));
      return HttpResponse.json({
        users: createFakeUsers(10),
        total: 100,
      });
    }),
  ],

  networkError: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.error();
    }),
    http.get(API_USER_ME, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_USERS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json({
        users: [],
        total: 0,
      });
    }),
  ],
};
