import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS CHAT HANDLERS
// Enterprise-grade MSW handlers for chat application page
// ============================================================================

// API Endpoints
const API_CHAT = '/api/apps/chat';
const API_CHAT_CONVERSATIONS = '/api/apps/chat/conversations';
const API_CHAT_MESSAGES = '/api/apps/chat/messages';
const API_CHAT_SEND = '/api/apps/chat/send';
const API_CHAT_CONTACTS = '/api/apps/chat/contacts';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsChatHandlers = [
  http.get(API_CHAT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalConversations: faker.number.int({ min: 10, max: 50 }),
      unreadCount: faker.number.int({ min: 0, max: 20 }),
      onlineContacts: faker.number.int({ min: 5, max: 30 }),
    });
  }),

  http.get(API_CHAT_CONVERSATIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const conversations = Array.from({ length: 15 }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['direct', 'group']),
      name:
        faker.helpers.arrayElement(['direct', 'group']) === 'group'
          ? faker.company.name()
          : faker.person.fullName(),
      avatar: faker.image.avatar(),
      lastMessage: faker.lorem.sentence(),
      lastMessageTime: faker.date.recent().toISOString(),
      unreadCount: faker.number.int({ min: 0, max: 10 }),
      online: faker.datatype.boolean(),
      participants: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
      })),
    }));
    return HttpResponse.json({ conversations });
  }),

  http.get(`${API_CHAT_MESSAGES}/:conversationId`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const messages = Array.from({ length: 30 }, (_, i) => ({
      id: faker.string.uuid(),
      conversationId: faker.string.uuid(),
      senderId: faker.string.uuid(),
      senderName: faker.person.fullName(),
      senderAvatar: faker.image.avatar(),
      content: faker.lorem.sentence(),
      type: faker.helpers.arrayElement(['text', 'image', 'file']),
      timestamp: new Date(
        Date.now() - (30 - i) * 60_000 * faker.number.int({ min: 1, max: 10 })
      ).toISOString(),
      read: faker.datatype.boolean({ probability: 0.8 }),
    }));
    return HttpResponse.json({ messages });
  }),

  http.post(API_CHAT_SEND, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 200 }));
    const body = (await request.json()) as { content: string; conversationId: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      conversationId: body.conversationId,
      content: body.content,
      timestamp: new Date().toISOString(),
      status: 'sent',
    });
  }),

  http.get(API_CHAT_CONTACTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const contacts = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      status: faker.helpers.arrayElement(['online', 'offline', 'away', 'busy']),
      lastSeen: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ contacts });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsChatStatusHandlers = {
  success: appsChatHandlers,
  badRequest: [
    http.get(API_CHAT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsChat.invalidRequestParameters', 'Invalid request parameters'),
          API_CHAT,
          {
            field: 'data',
            error: i18n.t('handler.appsChat.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CHAT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsChat.authenticationRequired', 'Authentication required'),
          API_CHAT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_CHAT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.appsChat.accessDeniedToThisResource', 'Access denied to this resource'),
          API_CHAT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_CHAT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsChat.requestValidationFailed', 'Request validation failed'),
          API_CHAT,
          {
            field: 'data',
            error: i18n.t('handler.appsChat.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsChat.failedToSendMessage', 'Failed to send message'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_CHAT_CONVERSATIONS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_CHAT_SEND, () => HttpResponse.error())],
  emptyData: [
    http.get(API_CHAT_CONVERSATIONS, async () => {
      await delay(100);
      return HttpResponse.json({ conversations: [] });
    }),
  ],
};
