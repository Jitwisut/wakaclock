import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeDialogContent } from '../_factories/dialog.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_DIALOG_CONTENT = '/api/dialog-content/:id';
const API_DIALOG_CONFIRM = '/api/dialog/confirm';
const API_DIALOG_CANCEL = '/api/dialog/cancel';

// Default success handlers
export const dialogHandlers = [
  // GET /api/dialog-content/:id
  http.get(API_DIALOG_CONTENT, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const content = createFakeDialogContent({ id: params.id as string });
    return HttpResponse.json(content);
  }),

  // POST /api/dialog/confirm
  http.post(API_DIALOG_CONFIRM, async ({ request }) => {
    const body = (await request.json()) as { data?: Record<string, unknown>; dialogId: string };
    await delay(faker.number.int({ min: 300, max: 800 }));

    return HttpResponse.json({
      success: true,
      dialogId: body.dialogId,
      confirmedAt: new Date().toISOString(),
      message: i18n.t(
        'handler.dialog.actionConfirmedSuccessfully',
        'Action confirmed successfully'
      ),
    });
  }),

  // POST /api/dialog/cancel
  http.post(API_DIALOG_CANCEL, async ({ request }) => {
    const body = (await request.json()) as { dialogId: string; reason?: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      dialogId: body.dialogId,
      cancelledAt: new Date().toISOString(),
      message: i18n.t('handler.dialog.actionCancelled', 'Action cancelled'),
    });
  }),
];

// Status-specific handlers for stories
export const dialogStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: dialogHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_DIALOG_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DIALOG_ID',
          i18n.t('handler.dialog.invalidDialogIdFormat', 'Invalid dialog ID format'),
          API_DIALOG_CONTENT,
          {
            id: i18n.t('handler.dialog.mustBeAValidUuid', 'Must be a valid UUID'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_REQUEST',
          i18n.t('handler.dialog.requestBodyIsMalformed', 'Request body is malformed'),
          API_DIALOG_CONFIRM,
          {
            dialogId: i18n.t('handler.dialog.requiredFieldMissing', 'Required field missing'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.dialog.yourSessionHasExpired', 'Your session has expired'),
          API_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PERMISSION_DENIED',
          i18n.t(
            'handler.dialog.youDoNotHavePermission',
            'You do not have permission to perform this action'
          ),
          API_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.get(API_DIALOG_CONTENT, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.dialog.accessDeniedToThisDialog', 'Access denied to this dialog content'),
          `/api/dialog-content/${params.id}`
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_DIALOG_CONTENT, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'DIALOG_NOT_FOUND',
          `Dialog ${params.id} not found`,
          `/api/dialog-content/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ALREADY_PROCESSED',
          i18n.t(
            'handler.dialog.thisDialogActionHasAlready',
            'This dialog action has already been processed'
          ),
          API_DIALOG_CONFIRM,
          {
            processedAt: faker.date.recent().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.dialog.tooManyConfirmationAttempts', 'Too many confirmation attempts'),
          API_DIALOG_CONFIRM,
          {
            limit: '10/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.dialog.unableToProcessDialogAction', 'Unable to process dialog action'),
          API_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'PROCESSING_ERROR',
          i18n.t('handler.dialog.failedToProcessDialogAction', 'Failed to process dialog action'),
          API_DIALOG_CONFIRM,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.dialog.actionProcessingServiceUnavailable',
            'Action processing service unavailable'
          ),
          API_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.dialog.dialogServiceIsUnderMaintenance',
            'Dialog service is under maintenance'
          ),
          API_DIALOG_CONFIRM,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.dialog.actionProcessingTimedOut', 'Action processing timed out'),
          API_DIALOG_CONFIRM
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_DIALOG_CONFIRM, async ({ request }) => {
      const body = (await request.json()) as { dialogId: string };
      await delay(5000);
      return HttpResponse.json({
        success: true,
        dialogId: body.dialogId,
        confirmedAt: new Date().toISOString(),
        message: i18n.t(
          'handler.dialog.actionConfirmedSuccessfully',
          'Action confirmed successfully'
        ),
      });
    }),
  ],

  networkError: [
    http.post(API_DIALOG_CONFIRM, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_DIALOG_CONTENT, async ({ params }) => {
      await delay(300);
      return HttpResponse.json({
        id: params.id,
        title: '',
        description: '',
        confirmLabel: 'OK',
        cancelLabel: i18n.t('handler.dialog.cancel', 'Cancel'),
      });
    }),
  ],
};
