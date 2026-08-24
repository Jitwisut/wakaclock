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

export const fontVariables = cn(geist.variable, geistMono.variable);
