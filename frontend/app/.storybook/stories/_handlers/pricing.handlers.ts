import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_PRICING_PLANS = '/api/pricing/plans';
const API_PRICING_SUBSCRIBE = '/api/pricing/subscribe';
const API_PRICING_CHECKOUT = '/api/pricing/checkout';

// Default success handlers
export const pricingHandlers = [
  // GET /api/pricing/plans - Get available pricing plans
  http.get(API_PRICING_PLANS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json({
      success: true,
      plans: [
        {
          id: 'free',
          name: i18n.t('handler.pricing.free', 'Free'),
          price: 0,
          currency: 'USD',
          interval: 'month',
          features: [
            i18n.t('handler.pricing.5Projects', '5 projects'),
            i18n.t('handler.pricing.1gbStorage', '1GB storage'),
            i18n.t('handler.pricing.communitySupport', 'Community support'),
          ],
          highlighted: false,
        },
        {
          id: 'pro',
          name: i18n.t('handler.pricing.pro', 'Pro'),
          price: 29,
          currency: 'USD',
          interval: 'month',
          features: [
            i18n.t('handler.pricing.unlimitedProjects', 'Unlimited projects'),
            i18n.t('handler.pricing.100gbStorage', '100GB storage'),
            i18n.t('handler.pricing.prioritySupport', 'Priority support'),
            i18n.t('handler.pricing.advancedAnalytics', 'Advanced analytics'),
          ],
          highlighted: true,
        },
        {
          id: 'enterprise',
          name: i18n.t('handler.pricing.enterprise', 'Enterprise'),
          price: 99,
          currency: 'USD',
          interval: 'month',
          features: [
            i18n.t('handler.pricing.unlimitedEverything', 'Unlimited everything'),
            i18n.t('handler.pricing.dedicatedSupport', 'Dedicated support'),
            i18n.t('handler.pricing.customIntegrations', 'Custom integrations'),
            i18n.t('handler.pricing.slaGuarantee', 'SLA guarantee'),
          ],
          highlighted: false,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/pricing/subscribe - Subscribe to a plan
  http.post(API_PRICING_SUBSCRIBE, async ({ request }) => {
    const body = (await request.json()) as { billingCycle?: string; planId?: string };
    await delay(faker.number.int({ min: 500, max: 1000 }));

    return HttpResponse.json({
      success: true,
      subscriptionId: faker.string.uuid(),
      planId: body.planId ?? 'pro',
      billingCycle: body.billingCycle ?? 'monthly',
      status: 'active',
      startDate: new Date().toISOString(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  // POST /api/pricing/checkout - Create checkout session
  http.post(API_PRICING_CHECKOUT, async ({ request }) => {
    const body = (await request.json()) as {
      cancelUrl?: string;
      planId?: string;
      successUrl?: string;
    };
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      checkoutSessionId: `cs_${faker.string.alphanumeric(24)}`,
      checkoutUrl: `https://checkout.stripe.com/pay/${faker.string.alphanumeric(32)}`,
      planId: body.planId ?? 'pro',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const pricingStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: pricingHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PLAN',
          i18n.t('handler.pricing.invalidPricingPlanSpecified', 'Invalid pricing plan specified'),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.pricing.authenticationRequiredToSubscribe',
            'Authentication required to subscribe'
          ),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.pricing.youDoNotHavePermission',
            'You do not have permission to change subscription'
          ),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PLAN_NOT_FOUND',
          i18n.t('handler.pricing.pricingPlanNotFound', 'Pricing plan not found'),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'ALREADY_SUBSCRIBED',
          i18n.t(
            'handler.pricing.youAreAlreadySubscribedTo',
            'You are already subscribed to this plan'
          ),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.pricing.validationFailedBillingInformationIs',
            'Validation failed: billing information is incomplete'
          ),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.pricing.tooManySubscriptionRequests', 'Too many subscription requests'),
          API_PRICING_SUBSCRIBE,
          {
            limit: '10/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SUBSCRIPTION_FAILED',
          i18n.t('handler.pricing.failedToProcessSubscription', 'Failed to process subscription'),
          API_PRICING_SUBSCRIBE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'PAYMENT_GATEWAY_ERROR',
          i18n.t('handler.pricing.paymentGatewayUnavailable', 'Payment gateway unavailable'),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.pricing.billingServiceIsUnderMaintenance',
            'Billing service is under maintenance'
          ),
          API_PRICING_SUBSCRIBE,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.pricing.subscriptionRequestTimedOut', 'Subscription request timed out'),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_PRICING_PLANS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_PRICING_PLANS, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        plans: [
          {
            id: 'free',
            name: i18n.t('handler.pricing.free', 'Free'),
            price: 0,
            currency: 'USD',
            interval: 'month',
          },
          {
            id: 'pro',
            name: i18n.t('handler.pricing.pro', 'Pro'),
            price: 29,
            currency: 'USD',
            interval: 'month',
          },
        ],
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_PRICING_PLANS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  // ============ PRICING PAGE SPECIFIC HANDLERS ============
  plansSuccess: [
    http.get(API_PRICING_PLANS, async () => {
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json({
        success: true,
        plans: [
          {
            id: 'starter',
            name: i18n.t('handler.pricing.starter', 'Starter'),
            price: 0,
            currency: 'USD',
            interval: 'month',
            features: [
              '5 projects',
              '1GB storage',
              i18n.t('handler.pricing.communitySupport', 'Community support'),
              i18n.t('handler.pricing.basicAnalytics', 'Basic analytics'),
            ],
            highlighted: false,
            ctaText: i18n.t('handler.pricing.getStarted', 'Get Started'),
          },
          {
            id: 'professional',
            name: i18n.t('handler.pricing.professional', 'Professional'),
            price: 49,
            currency: 'USD',
            interval: 'month',
            features: [
              i18n.t('handler.pricing.unlimitedProjects', 'Unlimited projects'),
              '100GB storage',
              i18n.t('handler.pricing.prioritySupport', 'Priority support'),
              i18n.t('handler.pricing.advancedAnalytics', 'Advanced analytics'),
              i18n.t('handler.pricing.teamCollaboration', 'Team collaboration'),
              i18n.t('handler.pricing.apiAccess', 'API access'),
            ],
            highlighted: true,
            ctaText: i18n.t('handler.pricing.startFreeTrial', 'Start Free Trial'),
            badge: i18n.t('handler.pricing.mostPopular', 'Most Popular'),
          },
          {
            id: 'enterprise',
            name: i18n.t('handler.pricing.enterprise', 'Enterprise'),
            price: 199,
            currency: 'USD',
            interval: 'month',
            features: [
              i18n.t('handler.pricing.unlimitedEverything', 'Unlimited everything'),
              i18n.t('handler.pricing.unlimitedStorage', 'Unlimited storage'),
              i18n.t('handler.pricing.dedicatedSupport', 'Dedicated support'),
              i18n.t('handler.pricing.customIntegrations', 'Custom integrations'),
              i18n.t('handler.pricing.slaGuarantee', 'SLA guarantee'),
              'SSO/SAML',
              i18n.t('handler.pricing.auditLogs', 'Audit logs'),
            ],
            highlighted: false,
            ctaText: i18n.t('handler.pricing.contactSales', 'Contact Sales'),
          },
        ],
        annualDiscount: 20,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  plansEmpty: [
    http.get(API_PRICING_PLANS, async () => {
      await delay(200);
      return HttpResponse.json({
        success: true,
        plans: [],
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  plansError: [
    http.get(API_PRICING_PLANS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'PLANS_FETCH_FAILED',
          i18n.t('handler.pricing.failedToFetchPricingPlans', 'Failed to fetch pricing plans'),
          API_PRICING_PLANS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  checkoutSuccess: [
    http.post(API_PRICING_CHECKOUT, async ({ request }) => {
      const body = (await request.json()) as { planId?: string };
      await delay(faker.number.int({ min: 500, max: 1000 }));
      return HttpResponse.json({
        success: true,
        checkoutSessionId: `cs_${faker.string.alphanumeric(24)}`,
        checkoutUrl: `https://checkout.stripe.com/pay/${faker.string.alphanumeric(32)}`,
        planId: body.planId ?? 'professional',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }),
  ],

  checkoutFailed: [
    http.post(API_PRICING_CHECKOUT, async () => {
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'CHECKOUT_FAILED',
          i18n.t(
            'handler.pricing.failedToCreateCheckoutSession',
            'Failed to create checkout session'
          ),
          API_PRICING_CHECKOUT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  paymentRequired: [
    http.post(API_PRICING_SUBSCRIBE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.PAYMENT_REQUIRED,
          'PAYMENT_REQUIRED',
          i18n.t(
            'handler.pricing.paymentMethodRequiredToSubscribe',
            'Payment method required to subscribe'
          ),
          API_PRICING_SUBSCRIBE
        ),
        { status: HTTP_STATUS.PAYMENT_REQUIRED }
      );
    }),
  ],

  subscriptionCancelled: [
    http.post('/api/pricing/cancel', async () => {
      await delay(faker.number.int({ min: 300, max: 600 }));
      return HttpResponse.json({
        success: true,
        subscriptionId: faker.string.uuid(),
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }),
  ],

  subscriptionUpgraded: [
    http.post('/api/pricing/upgrade', async ({ request }) => {
      const body = (await request.json()) as { toPlanId?: string };
      await delay(faker.number.int({ min: 500, max: 1000 }));
      return HttpResponse.json({
        success: true,
        subscriptionId: faker.string.uuid(),
        previousPlan: 'starter',
        newPlan: body.toPlanId ?? 'professional',
        status: 'active',
        effectiveDate: new Date().toISOString(),
        proratedAmount: faker.number.float({ min: 10, max: 50, fractionDigits: 2 }),
      });
    }),
  ],

  subscriptionDowngraded: [
    http.post('/api/pricing/downgrade', async ({ request }) => {
      const body = (await request.json()) as { toPlanId?: string };
      await delay(faker.number.int({ min: 500, max: 1000 }));
      return HttpResponse.json({
        success: true,
        subscriptionId: faker.string.uuid(),
        previousPlan: 'professional',
        newPlan: body.toPlanId ?? 'starter',
        status: 'pending_downgrade',
        effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        message: i18n.t(
          'handler.pricing.yourPlanWillBeDowngraded',
          'Your plan will be downgraded at the end of the current billing period'
        ),
      });
    }),
  ],

  couponValid: [
    http.post('/api/pricing/coupon/validate', async ({ request }) => {
      const body = (await request.json()) as { code?: string };
      await delay(faker.number.int({ min: 200, max: 400 }));
      return HttpResponse.json({
        success: true,
        valid: true,
        code: body.code ?? 'SAVE20',
        discountType: 'percentage',
        discountValue: 20,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        applicablePlans: ['professional', 'enterprise'],
      });
    }),
  ],

  couponInvalid: [
    http.post('/api/pricing/coupon/validate', async () => {
      await delay(200);
      return HttpResponse.json({
        success: true,
        valid: false,
        message: i18n.t(
          'handler.pricing.couponCodeIsInvalidOr',
          'Coupon code is invalid or expired'
        ),
      });
    }),
  ],
};
