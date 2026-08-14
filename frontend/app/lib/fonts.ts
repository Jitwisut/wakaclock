import {
  Geist,
  Hedvig_Letters_Serif,
  Inter,
  Kumbh_Sans,
  Montserrat,
  Outfit,
  Overpass_Mono,
  Pixelify_Sans,
  Plus_Jakarta_Sans,
  Poppins,
  PT_Sans,
  Roboto,
  Space_Mono,
} from 'next/font/google';

import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
});

const plus_jakarta_sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '800'],
  variable: '--font-plus-jakarta-sans',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-montserrat',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
});

const overpass_mono = Overpass_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-overpass-mono',
});

const ptSans = PT_Sans({
  variable: '--font-pt-sans',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const hedvig_letters_serif = Hedvig_Letters_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-hedvig-letters-serif',
});

const kumbh_sans = Kumbh_Sans({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-kumbh-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-outfit',
});

/**
 * Display face for the "Retro Pixel 3D" theme preset (`app/themes.css`) — used for
 * headings/titles/button labels via `--display-family`, the same way
 * `hedvig_letters_serif` is Underground's display face. Was Press Start 2P (true 8-bit
 * bitmap) initially; swapped to Pixelify Sans, which keeps the pixel-cut silhouette but
 * is a proper multi-weight typeface (400-700) rather than one crude blocky weight, so
 * headings actually have a bold/regular hierarchy and read as considered rather than
 * placeholder-crude.
 */
const pixelify_sans = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-pixelify-sans',
});

/**
 * Body face for the "Retro Pixel 3D" theme preset, via `--text-family`. Was
 * `overpass_mono` initially (still registered below for the pre-existing
 * `data-theme-font='overpass-mono'` option, unrelated to this preset); swapped to Space
 * Mono for more retro-terminal character while staying legible at the dashboard's dense
 * table/data density (heartbeats, insights) — the same legibility constraint that ruled
 * out Press Start 2P and VT323 for body copy in the first place.
 */
const space_mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
});

export const fontVariables = cn(
  geist.variable,
  inter.variable,
  roboto.variable,
  montserrat.variable,
  poppins.variable,
  overpass_mono.variable,
  ptSans.variable,
  plus_jakarta_sans.variable,
  hedvig_letters_serif.variable,
  kumbh_sans.variable,
  outfit.variable,
  pixelify_sans.variable,
  space_mono.variable
);
