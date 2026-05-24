import posthog from 'posthog-js';

/**
 * PostHog Analytics Configuration
 * @see https://posthog.com/docs/libraries/next-js
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let isInitialized = false;

/**
 * Initialize PostHog client-side
 * Call this in your app's root component or layout
 */
export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not found. Analytics disabled.');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We'll capture manually for better control
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: {
      dom_event_allowlist: ['click', 'submit'],
      css_selector_allowlist: ['[data-ph-capture]'],
    },
  });

  isInitialized = true;
}

/**
 * Capture a custom event
 */
export function captureEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!isInitialized) return;
  posthog.capture(eventName, properties);
}

/**
 * Capture page view
 */
export function capturePageView(url?: string) {
  if (!isInitialized) return;
  posthog.capture('$pageview', { $current_url: url || window.location.href });
}

/**
 * Identify user
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isInitialized) return;
  posthog.identify(userId, properties);
}

/**
 * Reset user identification (on logout)
 */
export function resetUser() {
  if (!isInitialized) return;
  posthog.reset();
}

export { default as posthog } from 'posthog-js';
