import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// CARD ACTION MENUS HANDLERS
// Enterprise-grade MSW handlers for card action menus component
// ============================================================================

// API Endpoints
const API_CARD_ACTIONS = '/api/card/actions';
const API_CARD_ACTION_EXECUTE = '/api/card/action/execute';
const API_CARD_ACTION_PERMISSIONS = '/api/card/action/permissions';
const API_CARD_ACTION_HISTORY = '/api/card/action/history';
const API_CARD_ACTION_BULK = '/api/card/action/bulk';

// Types
interface CardAction {
  enabled: boolean;
  icon: string;
  id: string;
  label: string;
  requiresConfirmation: boolean;
  shortcut?: string;
  type: 'archive' | 'delete' | 'duplicate' | 'edit' | 'export' | 'share' | 'view';
}

interface ActionResult {
  actionId: string;
  cardId: string;
  message?: string;
  success: boolean;
  timestamp: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const cardActionMenusHandlers = [
  http.get(API_CARD_ACTIONS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const actions: CardAction[] = [
      {
        id: 'view',
        label: i18n.t('handler.cardActionMenus.viewDetails', 'View Details'),
        icon: 'Eye',
        type: 'view',
        enabled: true,
        requiresConfirmation: false,
        shortcut: 'v',
      },
      {
        id: 'edit',
        label: i18n.t('handler.cardActionMenus.edit', 'Edit'),
        icon: 'Pencil',
        type: 'edit',
        enabled: true,
        requiresConfirmation: false,
        shortcut: 'e',
      },
      {
        id: 'duplicate',
        label: i18n.t('handler.cardActionMenus.duplicate', 'Duplicate'),
        icon: 'Copy',
        type: 'duplicate',
        enabled: true,
        requiresConfirmation: false,
        shortcut: 'd',
      },
      {
        id: 'share',
        label: i18n.t('handler.cardActionMenus.share', 'Share'),
        icon: 'Share2',
        type: 'share',
        enabled: true,
        requiresConfirmation: false,
        shortcut: 's',
      },
      {
        id: 'archive',
        label: i18n.t('handler.cardActionMenus.archive', 'Archive'),
        icon: 'Archive',
        type: 'archive',
        enabled: true,
        requiresConfirmation: true,
      },
      {
        id: 'export',
        label: i18n.t('handler.cardActionMenus.export', 'Export'),
        icon: 'Download',
        type: 'export',
        enabled: true,
        requiresConfirmation: false,
      },
      {
        id: 'delete',
        label: i18n.t('handler.cardActionMenus.delete', 'Delete'),
        icon: 'Trash2',
        type: 'delete',
        enabled: true,
        requiresConfirmation: true,
        shortcut: 'Del',
      },
    ];
    return HttpResponse.json({ actions });
  }),

  http.post(API_CARD_ACTION_EXECUTE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as {
      actionId: string;
      cardId: string;
      confirmed?: boolean;
    };
    const result: ActionResult = {
      success: true,
      actionId: body.actionId,
      cardId: body.cardId,
      timestamp: new Date().toISOString(),
      message: i18n.t(
        'handler.cardActionMenus.actionIdExecutedSuccessfully',
        "Action '{{actionId}}' executed successfully",
        { actionId: body.actionId }
      ),
    };
    return HttpResponse.json(result);
  }),

  http.get(API_CARD_ACTION_PERMISSIONS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({
      canView: true,
      canEdit: faker.datatype.boolean(),
      canDelete: faker.datatype.boolean(),
      canShare: true,
      canDuplicate: true,
      canArchive: faker.datatype.boolean(),
      canExport: true,
    });
  }),

  http.get(API_CARD_ACTION_HISTORY, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const history = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      actionId: faker.helpers.arrayElement(['view', 'edit', 'share', 'duplicate']),
      cardId: faker.string.uuid(),
      performedBy: faker.person.fullName(),
      performedAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ history, total: history.length });
  }),

  http.post(API_CARD_ACTION_BULK, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { actionId: string; cardIds: string[] };
    return HttpResponse.json({
      success: true,
      actionId: body.actionId,
      processedCount: body.cardIds.length,
      failedCount: 0,
      timestamp: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const cardActionMenusStatusHandlers = {
  success: cardActionMenusHandlers,
  badRequest: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.cardActionMenus.invalidActionParameters', 'Invalid action parameters'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.cardActionMenus.authenticationRequired', 'Authentication required'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACTION_FORBIDDEN',
          i18n.t(
            'handler.cardActionMenus.youDoNotHavePermission',
            'You do not have permission to perform this action'
          ),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CARD_NOT_FOUND',
          i18n.t('handler.cardActionMenus.cardNotFound', 'Card not found'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ACTION_CONFLICT',
          i18n.t(
            'handler.cardActionMenus.actionConflictsWithCurrentState',
            'Action conflicts with current state'
          ),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  unprocessableEntity: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.cardActionMenus.actionValidationFailed', 'Action validation failed'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.cardActionMenus.tooManyActionRequests', 'Too many action requests'),
          API_CARD_ACTION_EXECUTE,
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
  internalServerError: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.cardActionMenus.failedToExecuteAction', 'Failed to execute action'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.cardActionMenus.actionServiceUnavailable', 'Action service unavailable'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.cardActionMenus.actionServiceIsUnderMaintenance',
            'Action service is under maintenance'
          ),
          API_CARD_ACTION_EXECUTE,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.cardActionMenus.actionRequestTimedOut', 'Action request timed out'),
          API_CARD_ACTION_EXECUTE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        actionId: 'export',
        cardId: 'card-1',
        timestamp: new Date().toISOString(),
        message: i18n.t(
          'handler.cardActionMenus.actionExecutedSuccessfully',
          'Action executed successfully'
        ),
      });
    }),
  ],
  loading: [
    http.post(API_CARD_ACTION_EXECUTE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_CARD_ACTION_EXECUTE, () => HttpResponse.error())],
  confirmationRequired: [
    http.post(API_CARD_ACTION_EXECUTE, async ({ request }) => {
      await delay(100);
      const body = (await request.json()) as { confirmed?: boolean };
      if (!body.confirmed) {
        return HttpResponse.json(
          {
            requiresConfirmation: true,
            message: i18n.t(
              'handler.cardActionMenus.pleaseConfirmThisAction',
              'Please confirm this action'
            ),
          },
          { status: 202 }
        );
      }
      return HttpResponse.json({ success: true, timestamp: new Date().toISOString() });
    }),
  ],
  partialSuccess: [
    http.post(API_CARD_ACTION_BULK, async ({ request }) => {
      await delay(300);
      const body = (await request.json()) as { cardIds: string[] };
      return HttpResponse.json({
        success: false,
        processedCount: Math.floor(body.cardIds.length / 2),
        failedCount: Math.ceil(body.cardIds.length / 2),
        errors: [
          {
            cardId: body.cardIds[0],
            reason: i18n.t('handler.cardActionMenus.permissionDenied', 'Permission denied'),
          },
        ],
      });
    }),
  ],
};
