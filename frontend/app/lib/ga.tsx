'use client';

import { useEffect, useState } from 'react';

import { usePathname } from 'next/navigation';

import type { SiteLocale } from './seo/site';

const CONSENT_STORAGE_KEY = 'atoaxis-analytics-consent';

const COPY = {
  en: {
    accept: 'Allow analytics',
    decline: 'Decline',
    description: 'Allow privacy-conscious analytics to help us improve the public site.',
    heading: 'Privacy choices',
  },
  th: {
    accept: 'อนุญาต analytics',
    decline: 'ไม่อนุญาต',
    description: 'อนุญาต analytics ที่คำนึงถึงความเป็นส่วนตัวเพื่อช่วยปรับปรุงเว็บไซต์',
    heading: 'ตัวเลือกความเป็นส่วนตัว',
  },
} as const;

type ConsentState = 'denied' | 'granted' | 'unknown';

export default function GoogleAnalyticsInit({ locale = 'en' }: { locale?: SiteLocale }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('unknown');
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);

    if (stored === 'granted' || stored === 'denied') {
      setConsent(stored);
    }
  }, []);

  useEffect(() => {
    if (!measurementId || consent !== 'granted') {
      return;
    }

    void import('react-ga4').then(({ default: reactGa }) => {
      if (!reactGa.isInitialized) {
        reactGa.initialize(measurementId);
      }

      return reactGa.send({ hitType: 'pageview', page: pathname });
    });
  }, [consent, measurementId, pathname]);

  if (!measurementId || consent !== 'unknown') {
    return null;
  }

  const copy = COPY[locale];

  const updateConsent = (value: Exclude<ConsentState, 'unknown'>) => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    setConsent(value);
  };

  return (
    <aside
      aria-label={copy.heading}
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl rounded-2xl border p-5 shadow-lg backdrop-blur-lg"
      role="dialog"
      style={{
        background: 'color-mix(in oklab, var(--mkt-bg-elevated) 94%, transparent)',
        borderColor: 'var(--mkt-border)',
      }}
    >
      <h2 className="text-sm font-semibold">{copy.heading}</h2>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--mkt-fg-muted)' }}>
        {copy.description}
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          className="rounded-full border px-4 py-2 text-xs font-semibold"
          onClick={() => updateConsent('denied')}
          style={{ borderColor: 'var(--mkt-border)' }}
          type="button"
        >
          {copy.decline}
        </button>
        <button
          className="rounded-full px-4 py-2 text-xs font-semibold"
          onClick={() => updateConsent('granted')}
          style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
          type="button"
        >
          {copy.accept}
        </button>
      </div>
    </aside>
  );
}
