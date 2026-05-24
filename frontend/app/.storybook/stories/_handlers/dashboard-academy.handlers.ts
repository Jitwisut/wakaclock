import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD ACADEMY HANDLERS
// Enterprise-grade MSW handlers for academy dashboard page
// ============================================================================

// API Endpoints
const API_ACADEMY = '/api/dashboard/academy';
const API_ACADEMY_COURSES = '/api/dashboard/academy/courses';
const API_ACADEMY_PROGRESS = '/api/dashboard/academy/progress';
const API_ACADEMY_ENROLLMENTS = '/api/dashboard/academy/enrollments';
const API_ACADEMY_CERTIFICATES = '/api/dashboard/academy/certificates';
const API_ACADEMY_INSTRUCTORS = '/api/dashboard/academy/instructors';

// Types
interface Course {
  duration: string;
  enrolled: number;
  id: string;
  instructor: string;
  level: 'advanced' | 'beginner' | 'intermediate';
  rating: number;
  thumbnail: string;
  title: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardAcademyHandlers = [
  http.get(API_ACADEMY, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalCourses: faker.number.int({ min: 50, max: 200 }),
      activeStudents: faker.number.int({ min: 1000, max: 5000 }),
      completionRate: faker.number.float({ min: 60, max: 95, fractionDigits: 1 }),
      totalRevenue: faker.number.int({ min: 50_000, max: 200_000 }),
      avgRating: faker.number.float({ min: 4, max: 5, fractionDigits: 1 }),
    });
  }),

  http.get(API_ACADEMY_COURSES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const courses: Course[] = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      title: faker.helpers.arrayElement([
        i18n.t('handler.dashboardAcademy.introductionToTypescript', 'Introduction to TypeScript'),
        i18n.t('handler.dashboardAcademy.advancedReactPatterns', 'Advanced React Patterns'),
        i18n.t('handler.dashboardAcademy.nodejsMasterclass', 'Node.js Masterclass'),
        i18n.t('handler.dashboardAcademy.graphqlFundamentals', 'GraphQL Fundamentals'),
        i18n.t('handler.dashboardAcademy.awsCloudArchitecture', 'AWS Cloud Architecture'),
      ]),
      instructor: faker.person.fullName(),
      duration: `${faker.number.int({ min: 2, max: 40 })} hours`,
      level: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
      enrolled: faker.number.int({ min: 100, max: 5000 }),
      rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
      thumbnail: faker.image.url(),
    }));
    return HttpResponse.json({ courses, total: courses.length });
  }),

  http.get(API_ACADEMY_PROGRESS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      inProgress: faker.number.int({ min: 5, max: 20 }),
      completed: faker.number.int({ min: 10, max: 50 }),
      hoursLearned: faker.number.int({ min: 50, max: 500 }),
      streak: faker.number.int({ min: 1, max: 30 }),
      weeklyGoal: { target: 10, current: faker.number.int({ min: 0, max: 10 }) },
    });
  }),

  http.get(API_ACADEMY_ENROLLMENTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const enrollments = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      count: faker.number.int({ min: 10, max: 100 }),
    }));
    return HttpResponse.json({ enrollments });
  }),

  http.get(API_ACADEMY_CERTIFICATES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const certificates = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      courseName: faker.helpers.arrayElement([
        i18n.t('handler.dashboardAcademy.reactFundamentals', 'React Fundamentals'),
        i18n.t('handler.dashboardAcademy.nodejsBasics', 'Node.js Basics'),
        i18n.t('handler.dashboardAcademy.typescriptPro', 'TypeScript Pro'),
      ]),
      issuedAt: faker.date.recent().toISOString(),
      credentialId: faker.string.alphanumeric(10).toUpperCase(),
    }));
    return HttpResponse.json({ certificates, total: certificates.length });
  }),

  http.get(API_ACADEMY_INSTRUCTORS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const instructors = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      courses: faker.number.int({ min: 1, max: 10 }),
      students: faker.number.int({ min: 100, max: 5000 }),
      rating: faker.number.float({ min: 4, max: 5, fractionDigits: 1 }),
    }));
    return HttpResponse.json({ instructors });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardAcademyStatusHandlers = {
  success: dashboardAcademyHandlers,
  badRequest: [
    http.get(API_ACADEMY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardAcademy.invalidRequestParameters', 'Invalid request parameters'),
          API_ACADEMY,
          {
            field: 'data',
            error: i18n.t('handler.dashboardAcademy.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ACADEMY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardAcademy.authenticationRequired', 'Authentication required'),
          API_ACADEMY
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_ACADEMY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardAcademy.accessToAcademyDashboardDenied',
            'Access to academy dashboard denied'
          ),
          API_ACADEMY
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_ACADEMY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardAcademy.requestValidationFailed', 'Request validation failed'),
          API_ACADEMY,
          {
            field: 'data',
            error: i18n.t('handler.dashboardAcademy.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_ACADEMY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardAcademy.failedToLoadAcademyDashboard',
            'Failed to load academy dashboard'
          ),
          API_ACADEMY
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_ACADEMY, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_ACADEMY, () => HttpResponse.error())],
  emptyData: [
    http.get(API_ACADEMY_COURSES, async () => {
      await delay(100);
      return HttpResponse.json({ courses: [], total: 0 });
    }),
  ],
};
