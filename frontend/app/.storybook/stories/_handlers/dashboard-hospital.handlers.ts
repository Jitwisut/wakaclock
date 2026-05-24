import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD HOSPITAL HANDLERS
// Enterprise-grade MSW handlers for hospital management dashboard page
// ============================================================================

const WARD_GENERAL = i18n.t('handler.dashboardHospital.general', 'General');
const WARD_SURGERY = i18n.t('handler.dashboardHospital.surgery', 'Surgery');

// API Endpoints
const API_HOSPITAL = '/api/dashboard/hospital';
const API_HOSPITAL_PATIENTS = '/api/dashboard/hospital/patients';
const API_HOSPITAL_APPOINTMENTS = '/api/dashboard/hospital/appointments';
const API_HOSPITAL_DOCTORS = '/api/dashboard/hospital/doctors';
const API_HOSPITAL_BEDS = '/api/dashboard/hospital/beds';
const API_HOSPITAL_STATS = '/api/dashboard/hospital/stats';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardHospitalHandlers = [
  http.get(API_HOSPITAL, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalPatients: faker.number.int({ min: 500, max: 2000 }),
      admittedToday: faker.number.int({ min: 10, max: 50 }),
      dischargedToday: faker.number.int({ min: 5, max: 30 }),
      totalDoctors: faker.number.int({ min: 50, max: 200 }),
      availableBeds: faker.number.int({ min: 20, max: 100 }),
      occupancyRate: faker.number.float({ min: 60, max: 95, fractionDigits: 1 }),
    });
  }),

  http.get(API_HOSPITAL_PATIENTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const patients = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      age: faker.number.int({ min: 1, max: 90 }),
      gender: faker.helpers.arrayElement([
        i18n.t('handler.dashboardHospital.male', 'Male'),
        i18n.t('handler.dashboardHospital.female', 'Female'),
        i18n.t('handler.dashboardHospital.other', 'Other'),
      ]),
      condition: faker.helpers.arrayElement([
        i18n.t('handler.dashboardHospital.stable', 'Stable'),
        i18n.t('handler.dashboardHospital.critical', 'Critical'),
        i18n.t('handler.dashboardHospital.recovering', 'Recovering'),
        i18n.t('handler.dashboardHospital.underObservation', 'Under Observation'),
      ]),
      ward: faker.helpers.arrayElement([
        'ICU',
        WARD_GENERAL,
        i18n.t('handler.dashboardHospital.pediatric', 'Pediatric'),
        i18n.t('handler.dashboardHospital.emergency', 'Emergency'),
        WARD_SURGERY,
      ]),
      admittedAt: faker.date.recent().toISOString(),
      doctor: faker.person.fullName(),
    }));
    return HttpResponse.json({ patients, total: patients.length });
  }),

  http.get(API_HOSPITAL_APPOINTMENTS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const appointments = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      patientName: faker.person.fullName(),
      doctorName: faker.person.fullName(),
      department: faker.helpers.arrayElement([
        i18n.t('handler.dashboardHospital.cardiology', 'Cardiology'),
        i18n.t('handler.dashboardHospital.neurology', 'Neurology'),
        i18n.t('handler.dashboardHospital.orthopedics', 'Orthopedics'),
        i18n.t('handler.dashboardHospital.pediatrics', 'Pediatrics'),
        WARD_GENERAL,
      ]),
      dateTime: faker.date.soon().toISOString(),
      status: faker.helpers.arrayElement([
        'scheduled',
        'confirmed',
        'in-progress',
        'completed',
        'cancelled',
      ]),
      type: faker.helpers.arrayElement(['checkup', 'follow-up', 'consultation', 'emergency']),
    }));
    return HttpResponse.json({ appointments, total: appointments.length });
  }),

  http.get(API_HOSPITAL_DOCTORS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const doctors = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: `Dr. ${faker.person.fullName()}`,
      specialization: faker.helpers.arrayElement([
        i18n.t('handler.dashboardHospital.cardiology', 'Cardiology'),
        i18n.t('handler.dashboardHospital.neurology', 'Neurology'),
        i18n.t('handler.dashboardHospital.orthopedics', 'Orthopedics'),
        i18n.t('handler.dashboardHospital.pediatrics', 'Pediatrics'),
        WARD_SURGERY,
        i18n.t('handler.dashboardHospital.generalMedicine', 'General Medicine'),
      ]),
      department: faker.helpers.arrayElement([
        'ICU',
        i18n.t('handler.dashboardHospital.emergency', 'Emergency'),
        'OPD',
        WARD_SURGERY,
      ]),
      experience: faker.number.int({ min: 2, max: 30 }),
      patientsToday: faker.number.int({ min: 5, max: 20 }),
      status: faker.helpers.arrayElement(['available', 'busy', 'on-leave']),
    }));
    return HttpResponse.json({ doctors, total: doctors.length });
  }),

  http.get(API_HOSPITAL_BEDS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const wards = [
      {
        name: i18n.t('handler.dashboardHospital.icu', 'ICU'),
        total: 50,
        occupied: faker.number.int({ min: 30, max: 48 }),
      },
      { name: WARD_GENERAL, total: 200, occupied: faker.number.int({ min: 100, max: 180 }) },
      {
        name: i18n.t('handler.dashboardHospital.pediatric', 'Pediatric'),
        total: 50,
        occupied: faker.number.int({ min: 20, max: 45 }),
      },
      {
        name: i18n.t('handler.dashboardHospital.emergency', 'Emergency'),
        total: 30,
        occupied: faker.number.int({ min: 10, max: 28 }),
      },
      { name: WARD_SURGERY, total: 40, occupied: faker.number.int({ min: 20, max: 38 }) },
    ];
    return HttpResponse.json({ wards });
  }),

  http.get(API_HOSPITAL_STATS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const weeklyAdmissions = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      admissions: faker.number.int({ min: 20, max: 60 }),
      discharges: faker.number.int({ min: 15, max: 50 }),
    }));
    return HttpResponse.json({ weeklyAdmissions });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardHospitalStatusHandlers = {
  success: dashboardHospitalHandlers,
  badRequest: [
    http.get(API_HOSPITAL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.dashboardHospital.invalidRequestParameters',
            'Invalid request parameters'
          ),
          API_HOSPITAL,
          {
            field: 'data',
            error: i18n.t('handler.dashboardHospital.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_HOSPITAL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardHospital.authenticationRequired', 'Authentication required'),
          API_HOSPITAL
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_HOSPITAL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardHospital.accessToHospitalDashboardDenied',
            'Access to hospital dashboard denied'
          ),
          API_HOSPITAL
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_HOSPITAL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardHospital.requestValidationFailed', 'Request validation failed'),
          API_HOSPITAL,
          {
            field: 'data',
            error: i18n.t('handler.dashboardHospital.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_HOSPITAL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardHospital.failedToLoadHospitalDashboard',
            'Failed to load hospital dashboard'
          ),
          API_HOSPITAL
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_HOSPITAL, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_HOSPITAL, () => HttpResponse.error())],
  emptyData: [
    http.get(API_HOSPITAL_PATIENTS, async () => {
      await delay(100);
      return HttpResponse.json({ patients: [], total: 0 });
    }),
  ],
};
