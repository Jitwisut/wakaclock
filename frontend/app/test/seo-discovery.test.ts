import { describe, expect, it } from 'vitest';

import { GET as getAiTxt } from '@/app/.well-known/ai.txt/route';
import { GET as getFaq } from '@/app/ai/faq.json/route';
import { GET as getSummary } from '@/app/ai/summary.json/route';
import { GET as getFeed } from '@/app/feed.xml/route';

describe('SEO and AI discovery routes', () => {
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
      sourceRepository: string;
    };
    const faq = (await getFaq().json()) as {
      languages: { en: unknown[]; th: unknown[] };
    };

    expect(summary.languages.en.capabilities.length).toBeGreaterThan(0);
    expect(summary.languages.th.limitations.length).toBeGreaterThan(0);
    expect(summary.sourceRepository).toContain('github.com/');
    expect(faq.languages.en).toHaveLength(faq.languages.th.length);
  });

  it('links all machine-readable documents from ai.txt', async () => {
    const body = await getAiTxt().text();

    expect(body).toContain('/ai/summary.json');
    expect(body).toContain('/ai/faq.json');
    expect(body).toContain('/llms.txt');
  });
});
