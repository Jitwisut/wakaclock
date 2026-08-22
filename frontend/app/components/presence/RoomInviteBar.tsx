'use client';

import * as React from 'react';

import { CheckIcon, CopyIcon, LinkIcon } from 'lucide-react';

const COPIED_RESET_MS = 1800;

export function RoomInviteBar({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<null | ReturnType<typeof setTimeout>>(null);

  React.useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the URL is still
      // selectable text in the input below, so there's a fallback even if this throws.
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div
        className="flex h-11 min-w-0 flex-1 items-center gap-2 border-2 px-3"
        style={{ background: 'var(--presence-panel)', borderColor: 'var(--presence-border)' }}
      >
        <LinkIcon aria-hidden className="size-4 shrink-0" style={{ color: 'var(--presence-text-muted)' }} />
        <input
          aria-label="Room invite link"
          className="w-full truncate bg-transparent text-xs outline-none"
          readOnly
          style={{ fontFamily: 'var(--font-presence-body)' }}
          value={url}
        />
      </div>
      <button
        aria-label={copied ? 'Link copied' : 'Copy invite link'}
        className="presence-pixel-shadow-sm presence-pixel-press flex h-11 shrink-0 items-center justify-center gap-1.5 border-2 px-4 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        onClick={() => void handleCopy()}
        style={{ background: 'var(--presence-danger)', borderColor: 'var(--presence-border)' }}
        type="button"
      >
        {copied ? (
          <>
            <CheckIcon aria-hidden className="size-4" />
            Copied!
          </>
        ) : (
          <>
            <CopyIcon aria-hidden className="size-4" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
