import { describe, expect, it } from 'vitest';

import { GET as getAiTxt } from '@/app/.well-known/ai.txt/route';
import { GET as getFaq } from '@/app/ai/faq.json/route';
import { GET as getSummary } from '@/app/ai/summary.json/route';
import { GET as getFeed } from '@/app/feed.xml/route';
import { GET as getFullText } from '@/app/llms-full.txt/route';
import { EN_HOME, TH_HOME } from '@/components/marketing/marketing-copy';
import { PRODUCT_ANSWER } from '@/lib/seo/site';

describe('SEO and AI discovery routes', () => {
  it('keeps the homepage definition, limitations and bilingual FAQs in the full-text export', async () => {
    const body = await getFullText().text();
    expect(EN_HOME.whatIs[0]).toBe(PRODUCT_ANSWER);
    for (const copy of [EN_HOME, TH_HOME]) {
      expect(body).toContain(copy.heroLead);
      expect(body).toContain(copy.whatIs[0]);
      for (const limitation of copy.limitations) expect(body).toContain(limitation);
      for (const entry of copy.faq) {
        expect(body).toContain(entry.question);
        expect(body).toContain(entry.answer);
      }
    }
  });
  it('publishes a valid RSS feed with canonical item URLs', async () => {
    const response = getFeed();
    const xml = await response.text();

    expect(response.headers.get('content-type')).toContain('application/rss+xml');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<atom:link');
    expect(xml).toContain('<guid isPermaLink="true">');
  });

  it('publishes bilingual machine-readable summary and FAQ documents', async () => {
    const summary = (await getSummary().json()) as {
      languages: { en: { capabilities: string[] }; th: { limitations: string[] } };
      sourceRepository?: string;
    };
    const faq = (await getFaq().json()) as {
      languages: { en: unknown[]; th: unknown[] };
    };

    expect(summary.languages.en.capabilities.length).toBeGreaterThan(0);
    expect(summary.languages.th.limitations.length).toBeGreaterThan(0);
    expect(summary.sourceRepository).toBeUndefined();
    expect(faq.languages.en).toHaveLength(faq.languages.th.length);
  });

  it('links all machine-readable documents from ai.txt', async () => {
    const body = await getAiTxt().text();

    expect(body).toContain('/ai/summary.json');
    expect(body).toContain('/ai/faq.json');
    expect(body).toContain('/llms.txt');
  });
});
