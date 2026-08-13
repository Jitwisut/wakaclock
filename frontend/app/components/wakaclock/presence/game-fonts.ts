import { Press_Start_2P, VT323 } from 'next/font/google';

/**
 * Loaded here, not in the root layout — scoped to the presence page only, the same way
 * the marketing site loads its own fonts in `app/(marketing)/layout.tsx` rather than
 * touching the dashboard-wide `Inter` in `lib/fonts.ts`.
 *
 * Retro-arcade pairing: Press Start 2P (true 8-bit bitmap letterforms) for headings and
 * short button labels only — it only ships weight 400 and is unreadable as body copy at
 * normal sizes. VT323 is the body face: still unmistakably a pixel/terminal font, but
 * legible at paragraph sizes, which is why `game-theme.css` sets a larger base font-size
 * for it than the dashboard's default 16px.
 */
export const gameHeadingFont = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-game-heading',
});

export const gameBodyFont = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-game-body',
});
