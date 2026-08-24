import localFont from 'next/font/local';

/**
 * Loaded here, scoped to the presence page only — same pattern the marketing site and
 * the dashboard's retro-pixel theme preset use for their own font sets, so this doesn't
 * add weight to every other page's bundle.
 *
 * The local sans/mono assets are reused here so this page does not trigger a remote font
 * fetch. Browsers fall back to a system face for scripts not covered by the bundled files.
 */
export const presenceHeadingFont = localFont({
  src: '../../public/fonts/atoaxis-sans.woff2',
  variable: '--font-presence-heading',
});

export const presenceBodyFont = localFont({
  src: '../../public/fonts/atoaxis-mono.woff2',
  variable: '--font-presence-body',
});
