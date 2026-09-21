import {
  MARKETING_PAGE_KEYS,
  type MarketingBlock,
  PAGE_COPY,
} from '@/components/marketing/marketing-copy';
import {
  absoluteUrl,
  localizedPath,
  ORGANIZATION,
  PRODUCT_ANSWER,
  PRODUCT_STATUS,
  SITE_NAME,
  type SiteLocale,
} from '@/lib/seo/site';

/**
 * /llms-full.txt — the full text of every public page, for answer engines.
 *
 * `llms.txt` is a map: it tells a model which pages exist and what each one is about, and
 * a model still has to fetch a page to answer from it. This is the other half — the
 * actual prose, in one request, so an engine that will not crawl seventeen URLs can still
 * answer from the real wording instead of guessing from a title.
 *
 * It is generated from `PAGE_COPY`, the same source the pages render from, because a
 * hand-maintained copy of a site's text is a copy that goes stale and then gets quoted
 * anyway. Rewording a page rewords this file in the same commit.
 */

export const dynamic = 'force-static';

function renderBlock(block: MarketingBlock): string {
  switch (block.kind) {
    case 'paragraph': {
      return block.text;
    }
    case 'bullets': {
      return block.items.map((item) => `- ${item}`).join('\n');
    }
    case 'subheading': {
      return `#### ${block.text}`;
    }
    case 'code': {
      const label = block.label ? `${block.label}:` : '';
      return [label, '```', block.value, '```'].filter(Boolean).join('\n');
    }
    case 'email': {
      return `${block.before}${ORGANIZATION.email}${block.after ?? ''}`;
    }
    default: {
      return '';
    }
  }
}

function renderPage(path: string, locale: SiteLocale): string {
  const copy = PAGE_COPY[path as (typeof MARKETING_PAGE_KEYS)[number]]?.[locale];
  if (!copy) return '';

  const sections = copy.sections
    .map(
      (section) =>
        `### ${section.heading}\n\n${section.blocks
          .map((block) => renderBlock(block))
          .filter(Boolean)
          .join('\n\n')}`
    )
    .join('\n\n');

  // The FAQ is emitted as plain question/answer pairs rather than as prose. An answer
  // engine matching a user's question against this file is doing string similarity, and
  // a question phrased as a question is what it is trying to match.
  const faq = copy.faq
    ? `\n\n### ${copy.faq.heading}\n\n${copy.faq.entries
        .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
        .join('\n\n')}`
    : '';

  const translatedUrl = absoluteUrl(localizedPath(locale === 'en' ? 'th' : 'en', path));

  return `## ${copy.title}\n\nURL: ${absoluteUrl(localizedPath(locale, path))}\nLanguage: ${locale}\nTranslation: ${translatedUrl}\n\n${copy.lead}\n\n${sections}${faq}`;
}

const BODY = `# ${SITE_NAME} — full text

> ${PRODUCT_ANSWER}

${SITE_NAME} is a commercial, proprietary product developed by team Atoaxis.
It is a hosted service currently in ${PRODUCT_STATUS.en.label}. ${PRODUCT_STATUS.en.signup} Customers do not deploy or maintain its infrastructure.

Every page below is also published in Thai under /th with the same content, and each page
is self-canonical with hreflang between the two. Capability claims on this site are held to
what the shipped code does: planned work is labelled as in development and is never stated
as a current capability. Figures that cannot be derived — AI token totals and estimated
cost without provider-reported usage and a known price — are reported as unknown with a
coverage percentage rather than as zero.

${MARKETING_PAGE_KEYS.flatMap((path) => [renderPage(path, 'en'), renderPage(path, 'th')])
  .filter(Boolean)
  .join('\n\n---\n\n')}
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
