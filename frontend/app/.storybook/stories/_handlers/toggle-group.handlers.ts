import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TOGGLE_GROUP_STATE = '/api/toggle-group/state';
const API_TOGGLE_GROUP_UPDATE = '/api/toggle-group/update';
const API_TOGGLE_GROUP_CONFIG = '/api/toggle-group/config';

// Default success handlers
export const toggleGroupHandlers = [
  // GET /api/toggle-group/state - Get toggle group state
  http.get(API_TOGGLE_GROUP_STATE, async ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId') ?? 'default';
    const type = url.searchParams.get('type') ?? 'single';

    await delay(faker.number.int({ min: 100, max: 300 }));

    const items = Array.from({ length: faker.number.int({ min: 3, max: 6 }) }, () => ({
      id: faker.string.uuid(),
      value: faker.lorem.word(),
      icon: faker.helpers.arrayElement(['AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify']),
      label: faker.lorem.word(),
      disabled: faker.datatype.boolean({ probability: 0.1 }),
    }));

    const value =
      type === 'single'
        ? items[faker.number.int({ min: 0, max: items.length - 1 })].value
        : items
            .filter(() => faker.datatype.boolean({ probability: 0.3 }))
            .map((item) => item.value);

    return HttpResponse.json({
      groupId,
      type,
      value,
      items,
      variant: faker.helpers.arrayElement(['default', 'outline']),
      size: faker.helpers.arrayElement(['default', 'sm', 'lg']),
    });
  }),

  // POST /api/toggle-group/update - Update toggle group value
  http.post(API_TOGGLE_GROUP_UPDATE, async ({ request }) => {
    const body = (await request.json()) as {
      groupId: string;
      type?: 'multiple' | 'single';
      value: string | string[];
    };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      groupId: body.groupId,
      value: body.value,
      type: body.type ?? 'single',
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/toggle-group/config - Get toggle group configuration
  http.get(API_TOGGLE_GROUP_CONFIG, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      groups: [
        {
          id: 'alignment',
          label: i18n.t('handler.toggleGroup.textAlignment', 'Text Alignment'),
          type: 'single',
          items: [
            { value: 'left', icon: 'AlignLeft', label: i18n.t('handler.toggleGroup.left', 'Left') },
            {
              value: 'center',
              icon: 'AlignCenter',
              label: i18n.t('handler.toggleGroup.center', 'Center'),
            },
            {
              value: 'right',
              icon: 'AlignRight',
              label: i18n.t('handler.toggleGroup.right', 'Right'),
            },
          ],
        },
        {
          id: 'formatting',
          label: i18n.t('handler.toggleGroup.textFormatting', 'Text Formatting'),
          type: 'multiple',
          items: [
            { value: 'bold', icon: 'Bold', label: i18n.t('handler.toggleGroup.bold', 'Bold') },
            {
              value: 'italic',
              icon: 'Italic',
              label: i18n.t('handler.toggleGroup.italic', 'Italic'),
            },
            {
              value: 'underline',
              icon: 'Underline',
              label: i18n.t('handler.toggleGroup.underline', 'Underline'),
            },
          ],
        },
      ],
    });
  }),
];

// Status-specific handlers for stories
export const toggleGroupStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: toggleGroupHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_VALUE',
          i18n.t('handler.toggleGroup.invalidToggleGroupValue', 'Invalid toggle group value'),
          API_TOGGLE_GROUP_UPDATE,
          {
            value: i18n.t(
              'handler.toggleGroup.valueMustBeAStringForSingle',
              'Value must be a string for single type or array for multiple'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.toggleGroup.authenticationRequiredToUpdateToggle',
            'Authentication required to update toggle group'
          ),
          API_TOGGLE_GROUP_UPDATE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.toggleGroup.toggleGroupIsLocked', 'Toggle group is locked'),
          API_TOGGLE_GROUP_UPDATE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_TOGGLE_GROUP_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'GROUP_NOT_FOUND',
          i18n.t('handler.toggleGroup.toggleGroupNotFound', 'Toggle group not found'),
          API_TOGGLE_GROUP_STATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t(
            'handler.toggleGroup.toggleGroupStateChangedBy',
            'Toggle group state changed by another user'
          ),
          API_TOGGLE_GROUP_UPDATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.toggleGroup.invalidValueForToggleGroup',
            'Invalid value for toggle group type'
          ),
          API_TOGGLE_GROUP_UPDATE,
          {
            type: i18n.t(
              'handler.toggleGroup.singleTypeGroupsRequireExactlyOne',
              'Single type groups require exactly one value'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.toggleGroup.tooManyToggleGroupUpdates', 'Too many toggle group updates'),
          API_TOGGLE_GROUP_UPDATE,
          { retryAfter: '2' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'UPDATE_FAILED',
          i18n.t('handler.toggleGroup.failedToUpdateToggleGroup', 'Failed to update toggle group'),
          API_TOGGLE_GROUP_UPDATE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TOGGLE_GROUP_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.toggleGroup.toggleGroupServiceTemporarilyUnavailable',
            'Toggle group service temporarily unavailable'
          ),
          API_TOGGLE_GROUP_STATE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.toggleGroup.toggleGroupServiceIsUnder',
            'Toggle group service is under maintenance'
          ),
          API_TOGGLE_GROUP_UPDATE,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.toggleGroup.toggleGroupUpdateTimedOut', 'Toggle group update timed out'),
          API_TOGGLE_GROUP_UPDATE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TOGGLE_GROUP_STATE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        groupId: 'slow',
        value: 'center',
        updatedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_TOGGLE_GROUP_STATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_TOGGLE_GROUP_UPDATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TOGGLE_GROUP_STATE, async () => {
      await delay(200);
      return HttpResponse.json({
        groupId: 'empty',
        type: 'single',
        value: null,
        items: [],
      });
    }),
    http.get(API_TOGGLE_GROUP_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json({
        groups: [],
      });
    }),
  ],
};
