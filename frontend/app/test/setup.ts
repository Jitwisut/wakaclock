/**
 * Vitest Setup File
 * @see https://vitest.dev/config/#setupfiles
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Global Test Configuration
// ---------------------------------------------------------------------------

// Suppress console errors/warnings in tests (optional)
// beforeAll(() => {
//   vi.spyOn(console, 'error').mockImplementation(() => {});
//   vi.spyOn(console, 'warn').mockImplementation(() => {});
// });

// ---------------------------------------------------------------------------
// Mock window.matchMedia (for responsive components)
// ---------------------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    // Legacy listeners (some libs still call these)
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// ---------------------------------------------------------------------------
// Mock IntersectionObserver
// ---------------------------------------------------------------------------
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// ---------------------------------------------------------------------------
// Mock ResizeObserver
// ---------------------------------------------------------------------------
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// ---------------------------------------------------------------------------
// Mock scrollTo
// ---------------------------------------------------------------------------
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// ---------------------------------------------------------------------------
// Mock URL.createObjectURL
// ---------------------------------------------------------------------------
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mock-url'),
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});
