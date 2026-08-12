import Link from 'next/link';

import type { BreadcrumbEntry } from '@/lib/seo/schema';

/** Muted body-text colour, shared so the token string is declared once. */
export const MUTED_TEXT = { color: 'var(--mkt-fg-muted)' } as const;

/** Shared layout primitives for the content-heavy marketing and docs pages. */

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">{children}</div>;
}

/**
 * Visible breadcrumb trail. Pages that render this should pass the same entries to
 * `breadcrumbSchema()` so the markup and the structured data agree.
 */
export function Breadcrumbs({ entries }: { entries: readonly BreadcrumbEntry[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
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
      className="text-3xl font-semibold tracking-tight text-balance md:text-4xl"
      style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
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
    <p className="mt-5 text-lg leading-relaxed text-pretty" style={MUTED_TEXT}>
      {children}
    </p>
  );
}

export function Section({
  children,
  heading,
  id,
}: {
  children: React.ReactNode;
  heading: string;
  id?: string;
}) {
  return (
    <section className="mt-14" id={id}>
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{heading}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">{children}</div>
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

export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <figure
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-code-bg)' }}
    >
      {label ? (
        <figcaption
          className="border-b px-4 py-2 text-xs"
          style={{
            borderColor: 'rgba(148,163,184,0.15)',
            color: 'rgba(148,163,184,0.75)',
            fontFamily: 'var(--font-mkt-mono), monospace',
          }}
        >
          {label}
        </figcaption>
      ) : null}
      <pre
        className="overflow-x-auto p-5 text-sm leading-relaxed"
        style={{ color: 'var(--mkt-code-fg)', fontFamily: 'var(--font-mkt-mono), monospace' }}
      >
        <code>{children}</code>
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
    <section className="mt-16 border-t pt-8" style={{ borderColor: 'var(--mkt-border)' }}>
      <h2 className="text-base font-semibold">{heading}</h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link className="text-sm font-medium underline underline-offset-4" href={link.href}>
              {link.label}
            </Link>
            <span className="block text-xs" style={MUTED_TEXT}>
              {link.description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
