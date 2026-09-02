import type { SiteLocale } from '@/lib/seo/site';

/**
 * Real routes rather than same-page anchors, so each destination is crawlable and the
 * anchor text describes the page it points at. Shared by the header nav and the mobile
 * menu so the two can never drift apart.
 *
 * Point at section hubs (`/docs`, `/integrations`), never at a page inside them. An
 * earlier version linked `/docs/getting-started` and `/integrations/vscode` directly,
 * which left both hubs with no inbound link anywhere on the site — Google discovered
 * them from the sitemap and then declined to crawl them. The hub carries the crawl path
 * to its children; `isNavLinkActive` below already keeps the parent highlighted while a
 * child page is open.
 */
export const NAV_LINKS = [
  { href: '/wakatime-alternative', label: { en: 'vs WakaTime', th: 'เทียบกับ WakaTime' } },
  { href: '/ai-coding-tracker', label: { en: 'AI tracking', th: 'ติดตาม AI' } },
  { href: '/developer-analytics', label: { en: 'Analytics', th: 'Analytics' } },
  { href: '/teams', label: { en: 'Teams', th: 'Teams' } },
  { href: '/pricing', label: { en: 'Pricing', th: 'ราคา' } },
  { href: '/integrations', label: { en: 'Integrations', th: 'การเชื่อมต่อ' } },
  { href: '/docs', label: { en: 'Docs', th: 'เอกสาร' } },
] as const;

export const NAV_COPY = {
  en: {
    close: 'Close menu',
    cta: 'Join early access',
    loading: 'Loading page',
    login: 'Log in',
    open: 'Open menu',
    primary: 'Primary',
  },
  th: {
    close: 'ปิดเมนู',
    cta: 'เข้าร่วม Early Access',
    loading: 'กำลังเปิดหน้า',
    login: 'เข้าสู่ระบบ',
    open: 'เปิดเมนู',
    primary: 'เมนูหลัก',
  },
} as const satisfies Record<SiteLocale, Record<string, string>>;

/**
 * Whether a nav destination is the page currently being viewed.
 *
 * `pathname` arrives locale-prefixed (`/th/pricing`) while `href` is always the canonical
 * English path, so the prefix is stripped before comparing. A section parent is active for
 * its children too — `/docs` stays marked while the visitor reads `/docs/getting-started`
 * — because a nav that goes blank one level deep is worse than no indicator at all.
 */
export function isNavLinkActive(pathname: string, href: string): boolean {
  const path = pathname.replace(/^\/th(?=\/|$)/, '') || '/';

  if (href === '/') return path === '/';

  return path === href || path.startsWith(`${href}/`);
}
