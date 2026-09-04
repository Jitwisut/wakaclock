import type { SiteLocale } from '@/lib/seo/site';

const CONFIG_SNIPPET = `~/.wakatime.cfg

[settings]
api_url = https://api.atoaxis.com/api/v1
api_key = your_generated_api_key`;

/**
 * Decorative side panel only. Its entrance is CSS-only so this component stays on the
 * server and does not ship an animation library to the homepage.
 */
export function HeroPanel({ locale = 'en' }: { locale?: SiteLocale }) {
  return (
    <div className="mkt-hero-panel min-w-0">
      <div
        className="mkt-pixel-shadow-lg overflow-hidden border-[3px]"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-code-bg)' }}
      >
        <div
          className="flex items-center gap-1.5 border-b px-4 py-3"
          style={{ borderColor: 'rgba(148,163,184,0.15)' }}
        >
          <span className="size-2.5 bg-red-500/70" />
          <span className="size-2.5 bg-yellow-500/70" />
          <span className="size-2.5 bg-green-500/70" />
          <span
            className="ml-3 text-xs"
            style={{
              color: 'rgba(148,163,184,0.7)',
              fontFamily: 'var(--font-mkt-body), ui-monospace, monospace',
            }}
          >
            {locale === 'th' ? 'ตั้งค่า editor ครั้งเดียว' : 'one-time editor config'}
          </span>
        </div>
        <pre
          className="overflow-x-auto p-6 text-sm leading-relaxed"
          style={{
            color: 'var(--mkt-code-fg)',
            fontFamily: 'var(--font-mkt-body), ui-monospace, monospace',
          }}
        >
          <code>{CONFIG_SNIPPET}</code>
        </pre>
      </div>
    </div>
  );
}
