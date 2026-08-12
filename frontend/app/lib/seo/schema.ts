import { absoluteUrl, ORGANIZATION, PRICING, PRODUCT_ANSWER, SITE_NAME, SITE_URL } from './site';

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
    name: ORGANIZATION.name,
    url: ORGANIZATION.url,
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
 * The product is a self-hosted server plus editor clients, so `applicationCategory`
 * is DeveloperApplication and `operatingSystem` lists only what the repository
 * actually builds for.
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
    offers: {
      '@type': 'Offer',
      price: String(PRICING.monthlyUsd),
      priceCurrency: PRICING.currency,
      url: absoluteUrl('/pricing'),
    },
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
