import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD FILE MANAGER HANDLERS
// Enterprise-grade MSW handlers for file manager dashboard page
// ============================================================================

// API Endpoints
const API_FILES = '/api/dashboard/files';
const API_FILES_LIST = '/api/dashboard/files/list';
const API_FILES_UPLOAD = '/api/dashboard/files/upload';
const API_FILES_DOWNLOAD = '/api/dashboard/files/download';
const API_FILES_DELETE = '/api/dashboard/files/delete';
const API_FILES_STORAGE = '/api/dashboard/files/storage';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardFileManagerHandlers = [
  http.get(API_FILES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalFiles: faker.number.int({ min: 100, max: 5000 }),
      totalFolders: faker.number.int({ min: 10, max: 100 }),
      storageUsed: faker.number.int({ min: 1_000_000_000, max: 50_000_000_000 }),
      storageLimit: 100_000_000_000,
      recentUploads: faker.number.int({ min: 5, max: 50 }),
    });
  }),

  http.get(API_FILES_LIST, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folderId') || 'root';

    const files = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: `${faker.system.fileName()}.${faker.helpers.arrayElement(['pdf', 'doc', 'xlsx', 'jpg', 'png', 'mp4'])}`,
      type: faker.helpers.arrayElement(['document', 'image', 'video', 'audio', 'archive']),
      size: faker.number.int({ min: 1000, max: 100_000_000 }),
      mimeType: faker.system.mimeType(),
      createdAt: faker.date.recent().toISOString(),
      modifiedAt: faker.date.recent().toISOString(),
      folderId,
      shared: faker.datatype.boolean(),
    }));

    const folders = Array.from({ length: 3 }, () => ({
      id: faker.string.uuid(),
      name: faker.system.directoryPath().split('/').pop(),
      type: 'folder',
      itemCount: faker.number.int({ min: 1, max: 50 }),
      createdAt: faker.date.recent().toISOString(),
      folderId,
    }));

    return HttpResponse.json({ files, folders, currentFolder: folderId });
  }),

  http.post(API_FILES_UPLOAD, async () => {
    await delay(faker.number.int({ min: 500, max: 2000 }));
    return HttpResponse.json({
      success: true,
      fileId: faker.string.uuid(),
      name: faker.system.fileName(),
      size: faker.number.int({ min: 1000, max: 10_000_000 }),
      uploadedAt: new Date().toISOString(),
    });
  }),

  http.get(API_FILES_DOWNLOAD, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      downloadUrl: faker.internet.url(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }),

  http.delete(API_FILES_DELETE, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json({
      success: true,
      deletedAt: new Date().toISOString(),
    });
  }),

  http.get(API_FILES_STORAGE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      used: faker.number.int({ min: 1_000_000_000, max: 50_000_000_000 }),
      limit: 100_000_000_000,
      breakdown: {
        documents: faker.number.int({ min: 100_000_000, max: 5_000_000_000 }),
        images: faker.number.int({ min: 500_000_000, max: 20_000_000_000 }),
        videos: faker.number.int({ min: 1_000_000_000, max: 30_000_000_000 }),
        other: faker.number.int({ min: 50_000_000, max: 1_000_000_000 }),
      },
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardFileManagerStatusHandlers = {
  success: dashboardFileManagerHandlers,
  badRequest: [
    http.get(API_FILES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.dashboardFileManager.invalidRequestParameters',
            'Invalid request parameters'
          ),
          API_FILES,
          {
            field: 'data',
            error: i18n.t('handler.dashboardFileManager.invalidFormat', 'Invalid format'),
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
          i18n.t('handler.dashboardFileManager.authenticationRequired', 'Authentication required'),
          API_FILES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_FILES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t('handler.dashboardFileManager.accessToFilesDenied', 'Access to files denied'),
          API_FILES
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
          i18n.t(
            'handler.dashboardFileManager.requestValidationFailed',
            'Request validation failed'
          ),
          API_FILES,
          {
            field: 'data',
            error: i18n.t('handler.dashboardFileManager.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_FILES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.dashboardFileManager.failedToLoadFiles', 'Failed to load files'),
          API_FILES
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
  networkError: [http.get(API_FILES, () => HttpResponse.error())],
  emptyData: [
    http.get(API_FILES_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ files: [], folders: [], currentFolder: 'root' });
    }),
  ],
  storageFull: [
    http.post(API_FILES_UPLOAD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'STORAGE_FULL',
          i18n.t('handler.dashboardFileManager.storageLimitExceeded', 'Storage limit exceeded'),
          API_FILES_UPLOAD
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],
};
