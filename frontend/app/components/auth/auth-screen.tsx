'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthForm, type AuthMode } from '@/components/auth/auth-form';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/** Where a visitor lands when they arrive at /login directly rather than being sent there. */
const DEFAULT_DESTINATION = '/dashboard/wakaclock';

/**
 * Only same-origin paths are followed. `?next=` comes from the URL bar, so without this a
 * link to `/login?next=https://…` would turn the sign-in page into an open redirect that
 * borrows this site's credibility.
 *
 * Written as a shape that must match rather than a list of prefixes to reject: a single
 * leading slash followed by something that is neither a slash nor a backslash. Rejecting
 * `//` alone is not enough, because a URL parser normalises `\` to `/` for http(s), so
 * `/\evil.example.com` resolves protocol-relative and leaves the site.
 */
const SAME_ORIGIN_PATH = /^\/[^/\\]/;

function safeDestination(next: null | string): string {
  if (!next || !SAME_ORIGIN_PATH.test(next)) return DEFAULT_DESTINATION;

  return next;
}

const COPY = {
  login: {
    eyebrow: 'Welcome back',
    heading: 'Pick the log\nback up.',
    lede: 'Sign in to see today’s total, this month’s projects and how much of it you actually typed.',
    switchPrompt: 'No account yet?',
    switchLabel: 'Create one',
    switchHref: '/register',
  },
  register: {
    eyebrow: 'First heartbeat',
    heading: 'Start the log.',
    lede: 'A username and a password. No email, no card, and nothing that leaves your editor except metadata.',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Sign in',
    switchHref: '/login',
  },
} as const;

/**
 * A sample of what the product records, not the visitor's data — the point of the panel is
 * to show the shape of a heartbeat before you have any, so the reader can see that a file
 * path and a line count is all of it.
 */
const SAMPLE_STREAM = [
  { time: '09:14:02', entity: 'api/heartbeat.rs', meta: 'rust · main', delta: '+34 −6' },
  { time: '09:16:31', entity: 'api/heartbeat.rs', meta: 'rust · main', delta: 'ai claude-code' },
  { time: '09:21:08', entity: 'web/range-picker.tsx', meta: 'tsx · main', delta: '+12 −12' },
  { time: '09:27:55', entity: 'migrations/0007.sql', meta: 'sql · main', delta: '+8 −0' },
  { time: '09:31:40', entity: 'api/durations.rs', meta: 'rust · perf/idle', delta: '+61 −44' },
] as const;

const FACTS = [
  ['Never collected', 'File contents, prompts, AI responses'],
  ['Always kept', 'Your complete history, in the base plan'],
  ['Counted apart', 'AI lines, human keystrokes, unattributed'],
] as const;

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = safeDestination(searchParams.get('next'));
  const hydrated = useWakaclockUserStore((state) => state.hydrated);
  const userId = useWakaclockUserStore((state) => state.userId);

  // Someone who is already signed in has no business on this page; send them where they
  // were headed instead of showing a form they do not need.
  React.useEffect(() => {
    if (hydrated && userId) router.replace(destination);
  }, [destination, hydrated, router, userId]);

  const switchHref =
    destination === DEFAULT_DESTINATION
      ? copy.switchHref
      : `${copy.switchHref}?next=${encodeURIComponent(destination)}`;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <SignalPanel mode={mode} />

      <main className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Below lg the decorative panel is gone, taking the wordmark with it — and a
              sign-in page that never names the product is disorienting when you arrive
              from a link. */}
          <p
            className="auth-rise font-display mb-10 text-lg font-semibold tracking-tight lg:hidden"
            style={{ '--auth-delay': '100ms' } as React.CSSProperties}
          >
            AtoAxis
          </p>

          <p
            className="auth-rise text-muted-foreground text-xs tracking-[0.22em] uppercase"
            style={{ '--auth-delay': '160ms' } as React.CSSProperties}
          >
            {copy.eyebrow}
          </p>

          <h1
            className="auth-rise font-display mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance whitespace-pre-line sm:text-5xl"
            style={{ '--auth-delay': '220ms' } as React.CSSProperties}
          >
            {copy.heading}
          </h1>

          <p
            className="auth-rise text-muted-foreground mt-4 text-sm leading-relaxed text-pretty"
            style={{ '--auth-delay': '280ms' } as React.CSSProperties}
          >
            {copy.lede}
          </p>

          <div
            className="auth-rise mt-9"
            style={{ '--auth-delay': '340ms' } as React.CSSProperties}
          >
            <AuthForm mode={mode} onSuccess={() => router.replace(destination)} />
          </div>

          <p
            className="auth-rise text-muted-foreground mt-6 text-sm"
            style={{ '--auth-delay': '400ms' } as React.CSSProperties}
          >
            {copy.switchPrompt}{' '}
            <Link
              className="text-foreground font-medium underline underline-offset-4"
              href={switchHref}
            >
              {copy.switchLabel}
            </Link>
          </p>

          <p
            className="auth-rise text-muted-foreground mt-10 text-xs"
            style={{ '--auth-delay': '460ms' } as React.CSSProperties}
          >
            <Link className="underline underline-offset-4" href="/">
              Back to atoaxis.com
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * The left half. It is `bg-primary`, which is the one colour every preset defines as its
 * signature, so this panel is what makes Nord look like Nord and Gruvbox look like Gruvbox
 * without a single hardcoded value.
 */
function SignalPanel({ mode }: { mode: AuthMode }) {
  return (
    <aside
      aria-labelledby="auth-panel-heading"
      className="bg-primary text-primary-foreground relative isolate hidden flex-col justify-between overflow-hidden px-12 py-14 lg:flex"
    >
      <div className="auth-grid pointer-events-none absolute inset-0 -z-10" />

      <div className="auth-rise" style={{ '--auth-delay': '80ms' } as React.CSSProperties}>
        <p className="font-display text-lg font-semibold tracking-tight" id="auth-panel-heading">
          AtoAxis
        </p>
        <p className="mt-1 text-xs tracking-[0.18em] uppercase opacity-70">
          Developer time tracking
        </p>
      </div>

      <div>
        <p
          className="auth-rise text-xs tracking-[0.18em] uppercase opacity-70"
          style={{ '--auth-delay': '200ms' } as React.CSSProperties}
        >
          Sample stream
        </p>

        {/*
          The rows are an illustration of the heartbeat shape, not anyone's data, so they
          are hidden from assistive technology — read out, five rows of timestamps and file
          paths would be noise ahead of the form. The heading above them stays visible in
          the accessibility tree so the panel is still labelled.
        */}
        <ul aria-hidden className="mt-4 space-y-1.5 font-mono text-[0.8rem] leading-relaxed">
          {SAMPLE_STREAM.map((row, index) => (
            <li
              className="auth-rise flex flex-wrap items-baseline gap-x-3"
              key={row.time}
              style={{ '--auth-delay': `${260 + index * 70}ms` } as React.CSSProperties}
            >
              <span className="opacity-60">{row.time}</span>
              <span className="font-medium">{row.entity}</span>
              <span className="opacity-60">{row.meta}</span>
              <span className="ml-auto opacity-80">{row.delta}</span>
            </li>
          ))}
          <li
            className="auth-rise flex items-baseline gap-x-3"
            style={{ '--auth-delay': '640ms' } as React.CSSProperties}
          >
            <span className="opacity-60">{mode === 'register' ? '—:—:—' : '09:34:12'}</span>
            <span className="auth-caret inline-block h-4 w-2 translate-y-0.5 bg-current" />
          </li>
        </ul>
      </div>

      <dl
        className="auth-rise grid gap-5 border-t pt-8 text-sm sm:grid-cols-3"
        style={
          {
            '--auth-delay': '720ms',
            borderColor: 'color-mix(in oklab, currentColor 28%, transparent)',
          } as React.CSSProperties
        }
      >
        {FACTS.map(([term, description]) => (
          <div key={term}>
            <dt className="text-xs tracking-[0.14em] uppercase opacity-70">{term}</dt>
            <dd className="mt-1.5 leading-snug">{description}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
