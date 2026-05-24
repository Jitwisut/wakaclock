import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeMenuItems } from '../_factories/menu.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_MENU_ITEMS = '/api/menu-items';
const API_DROPDOWN_ITEMS = '/api/dropdown/items';
const API_DROPDOWN_ACTION = '/api/dropdown/action';
const API_DROPDOWN_PREFERENCES = '/api/dropdown/preferences';
const API_DROPDOWN_SELECT = '/api/dropdown/select';

// Default success handlers
export const dropdownMenuHandlers = [
  // GET /api/menu-items - Generic menu items endpoint (shared with other menu components)
  http.get(API_MENU_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 6);
    const includeSubmenus = url.searchParams.get('submenus') !== 'false';

    await delay(faker.number.int({ min: 200, max: 500 }));

    // Create menu items with proper depth for submenus
    const items = createFakeMenuItems(count, includeSubmenus ? 0 : 2);

    return HttpResponse.json({
      items,
      total: items.length,
    });
  }),

  // GET /api/dropdown/items - Get dropdown menu items
  http.get(API_DROPDOWN_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const menuId = url.searchParams.get('id') ?? 'default';
    await delay(faker.number.int({ min: 100, max: 250 }));

    const menus: Record<string, object[]> = {
      default: [
        {
          id: 'profile',
          label: i18n.t('handler.dropdownMenu.profile', 'Profile'),
          icon: 'User',
          shortcut: 'Ctrl+P',
        },
        {
          id: 'settings',
          label: i18n.t('handler.dropdownMenu.settings', 'Settings'),
          icon: 'Settings',
          shortcut: 'Ctrl+,',
        },
        { type: 'separator' },
        { id: 'logout', label: i18n.t('handler.dropdownMenu.logout', 'Logout'), icon: 'LogOut' },
      ],
      actions: [
        { id: 'edit', label: i18n.t('handler.dropdownMenu.edit', 'Edit'), icon: 'Edit' },
        {
          id: 'duplicate',
          label: i18n.t('handler.dropdownMenu.duplicate', 'Duplicate'),
          icon: 'Copy',
        },
        {
          id: 'archive',
          label: i18n.t('handler.dropdownMenu.archive', 'Archive'),
          icon: 'Archive',
        },
        { type: 'separator' },
        {
          id: 'delete',
          label: i18n.t('handler.dropdownMenu.delete', 'Delete'),
          icon: 'Trash',
          destructive: true,
        },
      ],
      sort: [
        {
          id: 'name-asc',
          label: i18n.t('handler.dropdownMenu.nameAZ', 'Name (A-Z)'),
          checked: true,
        },
        { id: 'name-desc', label: i18n.t('handler.dropdownMenu.nameZA', 'Name (Z-A)') },
        { id: 'date-asc', label: i18n.t('handler.dropdownMenu.dateOldest', 'Date (Oldest)') },
        { id: 'date-desc', label: i18n.t('handler.dropdownMenu.dateNewest', 'Date (Newest)') },
      ],
    };

    return HttpResponse.json({
      menuId,
      items: menus[menuId] ?? menus.default,
    });
  }),

  // POST /api/dropdown/action - Execute menu action
  http.post(API_DROPDOWN_ACTION, async ({ request }) => {
    const body = (await request.json()) as { actionId: string; targetId?: string };
    await delay(faker.number.int({ min: 150, max: 400 }));

    return HttpResponse.json({
      success: true,
      actionId: body.actionId,
      targetId: body.targetId,
      executedAt: new Date().toISOString(),
    });
  }),

  // POST /api/dropdown/preferences - Save dropdown preferences (sort, filter)
  http.post(API_DROPDOWN_PREFERENCES, async ({ request }) => {
    const body = (await request.json()) as { preference: string; value: unknown };
    await delay(faker.number.int({ min: 100, max: 200 }));

    return HttpResponse.json({
      success: true,
      preference: body.preference,
      value: body.value,
      savedAt: new Date().toISOString(),
    });
  }),

  // POST /api/dropdown/select - Handle menu item selection
  http.post(API_DROPDOWN_SELECT, async ({ request }) => {
    const body = (await request.json()) as { itemId: string; value?: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      itemId: body.itemId,
      value: body.value,
      selectedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const dropdownMenuStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: dropdownMenuHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dropdownMenu.invalidQueryParameters', 'Invalid query parameters'),
          API_MENU_ITEMS,
          {
            count: i18n.t(
              'handler.dropdownMenu.mustBeAPositiveIntegerBetween1And50',
              'Must be a positive integer between 1 and 50'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_DROPDOWN_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.dropdownMenu.invalidActionId', 'Invalid action ID'),
          API_DROPDOWN_ACTION,
          { actionId: i18n.t('handler.dropdownMenu.actionIdIsRequired', 'Action ID is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.dropdownMenu.authenticationRequiredToViewMenu',
            'Authentication required to view menu'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_DROPDOWN_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.dropdownMenu.authenticationRequired', 'Authentication required'),
          API_DROPDOWN_ACTION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.dropdownMenu.accessDeniedToMenuItems', 'Access denied to menu items'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_DROPDOWN_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.dropdownMenu.insufficientPermissionsForThisAction',
            'Insufficient permissions for this action'
          ),
          API_DROPDOWN_ACTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'MENU_NOT_FOUND',
          i18n.t(
            'handler.dropdownMenu.theRequestedMenuConfigurationDoes',
            'The requested menu configuration does not exist'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dropdownMenu.requestValidationFailed', 'Request validation failed'),
          API_MENU_ITEMS,
          {
            field: 'data',
            error: i18n.t('handler.dropdownMenu.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.dropdownMenu.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_MENU_ITEMS,
          {
            limit: '300/hour',
            remaining: '0',
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_DROPDOWN_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ACTION_IN_PROGRESS',
          i18n.t(
            'handler.dropdownMenu.thisActionIsAlreadyBeing',
            'This action is already being processed'
          ),
          API_DROPDOWN_ACTION,
          {
            existingActionId: faker.string.uuid(),
            startedAt: new Date().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t(
            'handler.dropdownMenu.failedToLoadMenuConfiguration',
            'Failed to load menu configuration'
          ),
          API_MENU_ITEMS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_DROPDOWN_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ACTION_FAILED',
          i18n.t('handler.dropdownMenu.failedToExecuteAction', 'Failed to execute action'),
          API_DROPDOWN_ACTION,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.dropdownMenu.menuConfigurationServiceUnavailable',
            'Menu configuration service unavailable'
          ),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.dropdownMenu.menuServiceIsUnderMaintenance',
            'Menu service is under maintenance'
          ),
          API_MENU_ITEMS,
          { retryAfter: '180' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.dropdownMenu.menuServiceTimedOut', 'Menu service timed out'),
          API_MENU_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_MENU_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(5000);
      return HttpResponse.json({
        items: createFakeMenuItems(6),
        total: 6,
      });
    }),
  ],

  networkError: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_MENU_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
        total: 0,
      });
    }),
  ],

  // ============ DROPDOWN-SPECIFIC ACTION HANDLERS ============
  actionSuccess: [
    ...dropdownMenuHandlers,
    http.post(API_DROPDOWN_ACTION, async ({ request }) => {
      const body = (await request.json()) as { actionId: string };
      await delay(faker.number.int({ min: 100, max: 300 }));
      return HttpResponse.json({
        success: true,
        actionId: body.actionId,
        message: i18n.t(
          'handler.dropdownMenu.actionExecutedSuccessfully',
          'Action executed successfully'
        ),
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  actionFailed: [
    ...dropdownMenuHandlers,
    http.post(API_DROPDOWN_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ACTION_FAILED',
          i18n.t(
            'handler.dropdownMenu.theRequestedActionCouldNot',
            'The requested action could not be completed'
          ),
          API_DROPDOWN_ACTION
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  selectionSuccess: [
    ...dropdownMenuHandlers,
    http.post(API_DROPDOWN_SELECT, async ({ request }) => {
      const body = (await request.json()) as { itemId: string; value?: string };
      await delay(faker.number.int({ min: 50, max: 150 }));
      return HttpResponse.json({
        success: true,
        itemId: body.itemId,
        value: body.value,
        timestamp: new Date().toISOString(),
      });
    }),
  ],
};
