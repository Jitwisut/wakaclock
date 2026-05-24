import { useRef, useCallback } from 'react';

/**
 * Options for configuring the useThrottle hook.
 */
export interface UseThrottleOptions {
  /** The delay in milliseconds between throttled calls */
  delay: number;
}

/**
 * Return type of the useThrottle hook.
 * A throttled function with the same signature as the input callback.
 *
 * @typeParam T - The type of the callback function being throttled
 */
export type UseThrottleReturn<T extends (...args: never[]) => void> = (
  ...args: Parameters<T>
) => void;

/**
 * Creates a throttled version of a callback function.
 *
 * Limits how often the callback can be invoked. If called again before the delay
 * has passed, the call is queued and executed after the remaining delay time.
 * This ensures the callback is called at most once per delay period while still
 * guaranteeing the latest call is eventually executed.
 *
 * @typeParam T - The type of the callback function to throttle
 * @param callback - The function to throttle
 * @param delay - The minimum time in milliseconds between callback invocations
 * @returns A throttled version of the callback function
 *
 * @example
 * ```tsx
 * const throttledSave = useThrottle((value: string) => {
 *   saveToServer(value);
 * }, 1000);
 *
 * // Can be called rapidly, but saveToServer runs at most once per second
 * throttledSave(inputValue);
 * ```
 */
export function useThrottle<T extends (...args: never[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const handler = () => {
        if (Date.now() - lastRan.current >= delay) {
          callback(...args);
          lastRan.current = Date.now();
        } else {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(
            () => {
              callback(...args);
              lastRan.current = Date.now();
            },
            delay - (Date.now() - lastRan.current)
          );
        }
      };

      handler();
    },
    [callback, delay]
  );
}
