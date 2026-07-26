import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Type-safe environment variables
 * @see https://env.t3.gg/docs/nextjs
 */
export const env = createEnv({
  // ---------------------------------------------------------------------------
  // Server-side Environment Variables
  // ---------------------------------------------------------------------------
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Database
    DATABASE_URL: z.string().url().optional(),

    // Authentication
    AUTH_SECRET: z.string().min(32).optional(),

    // Arcjet Security
    ARCJET_KEY: z.string().optional(),

    // Analytics (server-side)
    POSTHOG_API_KEY: z.string().optional(),
  },

  // ---------------------------------------------------------------------------
  // Client-side Environment Variables
  // ---------------------------------------------------------------------------
  client: {
    // App
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),

    // Wakaclock API
    NEXT_PUBLIC_WAKACLOCK_API_URL: z.string().url().default('http://localhost:8080'),

    // Analytics
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

    // Google Analytics
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  },

  // ---------------------------------------------------------------------------
  // Runtime Environment
  // ---------------------------------------------------------------------------
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,

    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    ARCJET_KEY: process.env.ARCJET_KEY,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,

    // Client
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WAKACLOCK_API_URL: process.env.NEXT_PUBLIC_WAKACLOCK_API_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },

  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
