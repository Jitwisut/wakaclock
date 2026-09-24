'use client';

import type { SiteLocale } from '@/lib/seo/site';

import { ATTRIBUTION_KINDS, type AttributionKind, EXPERIENCE_COPY } from './experience-copy';
import { DEMO_SUMMARY, formatMinutes } from './experience-data';
import { setUi, useExperienceUi } from './experience-store';

const KIND_INDEX = { human: 0, ai: 1, unattributed: 2 } as const;

/**
 * The Human + AI controls. Hover or focus previews a category in the scene; selecting one
 * holds the focus. The panel is the accessible alternative to the 3D view: it states in
 * words what the highlighted marks mean, and the share bar shows the same demo split.
 */
export function AttributionExplorer({ locale }: { locale: SiteLocale }) {
  const copy = EXPERIENCE_COPY[locale].humanAi;
  const demo = EXPERIENCE_COPY[locale].demoBadge;
  const focus = useExperienceUi((state) => state.focus);
  const hover = useExperienceUi((state) => state.hoverKind);
  const shown: AttributionKind = hover ?? focus;
  const detail = copy.kinds[shown];
  const total = DEMO_SUMMARY.totalMin;

  return (
    <div className="axx-attribution" data-focus={shown}>
      <div aria-label={copy.controlsLabel} className="axx-attribution-controls" role="group">
        {ATTRIBUTION_KINDS.map((kind) => (
          <button
            aria-pressed={focus === kind}
            data-cursor={copy.kinds[kind].pattern}
            data-kind={kind}
            data-magnetic
            key={kind}
            onBlur={() => setUi({ hoverKind: null })}
            onClick={() => setUi({ focus: kind })}
            onFocus={() => setUi({ hoverKind: kind })}
            onPointerEnter={() => setUi({ hoverKind: kind })}
            onPointerLeave={() => setUi({ hoverKind: null })}
            type="button"
          >
            <i aria-hidden="true" data-kind={kind} />
            {copy.kinds[kind].label}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="axx-attribution-detail">
        <h3>{detail.title}</h3>
        <p>{detail.body}</p>
      </div>
      <figure className="axx-share">
        <div aria-hidden="true" className="axx-share-bar">
          {(['human', 'ai', 'unattributed'] as const).map((kind) => (
            <span
              data-dim={shown !== 'all' && shown !== kind}
              data-kind={kind}
              key={kind}
              style={{ flexGrow: DEMO_SUMMARY.byKind[KIND_INDEX[kind]] }}
            />
          ))}
        </div>
        <figcaption>
          <span className="axx-demo-tag">{demo}</span>
          <span>{copy.shareLabel}:</span>
          <ul>
            {(['human', 'ai', 'unattributed'] as const).map((kind) => {
              const minutes = DEMO_SUMMARY.byKind[KIND_INDEX[kind]];
              return (
                <li data-kind={kind} key={kind}>
                  <i aria-hidden="true" data-kind={kind} />
                  {copy.kinds[kind].label} {Math.round((minutes / total) * 100)}% ·{' '}
                  {formatMinutes(minutes, locale)}
                </li>
              );
            })}
          </ul>
        </figcaption>
      </figure>
      <p className="axx-caution">{copy.caution}</p>
    </div>
  );
}
