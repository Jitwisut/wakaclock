'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Submit control for the plain HTML forms on this site (they POST to a form backend and
 * navigate, so there is no server action and therefore no `useFormStatus` to read).
 *
 * The pending flag is driven by the form's own `submit` event rather than a click
 * handler: `submit` fires only after native constraint validation passes, so a form
 * rejected for a missing email never leaves a permanently disabled button behind. Once
 * pending, the button is disabled — which also prevents the double submission a visitor
 * produces when nothing visibly happens after the first click.
 */
export function FormSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return undefined;

    const onSubmit = () => setPending(true);
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, []);

  return (
    <button
      aria-busy={pending}
      className="mkt-pixel-press mkt-pixel-shadow min-h-11 w-full cursor-pointer border-2 px-6 py-3 text-sm font-bold disabled:cursor-progress disabled:opacity-70"
      disabled={pending}
      ref={ref}
      style={{
        background: 'var(--mkt-accent)',
        borderColor: 'var(--mkt-border)',
        color: 'var(--mkt-accent-fg)',
      }}
      type="submit"
    >
      {pending ? pendingLabel : label}
      {pending ? (
        <span aria-hidden className="mkt-blink ml-2 inline-block size-2 bg-current" />
      ) : null}
    </button>
  );
}
