import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function CtaSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 md:px-6">
      <div
        className="rounded-2xl border px-8 py-14 text-center md:px-16"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
      >
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
        >
          Your coding data, on your terms
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base" style={{ color: 'var(--mkt-fg-muted)' }}>
          Deploy Azyren, generate an API key, and point your existing editor plugin at it. Ten
          minutes, no editor changes.
        </p>
        <Button
          asChild
          className="mt-8 rounded-full px-8"
          size="lg"
          style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
        >
          <Link href="/docs/getting-started">
            Install Azyren
            <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
