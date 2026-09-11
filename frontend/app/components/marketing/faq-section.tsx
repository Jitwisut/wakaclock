import type { FaqEntry } from '@/lib/seo/schema';
import type { SiteLocale } from '@/lib/seo/site';

function keyEntries(entries: readonly FaqEntry[]) {
  const occurrences = new Map<string, number>();

  return entries.map((entry) => {
    // Questions are content, not identifiers. Generic pages can intentionally repeat a
    // question when they have more FAQ slots than section headings, so disambiguate only
    // identical question/answer pairs while keeping the key stable for normal entries.
    const baseKey = `${entry.question}\u0000${entry.answer}`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);

    return {
      entry,
      key: occurrence === 0 ? baseKey : `${baseKey}\u0000${occurrence}`,
    };
  });
}

/**
 * Renders the same `FaqEntry[]` that the page passes to `faqSchema()`, so the
 * FAQPage structured data can never describe questions the visitor cannot see.
 * Answers are plain text for exactly that reason.
 */
export function FaqSection({
  entries,
  heading = 'Frequently asked questions',
  id = 'faq',
  locale = 'en',
}: {
  entries: readonly FaqEntry[];
  heading?: string;
  id?: string;
  locale?: SiteLocale;
}) {
  return (
    <section className="mkt-faq-section axis-section" id={id} lang={locale}>
      <h2
        className="mkt-reveal text-3xl font-semibold tracking-tight md:text-4xl"
        style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
      >
        {heading}
      </h2>

      <div className="axis-faq-list">
        {keyEntries(entries).map(({ entry, key }, index) => (
          <details
            className="axis-faq-row mkt-reveal"
            key={key}
            open={index === 0}
            style={{ borderColor: 'var(--mkt-border)' }}
          >
            <summary className="axis-faq-question">
              <span>{entry.question}</span>
              <span aria-hidden="true" className="axis-faq-toggle">
                +
              </span>
            </summary>
            <p
              className="axis-faq-answer text-sm leading-relaxed"
              style={{ color: 'var(--mkt-fg-muted)' }}
            >
              {entry.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
