import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS COURSES HANDLERS
// Enterprise-grade MSW handlers for courses application page
// ============================================================================

// API Endpoints
const API_COURSES = '/api/apps/courses';
const API_COURSES_LIST = '/api/apps/courses/list';
const API_COURSES_DETAIL = '/api/apps/courses/detail';
const API_COURSES_ENROLL = '/api/apps/courses/enroll';
const API_COURSES_PROGRESS = '/api/apps/courses/progress';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsCoursesHandlers = [
  http.get(API_COURSES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalCourses: faker.number.int({ min: 50, max: 200 }),
      enrolledCourses: faker.number.int({ min: 5, max: 20 }),
      completedCourses: faker.number.int({ min: 2, max: 15 }),
      categories: faker.number.int({ min: 5, max: 15 }),
    });
  }),

  http.get(API_COURSES_LIST, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const courses = Array.from({ length: 12 }, () => ({
      id: faker.string.uuid(),
      title: faker.helpers.arrayElement([
        i18n.t('handler.appsCourses.reactFundamentals', 'React Fundamentals'),
        i18n.t('handler.appsCourses.nodejsMastery', 'Node.js Mastery'),
        i18n.t('handler.appsCourses.typescriptDeepDive', 'TypeScript Deep Dive'),
        i18n.t('handler.appsCourses.awsEssentials', 'AWS Essentials'),
        i18n.t('handler.appsCourses.pythonForDataScience', 'Python for Data Science'),
      ]),
      description: faker.lorem.paragraph(),
      instructor: faker.person.fullName(),
      instructorAvatar: faker.image.avatar(),
      thumbnail: faker.image.url(),
      duration: `${faker.number.int({ min: 2, max: 40 })} hours`,
      lessons: faker.number.int({ min: 10, max: 100 }),
      students: faker.number.int({ min: 100, max: 10_000 }),
      rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
      reviews: faker.number.int({ min: 10, max: 1000 }),
      price: faker.number.float({ min: 0, max: 199, fractionDigits: 2 }),
      level: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
      category: faker.helpers.arrayElement([
        i18n.t('handler.appsCourses.webDevelopment', 'Web Development'),
        i18n.t('handler.appsCourses.dataScience', 'Data Science'),
        i18n.t('handler.appsCourses.cloudComputing', 'Cloud Computing'),
        i18n.t('handler.appsCourses.mobileDevelopment', 'Mobile Development'),
      ]),
      enrolled: faker.datatype.boolean({ probability: 0.3 }),
    }));
    return HttpResponse.json({ courses, total: courses.length });
  }),

  http.get(`${API_COURSES_DETAIL}/:id`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      id: faker.string.uuid(),
      title: i18n.t('handler.appsCourses.completeReactCourse', 'Complete React Course'),
      description: faker.lorem.paragraphs(3),
      instructor: faker.person.fullName(),
      sections: Array.from({ length: 5 }, (_, i) => ({
        id: faker.string.uuid(),
        title: `Section ${i + 1}: ${faker.lorem.words(3)}`,
        lessons: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
          id: faker.string.uuid(),
          title: faker.lorem.sentence({ min: 3, max: 6 }),
          duration: faker.number.int({ min: 5, max: 30 }),
          type: faker.helpers.arrayElement(['video', 'quiz', 'article']),
          completed: faker.datatype.boolean(),
        })),
      })),
    });
  }),

  http.post(API_COURSES_ENROLL, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { courseId: string };
    return HttpResponse.json({
      success: true,
      courseId: body.courseId,
      enrolledAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_COURSES_PROGRESS}/:courseId`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      progress: faker.number.int({ min: 0, max: 100 }),
      lessonsCompleted: faker.number.int({ min: 0, max: 50 }),
      totalLessons: 50,
      lastAccessedAt: faker.date.recent().toISOString(),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsCoursesStatusHandlers = {
  success: appsCoursesHandlers,
  badRequest: [
    http.get(API_COURSES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsCourses.invalidRequestParameters', 'Invalid request parameters'),
          API_COURSES,
          {
            field: 'data',
            error: i18n.t('handler.appsCourses.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_COURSES_ENROLL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsCourses.loginToEnroll', 'Login to enroll'),
          API_COURSES_ENROLL
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_COURSES_ENROLL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ALREADY_ENROLLED',
          i18n.t(
            'handler.appsCourses.alreadyEnrolledInThisCourse',
            'Already enrolled in this course'
          ),
          API_COURSES_ENROLL
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(`${API_COURSES_DETAIL}/:id`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'COURSE_NOT_FOUND',
          i18n.t('handler.appsCourses.courseNotFound', 'Course not found'),
          API_COURSES_DETAIL
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_COURSES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsCourses.requestValidationFailed', 'Request validation failed'),
          API_COURSES,
          {
            field: 'data',
            error: i18n.t('handler.appsCourses.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_COURSES_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsCourses.failedToLoadCourses', 'Failed to load courses'),
          API_COURSES_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_COURSES_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_COURSES, () => HttpResponse.error())],
  emptyData: [
    http.get(API_COURSES_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ courses: [], total: 0 });
    }),
  ],
};
