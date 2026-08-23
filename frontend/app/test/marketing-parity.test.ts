import { describe, expect, it } from 'vitest';

import {
  EN_HOME,
  MARKETING_PAGE_KEYS,
  PAGE_COPY,
  TH_HOME,
} from '@/components/marketing/marketing-copy';
import { localizedPath } from '@/lib/seo/site';

describe('localized marketing contract', () => {
  it('keeps the homepage sections and FAQ inventory identical', () => {
    expect(TH_HOME.useCases).toHaveLength(EN_HOME.useCases.length);
    expect(TH_HOME.limitations).toHaveLength(EN_HOME.limitations.length);
    expect(TH_HOME.faq).toHaveLength(EN_HOME.faq.length);
  });

  it('has one typed page contract for every English and Thai route', () => {
    expect(MARKETING_PAGE_KEYS).toHaveLength(15);

    for (const path of MARKETING_PAGE_KEYS) {
      const { en, th } = PAGE_COPY[path];

      expect(en.title).toBeTruthy();
      expect(th.title).toBeTruthy();
      expect(en.sections.map((section) => section.id)).toEqual(
        th.sections.map((section) => section.id)
      );
      expect(en.sections.map((section) => section.blocks.map((block) => block.kind))).toEqual(
        th.sections.map((section) => section.blocks.map((block) => block.kind))
      );
      expect(
        en.sections.map((section) =>
          section.blocks
            .filter((block) => block.kind === 'bullets')
            .map((block) => block.items.length)
        )
      ).toEqual(
        th.sections.map((section) =>
          section.blocks
            .filter((block) => block.kind === 'bullets')
            .map((block) => block.items.length)
        )
      );
      expect(en.faq?.entries.length ?? 0).toBe(th.faq?.entries.length ?? 0);
      expect(en.related?.flatMap((group) => group.links).length ?? 0).toBe(
        th.related?.flatMap((group) => group.links).length ?? 0
      );
      expect(en.form).toBe(th.form);
      expect(JSON.stringify(en)).not.toContain('not tracked at all');
      expect(JSON.stringify(th)).not.toContain('not tracked at all');
    }
  });

  it('localizes every related and breadcrumb link without touching external URLs', () => {
    for (const path of MARKETING_PAGE_KEYS) {
      const copy = PAGE_COPY[path].th;
      for (const breadcrumb of copy.breadcrumbs) {
        expect(localizedPath('th', breadcrumb.path)).toMatch(/^\/th(?:\/|$)/);
      }
      for (const group of copy.related ?? []) {
        for (const link of group.links) {
          expect(localizedPath('th', link.href)).toMatch(/^\/th(?:\/|$)/);
        }
      }
    }
  });

  it('keeps interactive components aligned between locales', () => {
    expect(PAGE_COPY['/pricing'].en.component).toEqual({ kind: 'pricing', afterSectionId: null });
    expect(PAGE_COPY['/pricing'].th.component).toEqual({ kind: 'pricing', afterSectionId: null });
    expect(PAGE_COPY['/wakatime-alternative'].en.component).toEqual({
      kind: 'comparison',
      afterSectionId: 'comparison',
    });
    expect(PAGE_COPY['/wakatime-alternative'].th.component).toEqual({
      kind: 'comparison',
      afterSectionId: 'comparison',
    });
  });
});
