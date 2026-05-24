import * as React from 'react';

/**
 * Return type of the useTheme hook.
 * Boolean indicating whether dark mode is currently active.
 */
export type UseThemeReturn = boolean;

/**
 * Detects the current theme mode (light or dark) from the document.
 *
 * Monitors the document's root element class list for 'dark' class and
 * the system's prefers-color-scheme media query to determine the current
 * theme. Automatically updates when the theme changes.
 *
 * @returns `true` if dark mode is active, `false` otherwise
 *
 * @example
 * ```tsx
 * const isDarkMode = useTheme();
 * const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
 * ```
 */
export const useTheme = (): UseThemeReturn => {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const getIsDark = () => root.classList.contains('dark') || darkModeMediaQuery.matches;

    setIsDarkMode(getIsDark());

    const handleChange = (e: MediaQueryListEvent) => {
      const newDarkMode = e.matches;
      setIsDarkMode(root.classList.contains('dark') || newDarkMode);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);

    const observer = new MutationObserver(() => {
      setIsDarkMode(getIsDark());
    });

    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      darkModeMediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isDarkMode;
};

export default useTheme;
