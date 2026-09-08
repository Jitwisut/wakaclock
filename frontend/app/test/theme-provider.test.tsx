import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from 'next-themes';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/theme-provider';

function Toggle() {
  const { setTheme } = useTheme();
  return <button onClick={() => setTheme('light')}>Light</button>;
}

afterEach(() => {
  localStorage.removeItem('theme');
  document.documentElement.classList.remove('dark', 'light');
});

describe('ThemeProvider bootstrap', () => {
  it('retains an executable bootstrap in server HTML', () => {
    const html = renderToString(
      <ThemeProvider>
        <span>Page</span>
      </ThemeProvider>
    );
    expect(html).toContain('<script');
    expect(html).toContain('localStorage');
    expect(html).not.toContain('application/x-next-themes-bootstrap');
  });

  it('uses an inert bootstrap on client mount while restoring and switching themes', () => {
    localStorage.setItem('theme', 'dark');
    const { container } = render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <Toggle />
      </ThemeProvider>
    );
    expect(container.querySelector('script')).toHaveAttribute(
      'type',
      'application/x-next-themes-bootstrap'
    );
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveClass('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
