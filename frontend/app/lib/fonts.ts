import localFont from 'next/font/local';

import { cn } from '@/lib/utils';

// Keep production builds deterministic. The bundled Geist files ship with Next.js itself,
// so they are available in a clean Netlify checkout without a Google Fonts request. Theme
// aliases in `themes.css` preserve the existing font preset API while the browser still
// falls back to a platform sans/mono face for glyphs the bundled Latin files do not contain.
const geist = localFont({
  src: '../public/fonts/atoaxis-sans.woff2',
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = localFont({
  src: '../public/fonts/atoaxis-mono.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
});

/*
 * Cinema preset faces (see public/fonts/README.md). Only the text face is preloaded:
 * it carries every paragraph and control, while display, serif and mono appear in
 * headings and labels where a swap is barely visible.
 *
 * IBM Plex Sans Thai is two families because `next/font/local` cannot scope a file with
 * `unicode-range`. The text stack in `themes.css` lists Latin first, then Thai, so the
 * browser picks the Thai file per glyph.
 */
const cinemaDisplay = localFont({
  src: '../public/fonts/cinema-display.woff2',
  variable: '--font-cinema-display',
  weight: '300 700',
  display: 'swap',
  preload: false,
});

const cinemaSerif = localFont({
  src: [
    { path: '../public/fonts/cinema-serif.woff2', style: 'normal', weight: '400' },
    { path: '../public/fonts/cinema-serif-italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--font-cinema-serif',
  display: 'swap',
  preload: false,
});

const cinemaMono = localFont({
  src: [
    { path: '../public/fonts/cinema-mono-400.woff2', weight: '400' },
    { path: '../public/fonts/cinema-mono-500.woff2', weight: '500' },
  ],
  variable: '--font-cinema-mono',
  display: 'swap',
  preload: false,
});

const cinemaTextLatin = localFont({
  src: [
    { path: '../public/fonts/cinema-text-latin-400.woff2', weight: '400' },
    { path: '../public/fonts/cinema-text-latin-500.woff2', weight: '500' },
    { path: '../public/fonts/cinema-text-latin-600.woff2', weight: '600' },
  ],
  variable: '--font-cinema-text',
  display: 'swap',
});

const cinemaTextThai = localFont({
  src: [
    { path: '../public/fonts/cinema-text-thai-400.woff2', weight: '400' },
    { path: '../public/fonts/cinema-text-thai-500.woff2', weight: '500' },
    { path: '../public/fonts/cinema-text-thai-600.woff2', weight: '600' },
  ],
  variable: '--font-cinema-thai',
  display: 'swap',
  preload: false,
});

export const fontVariables = cn(
  geist.variable,
  geistMono.variable,
  cinemaDisplay.variable,
  cinemaSerif.variable,
  cinemaMono.variable,
  cinemaTextLatin.variable,
  cinemaTextThai.variable
);
