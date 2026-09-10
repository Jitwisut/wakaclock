import {
  absoluteUrl,
  localizedPath,
  ORGANIZATION,
  PRODUCT_ANSWER,
  SITE_MODIFIED,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  type SiteLocale,
  SOURCE_REPOSITORY_URL,
} from './site';

/**
 * Structured-data builders.
 *
 * Deliberately absent: AggregateRating, Review, downloadCount, ratingValue. There is no
 * ratings or install-count source for this product, and fabricating one is both a schema
 * violation and a trust problem.
 */

type JsonLdValue = Record<string, unknown>;
const ORGANIZATION_ID = absoluteUrl('/#organization');

export interface FaqEntry {
  answer: string;
  question: string;
}

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function organizationSchema(): JsonLdValue {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    // The company is known publicly by the product it ships. `alternateName` lets a
    // search engine resolve the brand query "AtoAxis" to this entity even though the
    // registered `name` is the legal one.
    alternateName: SITE_NAME,
    description: `Publisher of ${SITE_NAME}, a hosted developer time-tracking service compatible with the WakaTime API.`,
    email: `mailto:${ORGANIZATION.email}`,
    legalName: ORGANIZATION.legalName,
    logo: ORGANIZATION.logo,
    name: ORGANIZATION.name,
    url: ORGANIZATION.url,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: ORGANIZATION.email,
      url: absoluteUrl('/contact'),
    },
  };
}

/**
 * The site is written and maintained by the company, not by individual bylined authors,
 * so `author` points at the Organization entity rather than a Person. Schema.org permits
 * either, and naming a person who does not actually write these pages would be a
 * fabricated credential — the same reason there is no `Review` or `aggregateRating` here.
 */
export function websiteSchema(): JsonLdValue {
  return {
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: ['en', 'th'],
    dateModified: SITE_MODIFIED,
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

/**
 * The product is a hosted web service reached through editor clients, so it is described
 * as a DeveloperApplication whose `operatingSystem` covers the platforms the editor
 * clients run on. Pricing is planned during Early Access, so no Offer is emitted until
 * checkout is actually available. This keeps structured data aligned with the visible page.
 *
 * `disambiguatingDescription` and `featureList` exist for one reason: the brand name
 * collides phonetically with unrelated products (ATOSS, Atto, Axis ERP), and a search
 * engine with no other signal will "correct" the query. Every `featureList` entry is a
 * shipped capability also stated on the site and in `/llms.txt`; nothing from
 * `IN_DEVELOPMENT` belongs here.
 */
export function softwareApplicationSchema(): JsonLdValue {
  return {
    '@type': 'SoftwareApplication',
    '@id': absoluteUrl('/#software'),
    name: SITE_NAME,
    alternateName: `${SITE_NAME} developer time tracking`,
    url: SITE_URL,
    description: PRODUCT_ANSWER,
    disambiguatingDescription: `${SITE_NAME} is a hosted developer time-tracking service compatible with the WakaTime API. It is unrelated to similarly named products such as ATOSS, Atto or Axis ERP.`,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Time tracking and developer analytics',
    codeRepository: SOURCE_REPOSITORY_URL,
    operatingSystem: 'Linux, macOS, Windows',
    sameAs: [SOURCE_REPOSITORY_URL],
    slogan: SITE_TAGLINE,
    dateModified: SITE_MODIFIED,
    author: { '@id': ORGANIZATION_ID },
    featureList: [
      'Coding time tracking derived from editor heartbeats',
      'Breakdown by project, programming language, editor, branch and operating system',
      'Complete coding history on every account, not a limited recent window',
      'AI, human and Unattributed line attribution with reported coverage',
      'Per-agent AI provenance with bundled hooks for Claude Code, Codex CLI and Gemini CLI',
      'Estimated AI token cost per project from versioned effective prices',
      'WakaTime API compatibility and WakaTime data-export import',
    ],
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface HowToStep {
  name: string;
  text: string;
}

/**
 * Ordered instructions for a task the page actually walks through.
 *
 * Google retired HowTo *rich results* in 2023, so this earns no snippet there. It is
 * emitted for answer engines, which read JSON-LD to decide what a page teaches and in
 * what order — the same reason `llms.txt` exists. Like `faqSchema`, the steps must be
 * generated from the visible instructions rather than written separately, or the markup
 * starts describing a page that no longer exists.
 */
export function howToSchema({
  name,
  description,
  steps,
}: {
  description: string;
  name: string;
  steps: readonly HowToStep[];
}): JsonLdValue {
  return {
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function faqSchema(entries: readonly FaqEntry[]): JsonLdValue {
  return {
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

export function breadcrumbSchema(entries: readonly BreadcrumbEntry[]): JsonLdValue {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: absoluteUrl(entry.path),
    })),
  };
}

/**
 * Wraps one or more nodes in a single `@graph` so a page emits exactly one
 * JSON-LD block and entities can cross-reference each other by `@id`.
 */
export function graph(...nodes: JsonLdValue[]): JsonLdValue {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** Page identity and section links come from the same copy the visitor can read. */
export function webPageSchema({
  path,
  locale,
  name,
  description,
  sections = [],
}: {
  description: string;
  locale: SiteLocale;
  name: string;
  path: string;
  sections?: readonly { id: string; name: string }[];
}): JsonLdValue {
  const url = absoluteUrl(localizedPath(locale, path));
  const pageTypes: Record<string, string> = { '/about': 'AboutPage', '/contact': 'ContactPage' };
  const pageType = pageTypes[path] ?? 'WebPage';
  return {
    '@type': pageType,
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: locale === 'th' ? 'th-TH' : 'en',
    isPartOf: { '@id': absoluteUrl('/#website') },
    publisher: { '@id': ORGANIZATION_ID },
    hasPart: sections.map((section) => ({
      '@type': 'WebPageElement',
      '@id': `${url}#${section.id}`,
      url: `${url}#${section.id}`,
      name: section.name,
    })),
  };
}
