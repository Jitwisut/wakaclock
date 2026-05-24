/**
 * MinimalTiptap Utilities
 * @module minimal-tiptap/utils
 * @description Utility functions for the MinimalTiptap editor
 */

import type { Editor } from '@tiptap/react';
import type { MinimalTiptapOutput } from './types';

/**
 * Result of parsing a keyboard shortcut key
 * @description Contains both the symbol and readable name for a shortcut key
 */
export type ShortcutKeyResult = {
  /** Symbol representation (e.g., '⌘' for Command) */
  symbol: string;
  /** Human-readable name (e.g., 'Command') */
  readable: string;
};

/**
 * File validation error
 * @description Describes an error that occurred during file validation
 */
export type FileError = {
  /** The file or string that caused the error */
  file: File | string;
  /** The reason for the validation failure */
  reason: 'type' | 'size' | 'invalidBase64' | 'base64NotAllowed';
};

/**
 * Options for file validation
 * @description Configuration for validating file uploads
 */
export type FileValidationOptions = {
  /** Array of allowed MIME types (e.g., ['image/png', 'image/jpeg']) */
  allowedMimeTypes: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Whether to allow base64-encoded content */
  allowBase64: boolean;
};

/**
 * File input type for validation
 * @internal
 */
type FileInput = File | { src: string | File; alt?: string; title?: string };

/**
 * Check if code is running in a browser environment
 * @returns True if running in a browser, false otherwise
 */
export const isClient = (): boolean => typeof window !== 'undefined';

/**
 * Check if code is running in a server environment
 * @returns True if running on server, false otherwise
 */
export const isServer = (): boolean => !isClient();

/**
 * Check if the current platform is macOS
 * @returns True if running on macOS, false otherwise
 */
export const isMacOS = (): boolean => isClient() && window.navigator.platform === 'MacIntel';

/**
 * Mapping of shortcut keys to their display representations
 * @internal
 */
const shortcutKeyMap: Record<string, ShortcutKeyResult> = {
  mod: isMacOS() ? { symbol: '⌘', readable: 'Command' } : { symbol: 'Ctrl', readable: 'Control' },
  alt: isMacOS() ? { symbol: '⌥', readable: 'Option' } : { symbol: 'Alt', readable: 'Alt' },
  shift: { symbol: '⇧', readable: 'Shift' },
};

/**
 * Get the display representation of a shortcut key
 * @param key - The key identifier (e.g., 'mod', 'alt', 'shift')
 * @returns The symbol and readable name for the key
 */
export const getShortcutKey = (key: string): ShortcutKeyResult =>
  shortcutKeyMap[key.toLowerCase()] || { symbol: key, readable: key };

/**
 * Get display representations for multiple shortcut keys
 * @param keys - Array of key identifiers
 * @returns Array of symbol and readable name pairs
 */
export const getShortcutKeys = (keys: string[]): ShortcutKeyResult[] => keys.map(getShortcutKey);

/**
 * Get editor content in the specified format
 * @param editor - The TipTap editor instance
 * @param format - The desired output format ('html', 'json', or 'text')
 * @returns The editor content in the specified format
 */
export const getOutput = (editor: Editor, format?: MinimalTiptapOutput): object | string => {
  switch (format) {
    case 'json':
      return editor.getJSON();
    case 'html':
      return editor.isEmpty ? '' : editor.getHTML();
    default:
      return editor.getText();
  }
};

/**
 * Check if a string is a valid URL
 * @param text - The string to validate
 * @param options - Validation options
 * @returns True if the string is a valid URL, false otherwise
 */
export const isUrl = (
  text: string,
  options: { requireHostname: boolean; allowBase64?: boolean } = { requireHostname: false }
): boolean => {
  if (text.includes('\n')) return false;

  try {
    const url = new URL(text);
    const blockedProtocols = [
      'javascript:',
      'file:',
      'vbscript:',
      ...(options.allowBase64 ? [] : ['data:']),
    ];

    if (blockedProtocols.includes(url.protocol)) return false;
    if (options.allowBase64 && url.protocol === 'data:')
      return /^data:image\/[a-z]+;base64,/.test(text);
    if (url.hostname) return true;

    return (
      url.protocol !== '' &&
      (url.pathname.startsWith('//') || url.pathname.startsWith('http')) &&
      !options.requireHostname
    );
  } catch {
    return false;
  }
};

/**
 * Sanitize and validate a URL string
 * @param url - The URL to sanitize (may be null or undefined)
 * @param options - Sanitization options
 * @returns The sanitized URL or undefined if invalid
 */
export const sanitizeUrl = (
  url: string | null | undefined,
  options: { allowBase64?: boolean } = {}
): string | undefined => {
  if (!url) return undefined;

  if (options.allowBase64 && url.startsWith('data:image')) {
    return isUrl(url, { requireHostname: false, allowBase64: true }) ? url : undefined;
  }

  return isUrl(url, { requireHostname: false, allowBase64: options.allowBase64 }) ||
    /^(\/|#|mailto:|sms:|fax:|tel:)/.test(url)
    ? url
    : `https://${url}`;
};

/**
 * Convert a blob URL to a base64 string
 * @param blobUrl - The blob URL to convert
 * @returns A promise that resolves to the base64 string
 */
export const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert Blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Hash a string to a base36 value
 * @param value - The string to hash
 * @returns A 9-character base36 hash
 * @internal
 */
const hashToBase36 = (value: string): string => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(9, '0').slice(0, 9);
};

/**
 * Generate a random ID
 * @param seed - Optional seed for deterministic ID generation
 * @returns A random or seeded 9-character ID
 */
export const randomId = (seed?: string): string =>
  seed ? hashToBase36(seed) : Math.random().toString(36).slice(2, 11);

/**
 * Convert a File or Blob to a base64 string
 * @param file - The File or Blob to convert
 * @returns A promise that resolves to the base64 string
 */
export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert File to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Validate a file or base64 string and add to appropriate array
 * @param input - The file or base64 string to validate
 * @param options - Validation options
 * @param originalFile - The original file input
 * @param validFiles - Array to add valid files to
 * @param errors - Array to add errors to
 * @internal
 */
const validateFileOrBase64 = <T extends FileInput>(
  input: File | string,
  options: FileValidationOptions,
  originalFile: T,
  validFiles: T[],
  errors: FileError[]
): void => {
  const { isValidType, isValidSize } = checkTypeAndSize(input, options);

  if (isValidType && isValidSize) {
    validFiles.push(originalFile);
  } else {
    if (!isValidType) errors.push({ file: input, reason: 'type' });
    if (!isValidSize) errors.push({ file: input, reason: 'size' });
  }
};

/**
 * Check if a file meets type and size requirements
 * @param input - The file or base64 string to check
 * @param options - Validation options with allowedMimeTypes and maxFileSize
 * @returns Object containing isValidType and isValidSize flags
 * @internal
 */
const checkTypeAndSize = (
  input: File | string,
  { allowedMimeTypes, maxFileSize }: FileValidationOptions
): { isValidType: boolean; isValidSize: boolean } => {
  const mimeType = input instanceof File ? input.type : base64MimeType(input);
  const size = input instanceof File ? input.size : atob(input.split(',')[1]).length;

  const isValidType =
    allowedMimeTypes.length === 0 ||
    allowedMimeTypes.includes(mimeType) ||
    allowedMimeTypes.includes(`${mimeType.split('/')[0]}/*`);

  const isValidSize = !maxFileSize || size <= maxFileSize;

  return { isValidType, isValidSize };
};

/**
 * Extract MIME type from a base64-encoded string
 * @param encoded - The base64-encoded string
 * @returns The MIME type or 'unknown'
 * @internal
 */
const base64MimeType = (encoded: string): string => {
  const result = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
  return result && result.length > 1 ? result[1] : 'unknown';
};

/**
 * Check if a string is valid base64
 * @param str - The string to check
 * @returns True if the string is valid base64, false otherwise
 * @internal
 */
const isBase64 = (str: string): boolean => {
  if (str.startsWith('data:')) {
    const matches = str.match(/^data:[^;]+;base64,(.+)$/);
    if (matches && matches[1]) {
      str = matches[1];
    } else {
      return false;
    }
  }

  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
};

/**
 * Filter and validate an array of files
 * @param files - Array of files or file-like objects to validate
 * @param options - Validation options
 * @returns A tuple of [validFiles, errors]
 */
export const filterFiles = <T extends FileInput>(
  files: T[],
  options: FileValidationOptions
): [T[], FileError[]] => {
  const validFiles: T[] = [];
  const errors: FileError[] = [];

  files.forEach((file) => {
    const actualFile = 'src' in file ? file.src : file;

    if (actualFile instanceof File) {
      validateFileOrBase64(actualFile, options, file, validFiles, errors);
    } else if (typeof actualFile === 'string') {
      if (isBase64(actualFile)) {
        if (options.allowBase64) {
          validateFileOrBase64(actualFile, options, file, validFiles, errors);
        } else {
          errors.push({ file: actualFile, reason: 'base64NotAllowed' });
        }
      } else {
        if (!sanitizeUrl(actualFile, { allowBase64: options.allowBase64 })) {
          errors.push({ file: actualFile, reason: 'invalidBase64' });
        } else {
          validFiles.push(file);
        }
      }
    }
  });

  return [validFiles, errors];
};
