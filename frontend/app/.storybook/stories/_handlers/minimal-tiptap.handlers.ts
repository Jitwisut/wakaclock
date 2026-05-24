import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// MINIMAL TIPTAP HANDLERS
// Enterprise-grade MSW handlers for minimal tiptap editor component
// ============================================================================

// API Endpoints
const API_EDITOR = '/api/editor';
const API_EDITOR_CONTENT = '/api/editor/content';
const API_EDITOR_SAVE = '/api/editor/save';
const API_EDITOR_UPLOAD = '/api/editor/upload';
const API_EDITOR_LINK = '/api/editor/link/validate';

// Types
interface EditorContent {
  content: string;
  html: string;
  id: string;
  updatedAt: string;
  wordCount: number;
}

interface UploadResponse {
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const minimalTiptapHandlers = [
  http.get(API_EDITOR_CONTENT, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const content: EditorContent = {
      id: faker.string.uuid(),
      content: faker.lorem.paragraphs(3),
      html: `<p>${faker.lorem.paragraphs(3)}</p>`,
      updatedAt: new Date().toISOString(),
      wordCount: faker.number.int({ min: 100, max: 500 }),
    };
    return HttpResponse.json(content);
  }),

  http.post(API_EDITOR_SAVE, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const body = (await request.json()) as { content: string };
    return HttpResponse.json({
      success: true,
      id: faker.string.uuid(),
      savedAt: new Date().toISOString(),
      wordCount: body.content.split(' ').length,
    });
  }),

  http.post(API_EDITOR_UPLOAD, async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));
    const response: UploadResponse = {
      url: faker.image.url(),
      filename: `image-${faker.string.alphanumeric(8)}.jpg`,
      size: faker.number.int({ min: 10_000, max: 500_000 }),
      mimeType: 'image/jpeg',
    };
    return HttpResponse.json(response);
  }),

  http.post(API_EDITOR_LINK, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { url: string };
    return HttpResponse.json({
      valid: true,
      url: body.url,
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
    });
  }),

  http.get(API_EDITOR, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      features: ['bold', 'italic', 'link', 'image', 'code'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const minimalTiptapStatusHandlers = {
  success: minimalTiptapHandlers,
  badRequest: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONTENT',
          i18n.t('handler.minimalTiptap.invalidEditorContent', 'Invalid editor content'),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.minimalTiptap.authenticationRequiredToSave',
            'Authentication required to save'
          ),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SAVE_FORBIDDEN',
          i18n.t('handler.minimalTiptap.savingIsNotAllowed', 'Saving is not allowed'),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_EDITOR_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.minimalTiptap.contentNotFound', 'Content not found'),
          API_EDITOR_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'VERSION_CONFLICT',
          i18n.t(
            'handler.minimalTiptap.contentWasModifiedByAnother',
            'Content was modified by another user'
          ),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  unprocessableEntity: [
    http.post(API_EDITOR_UPLOAD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_FILE',
          i18n.t('handler.minimalTiptap.invalidFileFormat', 'Invalid file format'),
          API_EDITOR_UPLOAD
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t('handler.minimalTiptap.tooManySaveRequests', 'Too many save requests'),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.minimalTiptap.failedToSaveContent', 'Failed to save content'),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_EDITOR_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  badGateway: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.minimalTiptap.editorServiceUnavailable', 'Editor service unavailable'),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.minimalTiptap.editorServiceIsUnderMaintenance',
            'Editor service is under maintenance'
          ),
          API_EDITOR_SAVE,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.minimalTiptap.editorRequestTimedOut', 'Editor request timed out'),
          API_EDITOR_SAVE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_EDITOR_SAVE, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        id: faker.string.uuid(),
        savedAt: new Date().toISOString(),
        wordCount: 100,
      });
    }),
  ],
  networkError: [http.post(API_EDITOR_SAVE, () => HttpResponse.error())],
  emptyData: [
    http.get(API_EDITOR_CONTENT, async () => {
      await delay(100);
      return HttpResponse.json({ content: '', html: '', wordCount: 0 });
    }),
  ],
  uploadError: [
    http.post(API_EDITOR_UPLOAD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'UPLOAD_FAILED',
          i18n.t('handler.minimalTiptap.failedToUploadFile', 'Failed to upload file'),
          API_EDITOR_UPLOAD
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
};
