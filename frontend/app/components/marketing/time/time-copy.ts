import { SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { EXPERIENCE_COPY } from '../experience/experience-copy';
import { EN_HOME, TH_HOME } from '../marketing-copy';

/**
 * Copy for the /time cinematic page.
 *
 * Every product claim is imported from the audited homepage copy (`marketing-copy.ts`,
 * `experience-copy.ts`) rather than restated, so the two pages cannot drift apart. The
 * only strings written here are navigation labels and narrative framing for the time-ring
 * scene; none of them introduce a capability, a number, or a counting rule.
 */

const EN_X = EXPERIENCE_COPY.en;
const TH_X = EXPERIENCE_COPY.th;

const EN = {
  meta: {
    title: `${SITE_NAME} — ${EN_HOME.headline.join(' ')}`,
    description: EN_HOME.description,
  },
  nav: {
    label: 'Primary',
    home: 'Home',
    docs: 'Docs',
    pricing: 'Pricing',
    join: EN_X.hero.join,
    open: 'Open menu',
    close: 'Close menu',
    language: 'ภาษาไทย',
    languageLabel: 'อ่านหน้านี้เป็นภาษาไทย',
  },
  skip: 'Skip to content',
  demoBadge: EN_X.demoBadge,
  clockLabel: 'Demo day',
  clockNewDay: 'New day',
  loader: EN_X.loader,
  railLabel: 'Chapters',
  rail: ['Your time', 'Heartbeats', 'One day', 'Human + AI', 'The product', 'Begin'],
  hero: {
    eyebrow: EN_HOME.badge,
    headline: EN_HOME.headline,
    lead: EN_HOME.heroLead,
    primary: EN_X.hero.join,
    secondary: EN_X.hero.compare,
    note: EN_X.hero.earlyAccessNote,
    highlights: EN_HOME.highlights,
    highlightsLabel: EN_X.hero.highlightsLabel,
    scroll: 'Scroll to move through the day',
  },
  heartbeats: {
    kicker: '02 — Heartbeats',
    heading: EN_X.second.heading,
    body: EN_X.second.body,
    explain: EN_X.second.explain,
    toolsHeading: EN_X.second.toolsHeading,
    toolsBody: EN_X.second.toolsBody,
    toolsLabel: EN_X.second.toolsLabel,
    toolsCount: EN_X.second.toolsCount,
  },
  ring: {
    kicker: '03 — One day',
    heading: 'Every Day Becomes a Ring.',
    body: 'Twenty-four hours around one circle. Each lit arc is a stretch of coding, and the rings behind it are the days before.',
    views: [EN_X.product.views.overview, EN_X.product.views.timeline],
  },
  humanAi: {
    kicker: '04 — Human + AI',
    heading: EN_X.humanAi.heading,
    subheading: EN_X.humanAi.subheading,
    body: EN_X.humanAi.body,
    controlsLabel: EN_X.humanAi.controlsLabel,
    kinds: EN_X.humanAi.kinds,
    caution: EN_X.humanAi.caution,
  },
  product: {
    kicker: '05 — The product',
    heading: EN_X.product.heading,
    body: EN_X.product.body,
    views: [EN_X.product.views.projects, EN_X.product.views['human-ai']],
    features: EN_X.product.features.slice(0, 4),
  },
  begin: {
    kicker: '06 — Begin',
    heading: EN_X.invitation.heading,
    body: EN_X.invitation.body,
    primary: EN_X.invitation.primary,
    note: EN_X.invitation.note,
    navLabel: EN_X.invitation.navLabel,
    links: EN_X.invitation.links.filter((link) => link.href.startsWith('/')),
  },
  footer: {
    tagline: EN_HOME.tagline,
    rights: `© ${SITE_NAME}`,
  },
};

/** Literal types from `as const` copy, widened so the Thai object can be typed against it. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { [K in keyof T]: Widen<T[K]> };

type TimeCopy = Widen<typeof EN>;

const TH: TimeCopy = {
  meta: {
    title: `${SITE_NAME} — ${TH_HOME.headline.join(' ')}`,
    description: TH_HOME.description,
  },
  nav: {
    label: 'เมนูหลัก',
    home: 'หน้าแรก',
    docs: 'เอกสาร',
    pricing: 'ราคา',
    join: TH_X.hero.join,
    open: 'เปิดเมนู',
    close: 'ปิดเมนู',
    language: 'English',
    languageLabel: 'Read this page in English',
  },
  skip: 'ข้ามไปยังเนื้อหา',
  demoBadge: TH_X.demoBadge,
  clockLabel: 'วันตัวอย่าง',
  clockNewDay: 'วันใหม่',
  loader: TH_X.loader,
  railLabel: 'บท',
  rail: ['เวลาของคุณ', 'Heartbeat', 'หนึ่งวัน', 'คน + AI', 'ผลิตภัณฑ์', 'เริ่มต้น'],
  hero: {
    eyebrow: TH_HOME.badge,
    headline: TH_HOME.headline,
    lead: TH_HOME.heroLead,
    primary: TH_X.hero.join,
    secondary: TH_X.hero.compare,
    note: TH_X.hero.earlyAccessNote,
    highlights: TH_HOME.highlights,
    highlightsLabel: TH_X.hero.highlightsLabel,
    scroll: 'เลื่อนลงเพื่อเดินผ่านหนึ่งวัน',
  },
  heartbeats: {
    kicker: '02 — Heartbeat',
    heading: TH_X.second.heading,
    body: TH_X.second.body,
    explain: TH_X.second.explain,
    toolsHeading: TH_X.second.toolsHeading,
    toolsBody: TH_X.second.toolsBody,
    toolsLabel: TH_X.second.toolsLabel,
    toolsCount: TH_X.second.toolsCount,
  },
  ring: {
    kicker: '03 — หนึ่งวัน',
    heading: 'ทุกวันกลายเป็นวงแหวน',
    body: 'ยี่สิบสี่ชั่วโมงรอบวงกลมเดียว ทุกช่วงที่สว่างคือช่วงเวลาที่คุณเขียนโค้ด และวงแหวนที่อยู่ข้างหลังคือวันก่อนหน้า',
    views: [TH_X.product.views.overview, TH_X.product.views.timeline],
  },
  humanAi: {
    kicker: '04 — คน + AI',
    heading: TH_X.humanAi.heading,
    subheading: TH_X.humanAi.subheading,
    body: TH_X.humanAi.body,
    controlsLabel: TH_X.humanAi.controlsLabel,
    kinds: TH_X.humanAi.kinds,
    caution: TH_X.humanAi.caution,
  },
  product: {
    kicker: '05 — ผลิตภัณฑ์',
    heading: TH_X.product.heading,
    body: TH_X.product.body,
    views: [TH_X.product.views.projects, TH_X.product.views['human-ai']],
    features: TH_X.product.features.slice(0, 4),
  },
  begin: {
    kicker: '06 — เริ่มต้น',
    heading: TH_X.invitation.heading,
    body: TH_X.invitation.body,
    primary: TH_X.invitation.primary,
    note: TH_X.invitation.note,
    navLabel: TH_X.invitation.navLabel,
    links: TH_X.invitation.links.filter((link) => link.href.startsWith('/')),
  },
  footer: {
    tagline: TH_HOME.tagline,
    rights: `© ${SITE_NAME}`,
  },
};

export const TIME_COPY: Record<SiteLocale, TimeCopy> = { en: EN, th: TH };
export type TimeCopyShape = TimeCopy;
