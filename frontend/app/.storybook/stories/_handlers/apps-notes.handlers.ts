import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS NOTES HANDLERS
// Enterprise-grade MSW handlers for notes application page
// ============================================================================

// API Endpoints
const API_NOTES = '/api/apps/notes';
const API_NOTES_LIST = '/api/apps/notes/list';
const API_NOTES_CREATE = '/api/apps/notes/create';
const API_NOTES_UPDATE = '/api/apps/notes/update';
const API_NOTES_DELETE = '/api/apps/notes/delete';
const API_NOTES_FOLDERS = '/api/apps/notes/folders';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsNotesHandlers = [
  http.get(API_NOTES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalNotes: faker.number.int({ min: 20, max: 200 }),
      recentNotes: faker.number.int({ min: 5, max: 20 }),
      pinnedNotes: faker.number.int({ min: 0, max: 10 }),
      foldersCount: faker.number.int({ min: 1, max: 10 }),
    });
  }),

  http.get(API_NOTES_LIST, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const notes = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 2, max: 6 }),
      content: faker.lorem.paragraphs({ min: 1, max: 5 }),
      preview: faker.lorem.sentence(),
      folderId: faker.string.uuid(),
      folderName: faker.helpers.arrayElement([
        i18n.t('handler.appsNotes.personal', 'Personal'),
        i18n.t('handler.appsNotes.work', 'Work'),
        i18n.t('handler.appsNotes.ideas', 'Ideas'),
        i18n.t('handler.appsNotes.archive', 'Archive'),
      ]),
      tags: faker.helpers.arrayElements(
        ['important', 'todo', 'reference', 'meeting'],
        faker.number.int({ min: 0, max: 2 })
      ),
      pinned: faker.datatype.boolean({ probability: 0.2 }),
      favorite: faker.datatype.boolean({ probability: 0.3 }),
      color: faker.helpers.arrayElement(['default', 'yellow', 'green', 'blue', 'pink']),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ notes, total: notes.length });
  }),

  http.post(API_NOTES_CREATE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { content: string; title: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      title: body.title,
      content: body.content,
      createdAt: new Date().toISOString(),
    });
  }),

  http.put(`${API_NOTES_UPDATE}/:id`, async ({ request, params }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete(`${API_NOTES_DELETE}/:id`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({ success: true, deletedAt: new Date().toISOString() });
  }),

  http.get(API_NOTES_FOLDERS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const folders = [
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsNotes.personal', 'Personal'),
        notesCount: faker.number.int({ min: 5, max: 30 }),
        color: '#3b82f6',
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsNotes.work', 'Work'),
        notesCount: faker.number.int({ min: 10, max: 50 }),
        color: '#ef4444',
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsNotes.ideas', 'Ideas'),
        notesCount: faker.number.int({ min: 3, max: 20 }),
        color: '#22c55e',
      },
      {
        id: faker.string.uuid(),
        name: i18n.t('handler.appsNotes.archive', 'Archive'),
        notesCount: faker.number.int({ min: 10, max: 100 }),
        color: '#6b7280',
      },
    ];
    return HttpResponse.json({ folders });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsNotesStatusHandlers = {
  success: appsNotesHandlers,
  badRequest: [
    http.get(API_NOTES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsNotes.invalidRequestParameters', 'Invalid request parameters'),
          API_NOTES,
          {
            field: 'data',
            error: i18n.t('handler.appsNotes.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_NOTES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsNotes.authenticationRequired', 'Authentication required'),
          API_NOTES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_NOTES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.appsNotes.accessDeniedToThisResource', 'Access denied to this resource'),
          API_NOTES
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_NOTES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsNotes.requestValidationFailed', 'Request validation failed'),
          API_NOTES,
          {
            field: 'data',
            error: i18n.t('handler.appsNotes.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_NOTES_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsNotes.failedToLoadNotes', 'Failed to load notes'),
          API_NOTES_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_NOTES_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_NOTES, () => HttpResponse.error())],
  emptyData: [
    http.get(API_NOTES_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ notes: [], total: 0 });
    }),
  ],
};
