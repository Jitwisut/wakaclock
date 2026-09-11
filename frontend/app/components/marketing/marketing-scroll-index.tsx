'use client';

import { useEffect, useRef, useState } from 'react';

import { usePathname } from 'next/navigation';

import type { SiteLocale } from '@/lib/seo/site';

/** The live index reads the actual headings, so labels cannot drift from page copy. */
export function MarketingScrollIndex({ locale }: { locale: SiteLocale }) {
  const pathname = usePathname();
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [active, setActive] = useState('');
  const panel = useRef<globalThis.HTMLDetailsElement>(null);
  const marker = useRef<globalThis.HTMLDivElement>(null);

  useEffect(() => {
    const root = marker.current?.closest('.wakaclock-marketing');
    const sections = [
      ...(root?.querySelectorAll<globalThis.HTMLElement>('main section[id]') ?? []),
    ].filter((section) => section.querySelector('h2'));
    setItems(
      sections.map((section) => ({
        id: section.id,
        title: section.querySelector('h2')?.textContent?.trim() ?? '',
      }))
    );
    if (panel.current) panel.current.open = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id ?? '';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 180) current = section.id;
      }
      setActive((previous) => (previous === current ? previous : current));
      const max = document.documentElement.scrollHeight - window.innerHeight;
      marker.current?.style.setProperty(
        '--reading-progress',
        String(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        panel.current?.open &&
        panel.current.contains(document.activeElement)
      ) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus();
      }
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('keydown', escape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('keydown', escape);
    };
  }, [pathname]);

  const current = items.findIndex((item) => item.id === active);
  return (
    <div className="axis-scroll-index" hidden={items.length < 2} ref={marker}>
      <details ref={panel}>
        <summary>
          <span aria-hidden="true" className="axis-index-orbit">
            ↗
          </span>
          <span className="axis-index-label">{locale === 'th' ? 'สารบัญ' : 'Index'}</span>
          <span className="axis-index-current">{items[current]?.title}</span>
          <span className="axis-index-count">
            {String(current + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
        </summary>
        <nav aria-label={locale === 'th' ? 'สารบัญตามการเลื่อนหน้า' : 'Reading progress index'}>
          <ol>
            {items.map((item, index) => (
              <li key={item.id}>
                <a
                  aria-current={item.id === active ? 'location' : undefined}
                  href={`#${item.id}`}
                  onClick={() => {
                    if (panel.current) panel.current.open = false;
                  }}
                >
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </details>
    </div>
  );
}
