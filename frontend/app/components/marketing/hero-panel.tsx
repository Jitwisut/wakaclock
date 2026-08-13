'use client';

import { motion } from 'motion/react';

const CONFIG_SNIPPET = `~/.wakatime.cfg

[settings]
api_url = https://api.atoaxis.com/api/v1
api_key = your_generated_api_key`;

/**
 * Decorative side panel only. The animation lives here — and deliberately not on the
 * hero heading — so the H1 and the product definition render at full opacity in the
 * server HTML instead of waiting for hydration to become visible.
 */
export function HeroPanel() {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      initial={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
    >
      <div
        className="overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-code-bg)' }}
      >
        <div
          className="flex items-center gap-1.5 border-b px-4 py-3"
          style={{ borderColor: 'rgba(148,163,184,0.15)' }}
        >
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-yellow-500/70" />
          <span className="size-2.5 rounded-full bg-green-500/70" />
          <span
            className="ml-3 text-xs"
            style={{
              color: 'rgba(148,163,184,0.7)',
              fontFamily: 'var(--font-mkt-mono), monospace',
            }}
          >
            one-time editor config
          </span>
        </div>
        <pre
          className="overflow-x-auto p-6 text-sm leading-relaxed"
          style={{ color: 'var(--mkt-code-fg)', fontFamily: 'var(--font-mkt-mono), monospace' }}
        >
          <code>{CONFIG_SNIPPET}</code>
        </pre>
      </div>
    </motion.div>
  );
}
