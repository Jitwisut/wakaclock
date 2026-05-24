/**
 * Hover Card MSW Handlers
 *
 * Mock Service Worker handlers for HoverCard component stories.
 * Provides comprehensive API mocking for user profiles, content previews,
 * products, projects, and teams.
 *
 * @module hover-card.handlers
 * @see {@link file://./../../../components/ui/hover-card.tsx}
 * @see {@link file://./../_factories/hover-card.factory.ts}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ============================================================================
// API ENDPOINTS
// ============================================================================

const API_HOVER_CARD_PROFILE = '/api/hover-card/profile';
const API_HOVER_CARD_PREVIEW = '/api/hover-card/preview';
const API_HOVER_CARD_PRODUCT = '/api/hover-card/product';
const API_HOVER_CARD_PROJECT = '/api/hover-card/project';
const API_HOVER_CARD_TEAM = '/api/hover-card/team';
const API_HOVER_CARD_STATS = '/api/hover-card/stats';
const API_USERS = '/api/users/:id';

// Default success handlers
export const hoverCardHandlers = [
  // GET /api/hover-card/profile - Get user profile for hover card
  http.get(API_HOVER_CARD_PROFILE, async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ?? 'default';
    await delay(faker.number.int({ min: 150, max: 400 }));

    return HttpResponse.json({
      id: userId,
      name: faker.person.fullName(),
      username: faker.internet.username(),
      avatar: faker.image.avatar(),
      bio: faker.person.bio(),
      location: faker.location.city(),
      website: faker.internet.url(),
      stats: {
        followers: faker.number.int({ min: 100, max: 50_000 }),
        following: faker.number.int({ min: 50, max: 1000 }),
        posts: faker.number.int({ min: 10, max: 500 }),
      },
      joinedAt: faker.date.past({ years: 3 }).toISOString(),
      verified: faker.datatype.boolean({ probability: 0.3 }),
    });
  }),

  // GET /api/hover-card/preview - Get content preview for hover card
  http.get(API_HOVER_CARD_PREVIEW, async ({ request }) => {
    const url = new URL(request.url);
    const contentId = url.searchParams.get('contentId') ?? 'default';
    const contentType = url.searchParams.get('type') ?? 'article';
    await delay(faker.number.int({ min: 200, max: 500 }));

    const previews: Record<string, object> = {
      article: {
        id: contentId,
        type: 'article',
        title: faker.lorem.sentence(),
        excerpt: faker.lorem.paragraph(),
        author: faker.person.fullName(),
        publishedAt: faker.date.recent().toISOString(),
        readingTime: faker.number.int({ min: 3, max: 15 }),
        thumbnail: faker.image.urlPicsumPhotos({ width: 200, height: 150 }),
      },
      link: {
        id: contentId,
        type: 'link',
        title: faker.company.name(),
        description: faker.company.catchPhrase(),
        url: faker.internet.url(),
        favicon: faker.image.urlPicsumPhotos({ width: 32, height: 32 }),
        domain: faker.internet.domainName(),
      },
      image: {
        id: contentId,
        type: 'image',
        url: faker.image.urlPicsumPhotos({ width: 300, height: 200 }),
        alt: faker.lorem.sentence({ min: 3, max: 6 }),
        width: 300,
        height: 200,
      },
    };

    return HttpResponse.json(previews[contentType] ?? previews.article);
  }),

  // GET /api/users/:id - Get user data for async hover card demo
  http.get(API_USERS, async ({ params }) => {
    const { id } = params;
    await delay(faker.number.int({ min: 300, max: 800 }));

    return HttpResponse.json({
      id,
      name: faker.person.fullName(),
      username: faker.internet.username().toLowerCase(),
      avatar: faker.image.avatar(),
      bio: faker.person.bio(),
    });
  }),

  // GET /api/hover-card/product - Get product preview
  http.get(API_HOVER_CARD_PRODUCT, async ({ request }) => {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId') ?? 'default';
    await delay(faker.number.int({ min: 200, max: 500 }));

    const hasDiscount = faker.datatype.boolean({ probability: 0.3 });
    const originalPrice = faker.number.float({ min: 20, max: 300, fractionDigits: 2 });
    const discount = hasDiscount ? faker.number.int({ min: 10, max: 40 }) : 0;

    return HttpResponse.json({
      id: productId,
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: hasDiscount ? originalPrice * (1 - discount / 100) : originalPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: hasDiscount ? discount : undefined,
      image: faker.image.urlPicsumPhotos({ width: 200, height: 200 }),
      rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
      reviewCount: faker.number.int({ min: 10, max: 500 }),
      inStock: faker.datatype.boolean({ probability: 0.85 }),
      category: faker.commerce.department(),
    });
  }),

  // GET /api/hover-card/project - Get project info
  http.get(API_HOVER_CARD_PROJECT, async ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId') ?? 'default';
    await delay(faker.number.int({ min: 150, max: 400 }));

    const statuses = ['active', 'paused', 'completed', 'archived'] as const;

    return HttpResponse.json({
      id: projectId,
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
      status: faker.helpers.arrayElement(statuses),
      progress: faker.number.int({ min: 0, max: 100 }),
      memberCount: faker.number.int({ min: 2, max: 15 }),
      taskCount: faker.number.int({ min: 5, max: 50 }),
      lastUpdated: faker.date.recent({ days: 7 }).toISOString(),
    });
  }),

  // GET /api/hover-card/team - Get team info
  http.get(API_HOVER_CARD_TEAM, async ({ request }) => {
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId') ?? 'default';
    await delay(faker.number.int({ min: 150, max: 400 }));

    const memberCount = faker.number.int({ min: 3, max: 20 });

    return HttpResponse.json({
      id: teamId,
      name: `${faker.word.adjective()} ${faker.word.noun()} Team`,
      description: faker.lorem.sentence(),
      department: faker.commerce.department(),
      lead: faker.person.fullName(),
      memberCount,
      memberAvatars: Array.from({ length: Math.min(5, memberCount) }, () => faker.image.avatar()),
      projectCount: faker.number.int({ min: 1, max: 8 }),
    });
  }),

  // GET /api/hover-card/stats - Get stats data
  http.get(API_HOVER_CARD_STATS, async ({ request }) => {
    const url = new URL(request.url);
    const statId = url.searchParams.get('statId') ?? 'default';
    await delay(faker.number.int({ min: 100, max: 300 }));

    const previousValue = faker.number.int({ min: 1000, max: 50_000 });
    const change = faker.number.int({ min: -25, max: 40 });
    const currentValue = Math.round(previousValue * (1 + change / 100));

    // Determine change direction based on threshold
    let changeDirection: 'down' | 'neutral' | 'up' = 'neutral';
    if (change > 2) changeDirection = 'up';
    else if (change < -2) changeDirection = 'down';

    return HttpResponse.json({
      id: statId,
      label: faker.helpers.arrayElement([
        i18n.t('handler.hoverCard.totalRevenue', 'Total Revenue'),
        i18n.t('handler.hoverCard.activeUsers', 'Active Users'),
        i18n.t('handler.hoverCard.conversionRate', 'Conversion Rate'),
        i18n.t('handler.hoverCard.pageViews', 'Page Views'),
      ]),
      value: currentValue,
      previousValue,
      change,
      changeDirection,
      unit: faker.helpers.arrayElement(['$', '%', 'K', undefined]),
    });
  }),
];

// ============================================================================
// STATUS-SPECIFIC HANDLERS
// ============================================================================

// Status-specific handlers for stories
export const hoverCardStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: hoverCardHandlers,

  // ============ 4xx CLIENT ERRORS ============
  notFound: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'USER_NOT_FOUND',
          i18n.t('handler.hoverCard.userProfileNotFound', 'User profile not found'),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unauthorized: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.hoverCard.authenticationRequiredToViewProfile',
            'Authentication required to view profile'
          ),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PROFILE_PRIVATE',
          i18n.t('handler.hoverCard.thisProfileIsPrivate', 'This profile is private'),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t('handler.hoverCard.failedToLoadProfile', 'Failed to load profile'),
          API_HOVER_CARD_PROFILE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_HOVER_CARD_PROFILE, async ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') ?? 'default';
      await delay(3000);
      return HttpResponse.json({
        id: userId,
        name: i18n.t('handler.hoverCard.slowUser', 'Slow User'),
        username: 'slowuser',
        bio: i18n.t(
          'handler.hoverCard.thisProfileTookAWhile',
          'This profile took a while to load.'
        ),
      });
    }),
  ],

  networkError: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // Minimal profile (limited data)
  minimalProfile: [
    http.get(API_HOVER_CARD_PROFILE, async ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') ?? 'default';
      await delay(200);
      return HttpResponse.json({
        id: userId,
        name: faker.person.fullName(),
        username: faker.internet.username(),
        avatar: null,
        bio: null,
        isMinimal: true,
      });
    }),
  ],

  // ============ ADDITIONAL 4xx ERRORS ============
  badRequest: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_USER_ID',
          i18n.t('handler.hoverCard.invalidUserIdFormat', 'Invalid user ID format'),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.hoverCard.invalidProfileData', 'Invalid profile data'),
          API_HOVER_CARD_PROFILE,
          {
            userId: i18n.t(
              'handler.hoverCard.userIdMustBeAValidUuid',
              'User ID must be a valid UUID'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  conflict: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'PROFILE_CONFLICT',
          i18n.t('handler.hoverCard.profileDataConflictDetected', 'Profile data conflict detected'),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.hoverCard.tooManyProfileRequests', 'Too many profile requests'),
          API_HOVER_CARD_PROFILE,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ ADDITIONAL 5xx ERRORS ============
  badGateway: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.hoverCard.profileServiceUnavailable', 'Profile service unavailable'),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.hoverCard.profileServiceUnderMaintenance',
            'Profile service under maintenance'
          ),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.hoverCard.profileRequestTimedOut', 'Profile request timed out'),
          API_HOVER_CARD_PROFILE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ CONTENT-SPECIFIC HANDLERS ============

  /** Product fetch handlers */
  productSuccess: [
    http.get(API_HOVER_CARD_PRODUCT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: 'prod-123',
        name: i18n.t('handler.hoverCard.premiumWirelessHeadphones', 'Premium Wireless Headphones'),
        description: i18n.t(
          'handler.hoverCard.highqualityAudioWithNoiseCancellation',
          'High-quality audio with noise cancellation.'
        ),
        price: 199.99,
        originalPrice: 249.99,
        discount: 20,
        image: 'https://via.placeholder.com/200',
        rating: 4.8,
        reviewCount: 342,
        inStock: true,
        category: i18n.t('handler.hoverCard.electronics', 'Electronics'),
      });
    }),
  ],

  productNotFound: [
    http.get(API_HOVER_CARD_PRODUCT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PRODUCT_NOT_FOUND',
          i18n.t('handler.hoverCard.productNotFound', 'Product not found'),
          API_HOVER_CARD_PRODUCT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  productOutOfStock: [
    http.get(API_HOVER_CARD_PRODUCT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: 'prod-456',
        name: i18n.t('handler.hoverCard.limitedEditionSpeaker', 'Limited Edition Speaker'),
        description: i18n.t('handler.hoverCard.currentlyUnavailable', 'Currently unavailable.'),
        price: 399.99,
        image: 'https://via.placeholder.com/200',
        rating: 4.5,
        reviewCount: 128,
        inStock: false,
        category: i18n.t('handler.hoverCard.electronics', 'Electronics'),
      });
    }),
  ],

  /** Project fetch handlers */
  projectSuccess: [
    http.get(API_HOVER_CARD_PROJECT, async () => {
      await delay(250);
      return HttpResponse.json({
        id: 'proj-123',
        name: i18n.t('handler.hoverCard.websiteRedesign', 'Website Redesign'),
        description: i18n.t(
          'handler.hoverCard.completeOverhaulOfTheCompany',
          'Complete overhaul of the company website.'
        ),
        status: 'active',
        progress: 65,
        memberCount: 8,
        taskCount: 24,
        lastUpdated: new Date().toISOString(),
      });
    }),
  ],

  projectCompleted: [
    http.get(API_HOVER_CARD_PROJECT, async () => {
      await delay(250);
      return HttpResponse.json({
        id: 'proj-456',
        name: i18n.t('handler.hoverCard.mobileAppLaunch', 'Mobile App Launch'),
        description: i18n.t(
          'handler.hoverCard.successfullyLaunchedQ42024',
          'Successfully launched Q4 2024.'
        ),
        status: 'completed',
        progress: 100,
        memberCount: 12,
        taskCount: 48,
        lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }),
  ],

  /** Team fetch handlers */
  teamSuccess: [
    http.get(API_HOVER_CARD_TEAM, async () => {
      await delay(200);
      return HttpResponse.json({
        id: 'team-123',
        name: i18n.t('handler.hoverCard.engineeringTeam', 'Engineering Team'),
        description: i18n.t(
          'handler.hoverCard.buildingTheFutureOfOur',
          'Building the future of our platform.'
        ),
        department: i18n.t('handler.hoverCard.engineering', 'Engineering'),
        lead: i18n.t('handler.hoverCard.sarahChen', 'Sarah Chen'),
        memberCount: 15,
        memberAvatars: Array.from({ length: 5 }, () => faker.image.avatar()),
        projectCount: 4,
      });
    }),
  ],

  /** Stats fetch handlers */
  statsSuccess: [
    http.get(API_HOVER_CARD_STATS, async () => {
      await delay(150);
      return HttpResponse.json({
        id: 'stat-123',
        label: i18n.t('handler.hoverCard.totalRevenue', 'Total Revenue'),
        value: 125_000,
        previousValue: 98_000,
        change: 27.5,
        changeDirection: 'up',
        unit: '$',
      });
    }),
  ],

  statsDecline: [
    http.get(API_HOVER_CARD_STATS, async () => {
      await delay(150);
      return HttpResponse.json({
        id: 'stat-456',
        label: i18n.t('handler.hoverCard.bounceRate', 'Bounce Rate'),
        value: 45,
        previousValue: 38,
        change: -18.4,
        changeDirection: 'down',
        unit: '%',
      });
    }),
  ],

  /** User fetch handlers for async demo */
  userSuccess: [
    http.get(API_USERS, async ({ params }) => {
      const { id } = params;
      await delay(500);
      return HttpResponse.json({
        id,
        name: i18n.t('handler.hoverCard.johnDoe', 'John Doe'),
        username: 'johndoe',
        avatar: 'https://i.pravatar.cc/150?u=johndoe',
        bio: i18n.t(
          'handler.hoverCard.softwareEngineerPassionateAboutBuilding',
          'Software engineer passionate about building great products.'
        ),
      });
    }),
  ],

  userNotFound: [
    http.get(API_USERS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'USER_NOT_FOUND',
          i18n.t('handler.hoverCard.userNotFound', 'User not found'),
          API_USERS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  /** Variable delay handlers for testing hover timing */
  fastResponse: [
    http.get(API_HOVER_CARD_PROFILE, async ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') ?? 'default';
      await delay(50); // Very fast response
      return HttpResponse.json({
        id: userId,
        name: faker.person.fullName(),
        username: faker.internet.username(),
        avatar: faker.image.avatar(),
        bio: i18n.t('handler.hoverCard.quickResponseProfile', 'Quick response profile.'),
      });
    }),
  ],

  mediumResponse: [
    http.get(API_HOVER_CARD_PROFILE, async ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') ?? 'default';
      await delay(1000); // Medium delay
      return HttpResponse.json({
        id: userId,
        name: faker.person.fullName(),
        username: faker.internet.username(),
        avatar: faker.image.avatar(),
        bio: i18n.t('handler.hoverCard.mediumResponseTimeProfile', 'Medium response time profile.'),
      });
    }),
  ],

  /** Empty data handlers */
  emptyData: [
    http.get(API_HOVER_CARD_PROFILE, async () => {
      await delay(200);
      return HttpResponse.json({
        id: null,
        name: null,
        username: null,
        avatar: null,
        bio: null,
        isEmpty: true,
      });
    }),
  ],
};
