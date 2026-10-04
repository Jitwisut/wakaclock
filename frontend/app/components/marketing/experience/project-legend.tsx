'use client';

import type { SiteLocale } from '@/lib/seo/site';

import { DEMO_PROJECTS, DEMO_SUMMARY, formatMinutes } from './experience-data';
import { setUi, useExperienceUi } from './experience-store';

/**
 * The spiral's legend and its keyboard/touch alternative: pointing at or focusing a
 * project lifts its stratum in the scene and dims the rest.
 */
export function ProjectLegend({ label, locale }: { label: string; locale: SiteLocale }) {
  const hovered = useExperienceUi((state) => state.hoverProject);
  return (
    <ul aria-label={label} className="axx-projects">
      {DEMO_PROJECTS.map((name, index) => (
        <li key={name}>
          <button
            aria-pressed={hovered === index}
            data-cursor={formatMinutes(DEMO_SUMMARY.byProject[index], locale)}
            onBlur={() => setUi({ hoverProject: -1 })}
            onClick={() => setUi({ hoverProject: hovered === index ? -1 : index })}
            onFocus={() => setUi({ hoverProject: index })}
            onPointerEnter={() => setUi({ hoverProject: index })}
            onPointerLeave={() => setUi({ hoverProject: -1 })}
            style={{ '--stratum': index } as React.CSSProperties}
            type="button"
          >
            <i aria-hidden="true" />
            <span>{name}</span>
            <em>{formatMinutes(DEMO_SUMMARY.byProject[index], locale)}</em>
          </button>
        </li>
      ))}
    </ul>
  );
}
