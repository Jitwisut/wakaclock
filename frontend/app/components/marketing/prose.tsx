import Link from 'next/link';

import type { BreadcrumbEntry } from '@/lib/seo/schema';
import type { SiteLocale } from '@/lib/seo/site';

/** Muted body-text colour, shared so the token string is declared once. */
export const MUTED_TEXT = { color: 'var(--mkt-fg-muted)' } as const;

/** Shared layout primitives for the content-heavy marketing and docs pages. */

export function PageShell({
  children,
  variant = 'editorial',
}: {
  children: React.ReactNode;
  variant?: 'editorial' | 'product' | 'utility';
}) {
  return <div className={`mkt-page-shell mkt-page-${variant}`}>{children}</div>;
}

/**
 * Visible breadcrumb trail. Pages that render this should pass the same entries to
 * `breadcrumbSchema()` so the markup and the structured data agree.
 */
export function Breadcrumbs({
  entries,
  locale = 'en',
}: {
  entries: readonly BreadcrumbEntry[];
  locale?: SiteLocale;
}) {
  return (
    <nav aria-label={locale === 'th' ? 'เส้นทาง' : 'Breadcrumb'} className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;

          return (
            <li className="flex items-center gap-2" key={entry.path}>
              {isLast ? (
                <span aria-current="page" style={MUTED_TEXT}>
                  {entry.name}
                </span>
              ) : (
                <Link className="underline underline-offset-4" href={entry.path}>
                  {entry.name}
                </Link>
              )}
              {isLast ? null : (
                <span aria-hidden style={MUTED_TEXT}>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="axis-page-title"
      style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
    >
      {children}
    </h1>
  );
}

/**
 * The 40–80 word definitional paragraph placed directly under an H1 or H2. Styled
 * larger than body text because it is the passage most likely to be quoted.
 */
export function LeadAnswer({ children }: { children: React.ReactNode }) {
  return (
    <p className="axis-page-lead" style={MUTED_TEXT}>
      {children}
    </p>
  );
}

export function Section({
  children,
  heading,
  id,
  reveal = true,
}: {
  children: React.ReactNode;
  heading: string;
  id?: string;
  /**
   * Set false for a passage whose visibility must not depend on scroll position at all —
   * the definitional answer under an H1 is the paragraph answer engines lift, and it
   * should never be sitting at the start of a reveal when something reads the page.
   */
  reveal?: boolean;
}) {
  return (
    <section
      className={reveal ? 'mkt-content-section mkt-reveal mt-14' : 'mkt-content-section mt-14'}
      id={id}
    >
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{heading}</h2>
      <div className="axis-chapter-copy space-y-4 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 text-base font-semibold">{children}</h3>;
}

export function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm" style={MUTED_TEXT}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Escapes only what HTML text requires. React's own escaping also turns every `"` and `'`
 * into `&quot;` / `&#x27;`, which is valid but makes JSON and shell samples read as runs of
 * the word "quot" to any crawler that does not decode entities.
 */
function escapeCode(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <figure
      className="mkt-pixel-shadow mkt-scanlines overflow-hidden border-[3px]"
      style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-code-bg)' }}
    >
      {label ? (
        <figcaption
          className="border-b px-4 py-2 text-xs"
          style={{
            borderColor: 'rgba(148,163,184,0.15)',
            color: 'rgba(148,163,184,0.75)',
            fontFamily: 'var(--font-mkt-body), ui-monospace, monospace',
          }}
        >
          {label}
        </figcaption>
      ) : null}
      <pre
        className="overflow-x-auto p-5 text-sm leading-relaxed"
        style={{
          color: 'var(--mkt-code-fg)',
          fontFamily: 'var(--font-mkt-body), ui-monospace, monospace',
        }}
      >
        {/* Escaped by escapeCode above; the sample text is static copy, never user input. */}
        {/* eslint-disable-next-line react/no-danger */}
        <code dangerouslySetInnerHTML={{ __html: escapeCode(children) }} />
      </pre>
    </figure>
  );
}

/**
 * Contextual outbound links placed at the end of a page. Anchor text is the
 * destination's actual subject rather than "read more", so both readers and
 * crawlers get a meaningful signal about what is being linked.
 */
export function RelatedLinks({
  links,
  heading = 'Related pages',
}: {
  heading?: string;
  links: readonly { description: string; href: string; label: string }[];
}) {
  return (
    <section
      className="mkt-related mt-16 border-t pt-8"
      style={{ borderColor: 'var(--mkt-border)' }}
    >
      <h2 className="text-base font-semibold">{heading}</h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              className="axis-related-link"
              href={link.href}
              style={{ borderColor: 'var(--mkt-border)' }}
            >
              <span className="text-sm font-semibold underline underline-offset-4">
                {link.label}
              </span>
              <span className="mt-1 block text-xs" style={MUTED_TEXT}>
                {link.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
