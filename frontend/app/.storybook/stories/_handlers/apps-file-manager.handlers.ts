import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS FILE MANAGER HANDLERS
// Enterprise-grade MSW handlers for file manager application page
// ============================================================================

// API Endpoints
const API_FILES = '/api/apps/files';
const API_FILES_LIST = '/api/apps/files/list';
const API_FILES_UPLOAD = '/api/apps/files/upload';
const API_FILES_DOWNLOAD = '/api/apps/files/download';
const API_FILES_DELETE = '/api/apps/files/delete';
const API_FILES_MOVE = '/api/apps/files/move';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsFileManagerHandlers = [
  http.get(API_FILES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalFiles: faker.number.int({ min: 50, max: 500 }),
      totalFolders: faker.number.int({ min: 5, max: 50 }),
      storageUsed: faker.number.int({ min: 1_000_000_000, max: 10_000_000_000 }),
      storageLimit: 15_000_000_000,
    });
  }),

  http.get(API_FILES_LIST, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folderId') || 'root';

    const items = [
      ...Array.from({ length: 5 }, () => ({
        id: faker.string.uuid(),
        name: faker.system.directoryPath().split('/').pop(),
        type: 'folder' as const,
        itemsCount: faker.number.int({ min: 1, max: 50 }),
        modifiedAt: faker.date.recent().toISOString(),
        parentId: folderId,
      })),
      ...Array.from({ length: 15 }, () => ({
        id: faker.string.uuid(),
        name: faker.system.fileName(),
        type: 'file' as const,
        size: faker.number.int({ min: 1000, max: 100_000_000 }),
        mimeType: faker.system.mimeType(),
        modifiedAt: faker.date.recent().toISOString(),
        parentId: folderId,
        thumbnail: faker.datatype.boolean({ probability: 0.3 }) ? faker.image.url() : undefined,
      })),
    ];

    return HttpResponse.json({ items, currentFolder: folderId });
  }),

  http.post(API_FILES_UPLOAD, async () => {
    await delay(faker.number.int({ min: 500, max: 2000 }));
    return HttpResponse.json({
      id: faker.string.uuid(),
      name: faker.system.fileName(),
      size: faker.number.int({ min: 1000, max: 10_000_000 }),
      uploadedAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_FILES_DOWNLOAD}/:id`, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json({
      downloadUrl: faker.internet.url(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }),

  http.delete(`${API_FILES_DELETE}/:id`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({ success: true, deletedAt: new Date().toISOString() });
  }),

  http.post(API_FILES_MOVE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { itemIds: string[]; targetFolderId: string };
    return HttpResponse.json({
      success: true,
      movedCount: body.itemIds.length,
      targetFolder: body.targetFolderId,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsFileManagerStatusHandlers = {
  success: appsFileManagerHandlers,
  badRequest: [
    http.get(API_FILES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsFileManager.invalidRequestParameters', 'Invalid request parameters'),
          API_FILES,
          {
            field: 'data',
            error: i18n.t('handler.appsFileManager.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_FILES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsFileManager.authenticationRequired', 'Authentication required'),
          API_FILES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_FILES_UPLOAD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'UPLOAD_FORBIDDEN',
          i18n.t('handler.appsFileManager.uploadNotAllowed', 'Upload not allowed'),
          API_FILES_UPLOAD
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_FILES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsFileManager.requestValidationFailed', 'Request validation failed'),
          API_FILES,
          {
            field: 'data',
            error: i18n.t('handler.appsFileManager.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_FILES_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsFileManager.failedToLoadFiles', 'Failed to load files'),
          API_FILES_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_FILES_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_FILES_UPLOAD, () => HttpResponse.error())],
  emptyData: [
    http.get(API_FILES_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ items: [], currentFolder: 'root' });
    }),
  ],
};
