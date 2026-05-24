import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============ API ENDPOINT CONSTANTS ============

const API_ALERT_DIALOG_CONFIRM = '/api/alert-dialog/confirm';
const API_ALERT_DIALOG_DELETE = '/api/alert-dialog/delete';
const API_ALERT_DIALOG_CONTENT = '/api/alert-dialog/content/:id';

// ============ RESPONSE TYPES ============

interface AlertDialogConfirmResponse {
  id: string;
  message: string;
  status: 'confirmed';
  timestamp: string;
}

interface AlertDialogDeleteResponse {
  deletedAt: string;
  id: string;
  status: 'deleted';
}

interface AlertDialogContentResponse {
  actionLabel: string;
  cancelLabel: string;
  description: string;
  destructive: boolean;
  id: string;
  title: string;
}

// ============ DEFAULT SUCCESS HANDLERS ============

/**
 * Default handlers for alert dialog API endpoints
 * Simulates successful responses with realistic delays
 */
export const alertDialogHandlers = [
  // Confirm action endpoint
  http.post(API_ALERT_DIALOG_CONFIRM, async () => {
    await delay(faker.number.int({ min: 200, max: 800 }));

    const response: AlertDialogConfirmResponse = {
      id: faker.string.uuid(),
      status: 'confirmed',
      message: i18n.t(
        'handler.alertDialog.actionConfirmedSuccessfully',
        'Action confirmed successfully'
      ),
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json(response, { status: HTTP_STATUS.OK });
  }),

  // Delete action endpoint
  http.post(API_ALERT_DIALOG_DELETE, async () => {
    await delay(faker.number.int({ min: 300, max: 1000 }));

    const response: AlertDialogDeleteResponse = {
      id: faker.string.uuid(),
      status: 'deleted',
      deletedAt: new Date().toISOString(),
    };

    return HttpResponse.json(response, { status: HTTP_STATUS.OK });
  }),

  // Get dialog content endpoint
  http.get(API_ALERT_DIALOG_CONTENT, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 400 }));

    const response: AlertDialogContentResponse = {
      id: params.id as string,
      title: faker.helpers.arrayElement([
        i18n.t('handler.alertDialog.confirmAction', 'Confirm Action'),
        i18n.t('handler.alertDialog.deleteItem', 'Delete Item?'),
        i18n.t('handler.alertDialog.saveChanges', 'Save Changes?'),
        i18n.t('handler.alertDialog.areYouSure', 'Are you sure?'),
      ]),
      description: faker.helpers.arrayElement([
        i18n.t('handler.alertDialog.thisActionCannotBeUndone', 'This action cannot be undone.'),
        i18n.t('handler.alertDialog.pleaseConfirmYourAction', 'Please confirm your action.'),
        i18n.t('handler.alertDialog.youHaveUnsavedChanges', 'You have unsaved changes.'),
        i18n.t(
          'handler.alertDialog.thisWillPermanentlyDeleteThe',
          'This will permanently delete the item.'
        ),
      ]),
      actionLabel: faker.helpers.arrayElement([
        i18n.t('handler.alertDialog.confirm', 'Confirm'),
        i18n.t('handler.alertDialog.delete', 'Delete'),
        i18n.t('handler.alertDialog.save', 'Save'),
        i18n.t('handler.alertDialog.continue', 'Continue'),
      ]),
      cancelLabel: faker.helpers.arrayElement([
        i18n.t('handler.alertDialog.cancel', 'Cancel'),
        i18n.t('handler.alertDialog.goBack', 'Go back'),
        i18n.t('handler.alertDialog.discard', 'Discard'),
      ]),
      destructive: faker.datatype.boolean({ probability: 0.3 }),
    };

    return HttpResponse.json(response, { status: HTTP_STATUS.OK });
  }),
];

// ============ STATUS-SPECIFIC HANDLERS ============

export const alertDialogStatusHandlers = {
  // Success handlers
  success: alertDialogHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'BAD_REQUEST',
          i18n.t('handler.alertDialog.invalidRequestData', 'Invalid request data'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'BAD_REQUEST',
          i18n.t('handler.alertDialog.invalidRequestData', 'Invalid request data'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.alertDialog.authenticationRequired', 'Authentication required'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.alertDialog.authenticationRequired', 'Authentication required'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.alertDialog.accessDenied', 'Access denied'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.alertDialog.accessDenied', 'Access denied'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.alertDialog.itemNotFound', 'Item not found'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_ALERT_DIALOG_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.alertDialog.dialogContentNotFound', 'Dialog content not found'),
          API_ALERT_DIALOG_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.alertDialog.itemIsBeingUsedAnd',
            'Item is being used and cannot be deleted'
          ),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.alertDialog.validationFailed', 'Validation failed'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT_EXCEEDED',
          i18n.t('handler.alertDialog.rateLimitExceeded', 'Rate limit exceeded'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT_EXCEEDED',
          i18n.t('handler.alertDialog.rateLimitExceeded', 'Rate limit exceeded'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.alertDialog.anUnexpectedErrorOccurred', 'An unexpected error occurred'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.alertDialog.anUnexpectedErrorOccurred', 'An unexpected error occurred'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.alertDialog.badGatewayError', 'Bad gateway error'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.alertDialog.serviceTemporarilyUnavailable',
            'Service temporarily unavailable'
          ),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.alertDialog.gatewayTimeout', 'Gateway timeout'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: HTTP_STATUS.OK });
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: HTTP_STATUS.OK });
    }),
    http.get(API_ALERT_DIALOG_CONTENT, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: HTTP_STATUS.OK });
    }),
  ],

  slowResponse: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(5000);
      return HttpResponse.json(
        {
          id: faker.string.uuid(),
          status: 'confirmed',
          message: i18n.t(
            'handler.alertDialog.actionConfirmedSlowResponse',
            'Action confirmed (slow response)'
          ),
          timestamp: new Date().toISOString(),
        },
        { status: HTTP_STATUS.OK }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(5000);
      return HttpResponse.json(
        {
          id: faker.string.uuid(),
          status: 'deleted',
          deletedAt: new Date().toISOString(),
        },
        { status: HTTP_STATUS.OK }
      );
    }),
  ],

  networkError: [
    http.post(API_ALERT_DIALOG_CONFIRM, () => HttpResponse.error()),
    http.post(API_ALERT_DIALOG_DELETE, () => HttpResponse.error()),
    http.get(API_ALERT_DIALOG_CONTENT, () => HttpResponse.error()),
  ],

  // Domain-specific handlers
  deleteInProgress: [
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'DELETE_IN_PROGRESS',
          i18n.t(
            'handler.alertDialog.deleteOperationAlreadyInProgress',
            'Delete operation already in progress'
          ),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  itemLocked: [
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ITEM_LOCKED',
          i18n.t('handler.alertDialog.itemIsLocked', 'Item is locked'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  confirmationRequired: [
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'CONFIRMATION_REQUIRED',
          i18n.t('handler.alertDialog.confirmationTextIsRequired', 'Confirmation text is required'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  sessionExpired: [
    http.post(API_ALERT_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.alertDialog.sessionExpired', 'Session expired'),
          API_ALERT_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_ALERT_DIALOG_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.alertDialog.sessionExpired', 'Session expired'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
};

// ============ COMBINED HANDLERS FOR SPECIFIC SCENARIOS ============

/**
 * Handlers for delete confirmation flow
 */
export const deleteConfirmationHandlers = [
  http.post(API_ALERT_DIALOG_DELETE, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 1500 }));

    const body = (await request.json()) as { confirmationText?: string };

    if (body.confirmationText !== 'DELETE') {
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIRMATION',
          i18n.t('handler.alertDialog.invalidConfirmationText', 'Invalid confirmation text'),
          API_ALERT_DIALOG_DELETE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'deleted',
        deletedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

/**
 * Handlers for optimistic delete with undo support
 */
export const optimisticDeleteHandlers = [
  http.post(API_ALERT_DIALOG_DELETE, async () => {
    await delay(200);
    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'pending',
        undoToken: faker.string.alphanumeric(32),
        undoExpiresAt: new Date(Date.now() + 10_000).toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
  http.post('/api/alert-dialog/undo', async () => {
    await delay(200);
    return HttpResponse.json(
      {
        status: 'restored',
        restoredAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

// ============ ENTERPRISE HANDLERS ============

/**
 * Handlers for payment confirmation flow
 */
export const paymentConfirmationHandlers = [
  http.post('/api/alert-dialog/payment/confirm', async ({ request }) => {
    const body = (await request.json()) as { amount?: number; currency?: string };
    await delay(faker.number.int({ min: 1000, max: 2000 }));

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'payment_confirmed',
        transactionId: `txn_${faker.string.alphanumeric(16)}`,
        amount: body.amount ?? 0,
        currency: body.currency ?? 'USD',
        processedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
  http.post('/api/alert-dialog/payment/cancel', async () => {
    await delay(200);
    return HttpResponse.json(
      {
        status: 'payment_cancelled',
        cancelledAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

/**
 * Handlers for account deletion flow
 */
export const accountDeletionHandlers = [
  http.post('/api/alert-dialog/account/delete', async ({ request }) => {
    const body = (await request.json()) as { confirmationText?: string };
    await delay(faker.number.int({ min: 500, max: 1500 }));

    // Require typing "DELETE" to confirm
    if (body.confirmationText?.toUpperCase() !== 'DELETE') {
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'CONFIRMATION_MISMATCH',
          i18n.t(
            'handler.alertDialog.pleaseTypeDeleteToConfirm',
            'Please type DELETE to confirm account deletion'
          ),
          '/api/alert-dialog/account/delete'
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'account_deleted',
        gracePeriodEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        deletedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

/**
 * Handlers for subscription cancellation flow
 */
export const subscriptionCancellationHandlers = [
  http.post('/api/alert-dialog/subscription/cancel', async () => {
    await delay(faker.number.int({ min: 500, max: 1000 }));

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'subscription_cancelled',
        activeUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelledAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
  http.post('/api/alert-dialog/subscription/reactivate', async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'subscription_reactivated',
        reactivatedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

/**
 * Handlers for data export flow
 */
export const dataExportHandlers = [
  http.post('/api/alert-dialog/data/export', async () => {
    await delay(faker.number.int({ min: 1000, max: 2000 }));

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'export_started',
        estimatedTime: '5-10 minutes',
        notificationEmail: faker.internet.email(),
        startedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
  http.get('/api/alert-dialog/data/export/:id/status', async ({ params }) => {
    await delay(200);

    const statuses = ['pending', 'processing', 'completed', 'failed'];
    const status = faker.helpers.arrayElement(statuses);

    return HttpResponse.json(
      {
        id: params.id,
        status,
        progress: status === 'completed' ? 100 : faker.number.int({ min: 10, max: 90 }),
        downloadUrl: status === 'completed' ? faker.internet.url() : null,
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

/**
 * Handlers for terms acceptance flow
 */
export const termsAcceptanceHandlers = [
  http.post('/api/alert-dialog/terms/accept', async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        status: 'terms_accepted',
        version: '2.0.0',
        acceptedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
  http.post('/api/alert-dialog/terms/decline', async () => {
    await delay(200);

    return HttpResponse.json(
      {
        status: 'terms_declined',
        declinedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  }),
];

/**
 * Combined enterprise handlers for comprehensive testing
 */
export const enterpriseAlertDialogHandlers = [
  ...alertDialogHandlers,
  ...paymentConfirmationHandlers,
  ...accountDeletionHandlers,
  ...subscriptionCancellationHandlers,
  ...dataExportHandlers,
  ...termsAcceptanceHandlers,
];
