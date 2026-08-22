import { IBM_Plex_Mono, Press_Start_2P } from 'next/font/google';

/**
 * Loaded here, scoped to the presence page only — same pattern the marketing site and
 * the dashboard's retro-pixel theme preset use for their own font sets, so this doesn't
 * add weight to every other page's bundle.
 *
 * Press Start 2P is true 8-bit bitmap type — used for the page title, room name, and a
 * few short button labels only (see `presence-theme.css`); it only ships weight 400 and
 * is unreadable as body copy at normal sizes. IBM Plex Mono carries everything else
 * (subtitle, invite URL, helper text) — still unmistakably "developer monospace" in
 * character, but legible at paragraph sizes.
 */
export const presenceHeadingFont = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-presence-heading',
});

export const presenceBodyFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-presence-body',
});
