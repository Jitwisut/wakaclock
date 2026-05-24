import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// NAV USER HANDLERS
// Enterprise-grade MSW handlers for user navigation component
// ============================================================================

// API Endpoints
const API_NAV_USER = '/api/nav/user';
const API_NAV_USER_PROFILE = '/api/nav/user/profile';
const API_NAV_USER_MENU = '/api/nav/user/menu';
const API_NAV_USER_LOGOUT = '/api/nav/user/logout';

// Types
interface UserProfile {
  avatar: string;
  email: string;
  id: string;
  name: string;
  role: string;
  status: 'away' | 'busy' | 'offline' | 'online';
}

interface UserMenuItem {
  action?: 'billing' | 'logout' | 'profile' | 'settings';
  icon: string;
  id: string;
  label: string;
  shortcut?: string;
  url?: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const navUserHandlers = [
  // GET user profile
  http.get(API_NAV_USER_PROFILE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const profile: UserProfile = {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement([
        i18n.t('handler.navUser.admin', 'Admin'),
        i18n.t('handler.navUser.user', 'User'),
        i18n.t('handler.navUser.editor', 'Editor'),
        i18n.t('handler.navUser.viewer', 'Viewer'),
      ]),
      status: faker.helpers.arrayElement(['online', 'away', 'busy', 'offline']),
    };
    return HttpResponse.json(profile);
  }),

  // GET user menu items
  http.get(API_NAV_USER_MENU, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const menuItems: UserMenuItem[] = [
      {
        id: 'profile',
        label: i18n.t('handler.navUser.profile', 'Profile'),
        icon: 'User',
        action: 'profile',
        shortcut: '⌘P',
      },
      {
        id: 'settings',
        label: i18n.t('handler.navUser.settings', 'Settings'),
        icon: 'Settings',
        action: 'settings',
        shortcut: '⌘S',
      },
      {
        id: 'billing',
        label: i18n.t('handler.navUser.billing', 'Billing'),
        icon: 'CreditCard',
        action: 'billing',
      },
      {
        id: 'logout',
        label: i18n.t('handler.navUser.logOut', 'Log out'),
        icon: 'LogOut',
        action: 'logout',
        shortcut: '⌘Q',
      },
    ];
    return HttpResponse.json({ items: menuItems });
  }),

  // POST logout
  http.post(API_NAV_USER_LOGOUT, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.navUser.loggedOutSuccessfully', 'Logged out successfully'),
      redirectUrl: '/login',
    });
  }),

  // PUT update profile
  http.put(API_NAV_USER_PROFILE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<UserProfile>;
    return HttpResponse.json({
      success: true,
      profile: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Generic endpoint
  http.get(API_NAV_USER, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      isAuthenticated: true,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const navUserStatusHandlers = {
  // Success
  success: navUserHandlers,

  // 4xx Client Errors
  badRequest: [
    http.put(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PROFILE',
          i18n.t('handler.navUser.invalidProfileData', 'Invalid profile data'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.navUser.authenticationRequired', 'Authentication required'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.put(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PROFILE_LOCKED',
          i18n.t('handler.navUser.profileUpdatesAreDisabled', 'Profile updates are disabled'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.navUser.userProfileNotFound', 'User profile not found'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.put(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'EMAIL_CONFLICT',
          i18n.t('handler.navUser.emailAlreadyInUse', 'Email already in use'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.put(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_EMAIL',
          i18n.t('handler.navUser.invalidEmailFormat', 'Invalid email format'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.put(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.navUser.tooManyProfileUpdatesPlease',
            'Too many profile updates. Please wait.'
          ),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.navUser.failedToLoadUserProfile', 'Failed to load user profile'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.navUser.userServiceUnavailable', 'User service unavailable'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.navUser.userServiceTemporarilyUnavailable',
            'User service temporarily unavailable'
          ),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.navUser.userServiceTimeout', 'User service timeout'),
          API_NAV_USER_PROFILE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(3000);
      return HttpResponse.json({
        id: '1',
        name: i18n.t('handler.navUser.johnDoe', 'John Doe'),
        email: 'john@example.com',
        avatar: '',
        role: i18n.t('handler.navUser.user', 'User'),
        status: 'online',
      });
    }),
  ],

  networkError: [http.get(API_NAV_USER_PROFILE, () => HttpResponse.error())],

  emptyData: [
    http.get(API_NAV_USER_PROFILE, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],

  logoutError: [
    http.post(API_NAV_USER_LOGOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOGOUT_ERROR',
          i18n.t('handler.navUser.failedToLogout', 'Failed to logout'),
          API_NAV_USER_LOGOUT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
};
