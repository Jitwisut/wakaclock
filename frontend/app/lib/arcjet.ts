import arcjet, { detectBot, shield, tokenBucket } from '@arcjet/next';

/**
 * Arcjet Security Configuration
 * @see https://docs.arcjet.com/get-started/nextjs
 */

const key = process.env.ARCJET_KEY;

/**
 * Base Arcjet client with common protections
 */
export const aj = arcjet({
  key: key!, // Required, throws error if not set
  characteristics: ['ip.src'], // Track by IP address
  rules: [
    // Shield protects against common attacks (SQL injection, XSS, etc.)
    shield({ mode: 'LIVE' }),
    // Bot detection
    detectBot({
      mode: 'LIVE',
      allow: [
        'CATEGORY:SEARCH_ENGINE', // Allow search engines
        'CATEGORY:PREVIEW', // Allow link previews
        'CATEGORY:MONITOR', // Allow uptime monitors
      ],
    }),
  ],
});

/**
 * Rate-limited Arcjet client for API routes
 * Example: 100 requests per 60 seconds
 */
export const ajRateLimited = arcjet({
  key: key!,
  characteristics: ['ip.src'],
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({
      mode: 'LIVE',
      allow: ['CATEGORY:SEARCH_ENGINE'],
    }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 100, // 100 tokens per interval
      interval: 60, // 60 seconds
      capacity: 100, // Maximum bucket size
    }),
  ],
});

/**
 * Strict rate limiting for sensitive endpoints (login, signup, etc.)
 * Example: 5 requests per 60 seconds
 */
export const ajStrictRateLimited = arcjet({
  key: key!,
  characteristics: ['ip.src'],
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({
      mode: 'LIVE',
      allow: [], // No bots allowed
    }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 5,
      interval: 60,
      capacity: 5,
    }),
  ],
});

export { default as arcjet } from '@arcjet/next';
