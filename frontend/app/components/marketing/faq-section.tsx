import type { FaqEntry } from '@/lib/seo/schema';

/**
 * Renders the same `FaqEntry[]` that the page passes to `faqSchema()`, so the
 * FAQPage structured data can never describe questions the visitor cannot see.
 * Answers are plain text for exactly that reason.
 */
export function FaqSection({
  entries,
  heading = 'Frequently asked questions',
  id = 'faq',
}: {
  entries: readonly FaqEntry[];
  heading?: string;
  id?: string;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 md:px-6" id={id}>
      <h2
        className="mb-10 text-center text-3xl font-semibold tracking-tight md:text-4xl"
        style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
      >
        {heading}
      </h2>

      <dl className="space-y-6">
        {entries.map((entry) => (
          <div
            className="rounded-xl border p-6"
            key={entry.question}
            style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
          >
            <dt className="text-base font-semibold">{entry.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--mkt-fg-muted)' }}>
              {entry.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
