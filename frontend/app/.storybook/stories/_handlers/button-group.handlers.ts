import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============ API ENDPOINT CONSTANTS ============

/** Button group action endpoint */
const API_BUTTON_GROUP_ACTION = '/api/button-group/action';

/** Button group batch action endpoint */
const API_BUTTON_GROUP_BATCH = '/api/button-group/batch';

/** Button group toggle endpoint */
const API_BUTTON_GROUP_TOGGLE = '/api/button-group/toggle';

/** Button group state endpoint */
const API_BUTTON_GROUP_STATE = '/api/button-group/state';

// ============ RESPONSE TYPES ============

interface ButtonGroupActionResponse {
  action: string;
  buttonId: string;
  groupId: string;
  message: string;
  success: boolean;
  timestamp: string;
}

interface ButtonGroupBatchResponse {
  actions: Array<{ buttonId: string; result: 'failed' | 'success' }>;
  completedAt: string;
  failedCount: number;
  groupId: string;
  startedAt: string;
  success: boolean;
  successCount: number;
  totalActions: number;
}

interface ButtonGroupToggleResponse {
  buttonId: string;
  groupId: string;
  message: string;
  pressed: boolean;
  previousState: boolean;
  success: boolean;
}

interface ButtonGroupStateResponse {
  activeButton: null | string;
  buttons: Array<{ disabled: boolean; id: string; pressed: boolean }>;
  groupId: string;
  orientation: 'horizontal' | 'vertical';
  success: boolean;
}

// ============ DEFAULT SUCCESS HANDLERS ============

/**
 * Default success handlers for button group operations
 */
export const buttonGroupHandlers = [
  // Action handler
  http.post(API_BUTTON_GROUP_ACTION, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    const body = (await request.json()) as { action?: string; buttonId?: string; groupId?: string };
    const response: ButtonGroupActionResponse = {
      success: true,
      groupId: body.groupId ?? faker.string.uuid(),
      buttonId: body.buttonId ?? faker.string.uuid(),
      action: body.action ?? 'click',
      message: i18n.t(
        'handler.buttonGroup.actionCompletedSuccessfully',
        'Action completed successfully'
      ),
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json(response);
  }),

  // Batch action handler
  http.post(API_BUTTON_GROUP_BATCH, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const body = (await request.json()) as { actions?: string[]; groupId?: string };
    const actionCount = body.actions?.length ?? faker.number.int({ min: 2, max: 5 });
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      buttonId: `button-${i}`,
      result: 'success' as const,
    }));

    const response: ButtonGroupBatchResponse = {
      success: true,
      groupId: body.groupId ?? faker.string.uuid(),
      totalActions: actionCount,
      successCount: actionCount,
      failedCount: 0,
      actions,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return HttpResponse.json(response);
  }),

  // Toggle handler
  http.post(API_BUTTON_GROUP_TOGGLE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));

    const body = (await request.json()) as {
      buttonId?: string;
      groupId?: string;
      pressed?: boolean;
    };
    const previousState = faker.datatype.boolean();
    const newState = body.pressed ?? !previousState;

    const response: ButtonGroupToggleResponse = {
      success: true,
      groupId: body.groupId ?? faker.string.uuid(),
      buttonId: body.buttonId ?? faker.string.uuid(),
      pressed: newState,
      previousState,
      message: newState
        ? i18n.t('handler.buttonGroup.buttonPressed', 'Button pressed')
        : i18n.t('handler.buttonGroup.buttonReleased', 'Button released'),
    };

    return HttpResponse.json(response);
  }),

  // State handler
  http.get(API_BUTTON_GROUP_STATE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));

    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId') ?? faker.string.uuid();
    const buttonCount = faker.number.int({ min: 2, max: 5 });

    const response: ButtonGroupStateResponse = {
      success: true,
      groupId,
      orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
      activeButton:
        faker.helpers.maybe(() => `button-${faker.number.int({ min: 0, max: buttonCount - 1 })}`, {
          probability: 0.5,
        }) ?? null,
      buttons: Array.from({ length: buttonCount }, (_, i) => ({
        id: `button-${i}`,
        pressed: faker.datatype.boolean(),
        disabled: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
      })),
    };

    return HttpResponse.json(response);
  }),
];

// ============ STATUS-SPECIFIC HANDLERS ============

/**
 * Handlers for different HTTP status scenarios
 */
export const buttonGroupStatusHandlers = {
  // Success handlers
  success: buttonGroupHandlers,

  // 400 Bad Request
  badRequest: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.buttonGroup.invalidButtonGroupAction', 'Invalid button group action'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_BUTTON_GROUP_BATCH, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_BATCH',
          i18n.t('handler.buttonGroup.invalidBatchRequest', 'Invalid batch request'),
          API_BUTTON_GROUP_BATCH
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  // 401 Unauthorized
  unauthorized: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.buttonGroup.authenticationRequired', 'Authentication required'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  // 403 Forbidden
  forbidden: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.buttonGroup.insufficientPermissionsForThisAction',
            'Insufficient permissions for this action'
          ),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  // 404 Not Found
  notFound: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'GROUP_NOT_FOUND',
          i18n.t('handler.buttonGroup.buttonGroupNotFound', 'Button group not found'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_BUTTON_GROUP_STATE, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'STATE_NOT_FOUND',
          i18n.t('handler.buttonGroup.buttonGroupStateNotFound', 'Button group state not found'),
          API_BUTTON_GROUP_STATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  // 409 Conflict
  conflict: [
    http.post(API_BUTTON_GROUP_TOGGLE, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t(
            'handler.buttonGroup.buttonStateConflictConcurrentModification',
            'Button state conflict - concurrent modification detected'
          ),
          API_BUTTON_GROUP_TOGGLE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // 422 Unprocessable Entity
  unprocessableEntity: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.buttonGroup.validationFailed', 'Validation failed'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // 429 Too Many Requests
  tooManyRequests: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.buttonGroup.tooManyRequests', 'Too many requests'),
          API_BUTTON_GROUP_ACTION,
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

  // 500 Internal Server Error
  internalServerError: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.buttonGroup.internalServerError', 'Internal server error'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // 502 Bad Gateway
  badGateway: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.buttonGroup.badGateway', 'Bad gateway'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  // 503 Service Unavailable
  serviceUnavailable: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.buttonGroup.serviceTemporarilyUnavailable',
            'Service temporarily unavailable'
          ),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  // 504 Gateway Timeout
  gatewayTimeout: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(5000);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.buttonGroup.gatewayTimeout', 'Gateway timeout'),
          API_BUTTON_GROUP_ACTION
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Infinite loading (for testing loading states)
  loading: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay('infinite');
      return HttpResponse.json({ success: true });
    }),
    http.post(API_BUTTON_GROUP_BATCH, async () => {
      await delay('infinite');
      return HttpResponse.json({ success: true });
    }),
    http.post(API_BUTTON_GROUP_TOGGLE, async () => {
      await delay('infinite');
      return HttpResponse.json({ success: true });
    }),
  ],

  // Slow response
  slowResponse: [
    http.post(API_BUTTON_GROUP_ACTION, async () => {
      await delay(3000);
      return HttpResponse.json({
        success: true,
        message: i18n.t(
          'handler.buttonGroup.actionCompletedAfterDelay',
          'Action completed after delay'
        ),
      });
    }),
  ],

  // Network error
  networkError: [
    http.post(API_BUTTON_GROUP_ACTION, () => HttpResponse.error()),
    http.post(API_BUTTON_GROUP_BATCH, () => HttpResponse.error()),
  ],
};

// ============ DOMAIN-SPECIFIC HANDLERS ============

/**
 * Handlers for specific button group scenarios
 */
export const buttonGroupDomainHandlers = {
  // Partial batch success (some actions fail)
  partialBatchSuccess: [
    http.post(API_BUTTON_GROUP_BATCH, async ({ request }) => {
      await delay(300);

      const body = (await request.json()) as { actions?: string[] };
      const actionCount = body.actions?.length ?? 4;
      const failedIndex = faker.number.int({ min: 0, max: actionCount - 1 });

      const actions = Array.from({ length: actionCount }, (_, i) => ({
        buttonId: `button-${i}`,
        result: i === failedIndex ? ('failed' as const) : ('success' as const),
      }));

      const response: ButtonGroupBatchResponse = {
        success: false,
        groupId: faker.string.uuid(),
        totalActions: actionCount,
        successCount: actionCount - 1,
        failedCount: 1,
        actions,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      return HttpResponse.json(response);
    }),
  ],

  // Toggle with delay (simulating animation)
  animatedToggle: [
    http.post(API_BUTTON_GROUP_TOGGLE, async ({ request }) => {
      await delay(500); // Longer delay for animation

      const body = (await request.json()) as {
        buttonId?: string;
        groupId?: string;
        pressed?: boolean;
      };

      const response: ButtonGroupToggleResponse = {
        success: true,
        groupId: body.groupId ?? faker.string.uuid(),
        buttonId: body.buttonId ?? faker.string.uuid(),
        pressed: body.pressed ?? true,
        previousState: !body.pressed,
        message: i18n.t(
          'handler.buttonGroup.toggleAnimationCompleted',
          'Toggle animation completed'
        ),
      };

      return HttpResponse.json(response);
    }),
  ],

  // Exclusive selection (radio-like behavior)
  exclusiveSelection: [
    http.post(API_BUTTON_GROUP_TOGGLE, async ({ request }) => {
      await delay(100);

      const body = (await request.json()) as { buttonId?: string; groupId?: string };

      return HttpResponse.json({
        success: true,
        groupId: body.groupId ?? faker.string.uuid(),
        buttonId: body.buttonId ?? faker.string.uuid(),
        pressed: true,
        previousState: false,
        message: i18n.t(
          'handler.buttonGroup.selectionChangedOtherButtonsDeselected',
          'Selection changed - other buttons deselected'
        ),
        deselectedButtons: ['button-0', 'button-1', 'button-2'].filter(
          (id) => id !== body.buttonId
        ),
      });
    }),
  ],

  // Button disabled after action
  disabledAfterAction: [
    http.post(API_BUTTON_GROUP_ACTION, async ({ request }) => {
      await delay(200);

      const body = (await request.json()) as { buttonId?: string; groupId?: string };

      return HttpResponse.json({
        success: true,
        groupId: body.groupId ?? faker.string.uuid(),
        buttonId: body.buttonId ?? faker.string.uuid(),
        action: 'click',
        message: i18n.t(
          'handler.buttonGroup.actionCompletedButtonNowDisabled',
          'Action completed - button now disabled'
        ),
        buttonDisabled: true,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  // Confirmation required
  confirmationRequired: [
    http.post(API_BUTTON_GROUP_ACTION, async ({ request }) => {
      await delay(100);

      const body = (await request.json()) as { confirmed?: boolean };

      if (!body.confirmed) {
        return HttpResponse.json(
          {
            success: false,
            requiresConfirmation: true,
            message: i18n.t(
              'handler.buttonGroup.thisActionRequiresConfirmation',
              'This action requires confirmation'
            ),
            confirmationTitle: i18n.t('handler.buttonGroup.confirmAction', 'Confirm Action'),
            confirmationMessage: i18n.t(
              'handler.buttonGroup.areYouSureYouWant',
              'Are you sure you want to proceed?'
            ),
          },
          { status: 428 }
        );
      }

      return HttpResponse.json({
        success: true,
        message: i18n.t(
          'handler.buttonGroup.confirmedActionCompleted',
          'Confirmed action completed'
        ),
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  // Undo available
  undoableAction: [
    http.post(API_BUTTON_GROUP_ACTION, async ({ request }) => {
      await delay(150);

      const body = (await request.json()) as { buttonId?: string; groupId?: string };

      return HttpResponse.json({
        success: true,
        groupId: body.groupId ?? faker.string.uuid(),
        buttonId: body.buttonId ?? faker.string.uuid(),
        action: 'click',
        message: i18n.t('handler.buttonGroup.actionCompleted', 'Action completed'),
        undoAvailable: true,
        undoTimeout: 5000,
        undoUrl: '/api/button-group/undo',
        timestamp: new Date().toISOString(),
      });
    }),
  ],
};

// ============ COMBINED HANDLER SETS ============

/**
 * All button group handlers combined
 */
export const allButtonGroupHandlers = [...buttonGroupHandlers];

/**
 * Export handler sets for specific testing scenarios
 */
export const buttonGroupTestHandlers = {
  ...buttonGroupStatusHandlers,
  ...buttonGroupDomainHandlers,
};
