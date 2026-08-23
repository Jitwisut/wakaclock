import { absoluteUrl, ORGANIZATION, PRODUCT_ANSWER, SITE_NAME, SITE_URL } from './site';

/**
 * Structured-data builders.
 *
 * Deliberately absent: AggregateRating, Review, downloadCount, ratingValue. There is no
 * ratings or install-count source for this product, and fabricating one is both a schema
 * violation and a trust problem.
 */

type JsonLdValue = Record<string, unknown>;

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
    '@id': absoluteUrl('/#organization'),
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

export function websiteSchema(): JsonLdValue {
  return {
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': absoluteUrl('/#organization') },
  };
}

/**
 * The product is a hosted web service reached through editor clients, so it is described
 * as a DeveloperApplication whose `operatingSystem` covers the platforms the editor
 * clients run on. Pricing is planned during Early Access, so no Offer is emitted until
 * checkout is actually available. This keeps structured data aligned with the visible page.
 */
export function softwareApplicationSchema(): JsonLdValue {
  return {
    '@type': 'SoftwareApplication',
    '@id': absoluteUrl('/#software'),
    name: SITE_NAME,
    url: SITE_URL,
    description: PRODUCT_ANSWER,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Time tracking and developer analytics',
    operatingSystem: 'Linux, macOS, Windows',
    publisher: { '@id': absoluteUrl('/#organization') },
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
