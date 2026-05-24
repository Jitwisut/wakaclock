import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD CRM HANDLERS
// Enterprise-grade MSW handlers for CRM dashboard page
// ============================================================================

// API Endpoints
const API_CRM = '/api/dashboard/crm';
const API_CRM_LEADS = '/api/dashboard/crm/leads';
const API_CRM_DEALS = '/api/dashboard/crm/deals';
const API_CRM_CONTACTS = '/api/dashboard/crm/contacts';
const API_CRM_ACTIVITIES = '/api/dashboard/crm/activities';
const API_CRM_PIPELINE = '/api/dashboard/crm/pipeline';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardCrmHandlers = [
  http.get(API_CRM, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalLeads: faker.number.int({ min: 100, max: 1000 }),
      qualifiedLeads: faker.number.int({ min: 50, max: 500 }),
      totalDeals: faker.number.int({ min: 20, max: 200 }),
      wonDeals: faker.number.int({ min: 10, max: 100 }),
      totalRevenue: faker.number.int({ min: 100_000, max: 1_000_000 }),
      conversionRate: faker.number.float({ min: 10, max: 40, fractionDigits: 1 }),
    });
  }),

  http.get(API_CRM_LEADS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const leads = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      company: faker.company.name(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      status: faker.helpers.arrayElement([
        'new',
        'contacted',
        'qualified',
        'proposal',
        'negotiation',
      ]),
      source: faker.helpers.arrayElement(['website', 'referral', 'linkedin', 'cold-call', 'event']),
      value: faker.number.int({ min: 1000, max: 100_000 }),
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ leads, total: leads.length });
  }),

  http.get(API_CRM_DEALS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const deals = Array.from({ length: 8 }, () => ({
      id: faker.string.uuid(),
      title: faker.commerce.productName(),
      company: faker.company.name(),
      value: faker.number.int({ min: 5000, max: 500_000 }),
      stage: faker.helpers.arrayElement([
        'discovery',
        'proposal',
        'negotiation',
        'closed-won',
        'closed-lost',
      ]),
      probability: faker.number.int({ min: 10, max: 100 }),
      expectedClose: faker.date.future().toISOString(),
      owner: faker.person.fullName(),
    }));
    return HttpResponse.json({ deals, total: deals.length });
  }),

  http.get(API_CRM_CONTACTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const contacts = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      company: faker.company.name(),
      title: faker.person.jobTitle(),
      phone: faker.phone.number(),
      lastContact: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ contacts, total: contacts.length });
  }),

  http.get(API_CRM_ACTIVITIES, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const activities = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['call', 'email', 'meeting', 'note', 'task']),
      subject: faker.lorem.sentence(),
      contact: faker.person.fullName(),
      date: faker.date.recent().toISOString(),
      completed: faker.datatype.boolean(),
    }));
    return HttpResponse.json({ activities, total: activities.length });
  }),

  http.get(API_CRM_PIPELINE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const stages = [
      {
        name: i18n.t('handler.dashboardCrm.discovery', 'Discovery'),
        value: faker.number.int({ min: 50_000, max: 200_000 }),
        count: faker.number.int({ min: 5, max: 20 }),
      },
      {
        name: i18n.t('handler.dashboardCrm.proposal', 'Proposal'),
        value: faker.number.int({ min: 100_000, max: 500_000 }),
        count: faker.number.int({ min: 3, max: 15 }),
      },
      {
        name: i18n.t('handler.dashboardCrm.negotiation', 'Negotiation'),
        value: faker.number.int({ min: 150_000, max: 600_000 }),
        count: faker.number.int({ min: 2, max: 10 }),
      },
      {
        name: i18n.t('handler.dashboardCrm.closedWon', 'Closed Won'),
        value: faker.number.int({ min: 200_000, max: 800_000 }),
        count: faker.number.int({ min: 5, max: 25 }),
      },
    ];
    return HttpResponse.json({ stages });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardCrmStatusHandlers = {
  success: dashboardCrmHandlers,
  badRequest: [
    http.get(API_CRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardCrm.invalidRequestParameters', 'Invalid request parameters'),
          API_CRM,
          {
            field: 'data',
            error: i18n.t('handler.dashboardCrm.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardCrm.authenticationRequired', 'Authentication required'),
          API_CRM
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_CRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardCrm.accessToCrmDashboardDenied',
            'Access to CRM dashboard denied'
          ),
          API_CRM
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_CRM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardCrm.requestValidationFailed', 'Request validation failed'),
          API_CRM,
          {
            field: 'data',
            error: i18n.t('handler.dashboardCrm.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_CRM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.dashboardCrm.failedToLoadCrmDashboard', 'Failed to load CRM dashboard'),
          API_CRM
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_CRM, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_CRM, () => HttpResponse.error())],
  emptyData: [
    http.get(API_CRM_LEADS, async () => {
      await delay(100);
      return HttpResponse.json({ leads: [], total: 0 });
    }),
  ],
};
