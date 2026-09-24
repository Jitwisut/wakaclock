'use client';

import { useExperienceUi } from './experience-store';

import type { ExperienceCopyShape } from './experience-copy';

export const CHAPTER_IDS = [
  'make-work-visible',
  'every-second',
  'human-ai',
  'worked-example',
  'features',
  'get-started',
] as const;

/**
 * Scroll-aware chapter indicator. Real in-page links, so it doubles as keyboard
 * navigation between chapters; the current one is announced with aria-current.
 */
export function ChapterRail({ copy }: { copy: ExperienceCopyShape }) {
  const chapter = useExperienceUi((state) => state.chapter);
  return (
    <nav aria-label={copy.rail.label} className="axx-rail">
      <ol>
        {CHAPTER_IDS.map((id, index) => (
          <li key={id}>
            <a aria-current={chapter === index ? 'step' : undefined} data-magnetic href={`#${id}`}>
              <span aria-hidden="true" className="axx-rail-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="axx-rail-label">{copy.rail.chapters[index]}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
