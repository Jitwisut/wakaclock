/**
 * ts-reset - Make TypeScript's built-in types stricter
 * @see https://github.com/total-typescript/ts-reset
 *
 * This includes all recommended type resets:
 * - .json (fetch) returns unknown instead of any
 * - .filter(Boolean) correctly narrows types
 * - Array.includes() works on readonly arrays
 * - Set.has() and Map.has() are properly typed
 * - And more...
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import '@total-typescript/ts-reset';
