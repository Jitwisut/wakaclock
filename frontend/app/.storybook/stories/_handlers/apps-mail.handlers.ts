import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS MAIL HANDLERS
// Enterprise-grade MSW handlers for mail application page
// ============================================================================

// API Endpoints
const API_MAIL = '/api/apps/mail';
const API_MAIL_MESSAGES = '/api/apps/mail/messages';
const API_MAIL_SEND = '/api/apps/mail/send';
const API_MAIL_FOLDERS = '/api/apps/mail/folders';
const API_MAIL_LABELS = '/api/apps/mail/labels';
const API_MAIL_ACTIONS = '/api/apps/mail/actions';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsMailHandlers = [
  http.get(API_MAIL, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalMessages: faker.number.int({ min: 100, max: 1000 }),
      unreadCount: faker.number.int({ min: 5, max: 50 }),
      draftsCount: faker.number.int({ min: 0, max: 10 }),
      spamCount: faker.number.int({ min: 0, max: 20 }),
      storageUsed: faker.number.int({ min: 500_000_000, max: 5_000_000_000 }),
      storageLimit: 15_000_000_000,
    });
  }),

  http.get(API_MAIL_MESSAGES, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder') || 'inbox';

    const messages = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      from: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
      },
      to: [{ name: i18n.t('handler.appsMail.me', 'Me'), email: faker.internet.email() }],
      subject: faker.lorem.sentence({ min: 4, max: 10 }),
      preview: faker.lorem.sentence(),
      body: faker.lorem.paragraphs({ min: 2, max: 5 }),
      folder,
      labels: faker.helpers.arrayElements(
        ['important', 'work', 'personal', 'finance'],
        faker.number.int({ min: 0, max: 2 })
      ),
      read: faker.datatype.boolean({ probability: 0.7 }),
      starred: faker.datatype.boolean({ probability: 0.2 }),
      hasAttachments: faker.datatype.boolean({ probability: 0.3 }),
      attachments: faker.datatype.boolean({ probability: 0.3 })
        ? Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
            name: faker.system.fileName(),
            size: faker.number.int({ min: 10_000, max: 5_000_000 }),
            type: faker.system.mimeType(),
          }))
        : [],
      date: faker.date.recent().toISOString(),
    }));

    return HttpResponse.json({ messages, folder, total: messages.length });
  }),

  http.post(API_MAIL_SEND, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { body: string; subject: string; to: string[] };
    return HttpResponse.json({
      success: true,
      messageId: faker.string.uuid(),
      sentAt: new Date().toISOString(),
      to: body.to,
    });
  }),

  http.get(API_MAIL_FOLDERS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const folders = [
      {
        id: 'inbox',
        name: i18n.t('handler.appsMail.inbox', 'Inbox'),
        count: faker.number.int({ min: 100, max: 500 }),
        unread: faker.number.int({ min: 5, max: 50 }),
      },
      {
        id: 'sent',
        name: i18n.t('handler.appsMail.sent', 'Sent'),
        count: faker.number.int({ min: 50, max: 200 }),
        unread: 0,
      },
      {
        id: 'drafts',
        name: i18n.t('handler.appsMail.drafts', 'Drafts'),
        count: faker.number.int({ min: 0, max: 10 }),
        unread: 0,
      },
      {
        id: 'spam',
        name: i18n.t('handler.appsMail.spam', 'Spam'),
        count: faker.number.int({ min: 0, max: 20 }),
        unread: faker.number.int({ min: 0, max: 20 }),
      },
      {
        id: 'trash',
        name: i18n.t('handler.appsMail.trash', 'Trash'),
        count: faker.number.int({ min: 0, max: 50 }),
        unread: 0,
      },
      {
        id: 'archive',
        name: i18n.t('handler.appsMail.archive', 'Archive'),
        count: faker.number.int({ min: 100, max: 500 }),
        unread: 0,
      },
    ];
    return HttpResponse.json({ folders });
  }),

  http.get(API_MAIL_LABELS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const labels = [
      {
        id: 'important',
        name: i18n.t('handler.appsMail.important', 'Important'),
        color: '#ef4444',
      },
      { id: 'work', name: i18n.t('handler.appsMail.work', 'Work'), color: '#3b82f6' },
      { id: 'personal', name: i18n.t('handler.appsMail.personal', 'Personal'), color: '#22c55e' },
      { id: 'finance', name: i18n.t('handler.appsMail.finance', 'Finance'), color: '#f59e0b' },
    ];
    return HttpResponse.json({ labels });
  }),

  http.post(API_MAIL_ACTIONS, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { action: string; messageIds: string[] };
    return HttpResponse.json({
      success: true,
      action: body.action,
      affectedCount: body.messageIds.length,
      timestamp: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsMailStatusHandlers = {
  success: appsMailHandlers,
  unauthorized: [
    http.get(API_MAIL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsMail.authenticationRequired', 'Authentication required'),
          API_MAIL
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_MAIL_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SEND_FORBIDDEN',
          i18n.t('handler.appsMail.emailSendingNotAllowed', 'Email sending not allowed'),
          API_MAIL_SEND
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  badRequest: [
    http.post(API_MAIL_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_EMAIL',
          i18n.t(
            'handler.appsMail.invalidRecipientEmailAddress',
            'Invalid recipient email address'
          ),
          API_MAIL_SEND
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_MAIL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsMail.requestValidationFailed', 'Request validation failed'),
          API_MAIL,
          {
            field: 'data',
            error: i18n.t('handler.appsMail.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_MAIL_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsMail.failedToSendEmail', 'Failed to send email'),
          API_MAIL_SEND
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_MAIL_MESSAGES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_MAIL, () => HttpResponse.error())],
  emptyData: [
    http.get(API_MAIL_MESSAGES, async () => {
      await delay(100);
      return HttpResponse.json({ messages: [], folder: 'inbox', total: 0 });
    }),
  ],
};
