import type { ReactNode } from 'react';

import { fontVariables } from '@/lib/fonts';

import type { Viewport } from 'next';

import './time.css';

export const timeViewport: Viewport = { themeColor: '#07110d', colorScheme: 'dark' };

export function TimeDocument({ children, lang }: { children: ReactNode; lang: 'en' | 'th' }) {
  return (
    <html className={fontVariables} lang={lang}>
      <body className="tx-body">{children}</body>
    </html>
  );
}
