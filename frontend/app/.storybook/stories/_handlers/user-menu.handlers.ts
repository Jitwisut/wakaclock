import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// USER MENU HANDLERS
// Enterprise-grade MSW handlers for user menu component
// ============================================================================

// API Endpoints
const API_USER_MENU = '/api/user-menu';
const API_USER_MENU_PROFILE = '/api/user-menu/profile';
const API_USER_MENU_ITEMS = '/api/user-menu/items';
const API_USER_MENU_LOGOUT = '/api/user-menu/logout';
const API_USER_MENU_SWITCH_ACCOUNT = '/api/user-menu/switch-account';

// Types
interface UserMenuProfile {
  avatar: string;
  email: string;
  id: string;
  name: string;
  plan: string;
  role: string;
}

interface UserMenuItem {
  action?: string;
  destructive?: boolean;
  href?: string;
  icon: string;
  id: string;
  label: string;
  shortcut?: string;
}

interface Account {
  avatar: string;
  email: string;
  id: string;
  isCurrent: boolean;
  name: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const userMenuHandlers = [
  // GET user profile
  http.get(API_USER_MENU_PROFILE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const profile: UserMenuProfile = {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement([
        i18n.t('handler.userMenu.admin', 'Admin'),
        i18n.t('handler.userMenu.member', 'Member'),
        i18n.t('handler.userMenu.viewer', 'Viewer'),
      ]),
      plan: faker.helpers.arrayElement([
        i18n.t('handler.userMenu.free', 'Free'),
        i18n.t('handler.userMenu.pro', 'Pro'),
        i18n.t('handler.userMenu.enterprise', 'Enterprise'),
      ]),
    };
    return HttpResponse.json(profile);
  }),

  // GET menu items
  http.get(API_USER_MENU_ITEMS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const items: UserMenuItem[] = [
      {
        id: 'profile',
        label: i18n.t('handler.userMenu.profile', 'Profile'),
        icon: 'User',
        href: '/profile',
        shortcut: '⇧⌘P',
      },
      {
        id: 'settings',
        label: i18n.t('handler.userMenu.settings', 'Settings'),
        icon: 'Settings',
        href: '/settings',
        shortcut: '⌘,',
      },
      {
        id: 'billing',
        label: i18n.t('handler.userMenu.billing', 'Billing'),
        icon: 'CreditCard',
        href: '/billing',
      },
      { id: 'team', label: i18n.t('handler.userMenu.team', 'Team'), icon: 'Users', href: '/team' },
      {
        id: 'help',
        label: i18n.t('handler.userMenu.helpAndSupport', 'Help & Support'),
        icon: 'HelpCircle',
        href: '/help',
      },
      {
        id: 'logout',
        label: i18n.t('handler.userMenu.logOut', 'Log out'),
        icon: 'LogOut',
        action: 'logout',
        shortcut: '⇧⌘Q',
        destructive: true,
      },
    ];
    return HttpResponse.json({ items });
  }),

  // POST logout
  http.post(API_USER_MENU_LOGOUT, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({
      success: true,
      message: i18n.t('handler.userMenu.loggedOutSuccessfully', 'Logged out successfully'),
      redirectUrl: '/login',
    });
  }),

  // POST switch account
  http.post(API_USER_MENU_SWITCH_ACCOUNT, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const body = (await request.json()) as { accountId: string };
    return HttpResponse.json({
      success: true,
      accountId: body.accountId,
      switchedAt: new Date().toISOString(),
    });
  }),

  // GET available accounts
  http.get(`${API_USER_MENU}/accounts`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const accounts: Account[] = [
      {
        id: '1',
        name: i18n.t('handler.userMenu.personal', 'Personal'),
        email: 'personal@example.com',
        avatar: faker.image.avatar(),
        isCurrent: true,
      },
      {
        id: '2',
        name: i18n.t('handler.userMenu.work', 'Work'),
        email: 'work@company.com',
        avatar: faker.image.avatar(),
        isCurrent: false,
      },
    ];
    return HttpResponse.json({ accounts });
  }),

  // Generic endpoint
  http.get(API_USER_MENU, async () => {
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

export const userMenuStatusHandlers = {
  // Success
  success: userMenuHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_USER_MENU_SWITCH_ACCOUNT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACCOUNT',
          i18n.t('handler.userMenu.invalidAccountId', 'Invalid account ID'),
          API_USER_MENU_SWITCH_ACCOUNT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.userMenu.authenticationRequired', 'Authentication required'),
          API_USER_MENU_PROFILE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_USER_MENU_SWITCH_ACCOUNT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SWITCH_FORBIDDEN',
          i18n.t('handler.userMenu.accountSwitchingIsDisabled', 'Account switching is disabled'),
          API_USER_MENU_SWITCH_ACCOUNT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.userMenu.userProfileNotFound', 'User profile not found'),
          API_USER_MENU_PROFILE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_USER_MENU_SWITCH_ACCOUNT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SESSION_CONFLICT',
          i18n.t(
            'handler.userMenu.activeSessionOnTargetAccount',
            'Active session on target account'
          ),
          API_USER_MENU_SWITCH_ACCOUNT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_USER_MENU_SWITCH_ACCOUNT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'ACCOUNT_INACTIVE',
          i18n.t('handler.userMenu.targetAccountIsInactive', 'Target account is inactive'),
          API_USER_MENU_SWITCH_ACCOUNT
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_USER_MENU_SWITCH_ACCOUNT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.userMenu.tooManyAccountSwitchesPlease',
            'Too many account switches. Please wait.'
          ),
          API_USER_MENU_SWITCH_ACCOUNT
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.userMenu.failedToLoadUserMenu', 'Failed to load user menu'),
          API_USER_MENU_PROFILE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.userMenu.userServiceUnavailable', 'User service unavailable'),
          API_USER_MENU_PROFILE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.userMenu.userServiceTemporarilyUnavailable',
            'User service temporarily unavailable'
          ),
          API_USER_MENU_PROFILE
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.userMenu.userServiceTimeout', 'User service timeout'),
          API_USER_MENU_PROFILE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(3000);
      return HttpResponse.json({
        id: '1',
        name: i18n.t('handler.userMenu.johnDoe', 'John Doe'),
        email: 'john@example.com',
        avatar: '',
        role: i18n.t('handler.userMenu.member', 'Member'),
        plan: i18n.t('handler.userMenu.free', 'Free'),
      });
    }),
  ],

  networkError: [http.get(API_USER_MENU_PROFILE, () => HttpResponse.error())],

  emptyData: [
    http.get(API_USER_MENU_PROFILE, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],

  logoutError: [
    http.post(API_USER_MENU_LOGOUT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOGOUT_ERROR',
          i18n.t('handler.userMenu.failedToLogout', 'Failed to logout'),
          API_USER_MENU_LOGOUT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
};
