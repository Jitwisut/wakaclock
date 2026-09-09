'use client';

import { ArrowUpRight, Box, Layers3 } from 'lucide-react';
import Link from 'next/link';

import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import styles from './project-studio.module.css';

export function ProjectStudio({
  data,
  name,
  filesHref,
  selectedLanguage,
  onLanguage,
}: {
  data: AnalyticsExplorerResponse;
  filesHref: string;
  name: string;
  onLanguage: (language: string) => void;
  selectedLanguage?: string;
}) {
  const languages = [...data.breakdowns.languages]
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, 6);
  const maximum = Math.max(1, ...languages.map((item) => item.total_seconds));
  const total = data.breakdowns.languages.reduce((sum, item) => sum + item.total_seconds, 0);
  return (
    <section aria-label="Project overview" className={styles.studio}>
      <div className={styles.hero}>
        <div className={styles.intro}>
          <span className={styles.kicker}>
            <Box size={14} /> PROJECT / FIELD NOTES
          </span>
          <h2>{name}</h2>
          <p>
            A closer look at what you build.
            <br />
            Your time, your tools, your momentum.
          </p>
          <Link className={styles.link} href={filesHref}>
            Explore files & branches <ArrowUpRight size={16} />
          </Link>
          <div className={styles.range}>
            {data.range.start} → {data.range.end}
            <br />
            {data.range.timezone}
          </div>
        </div>
        <div className={styles.cartridge}>
          <span className={styles.cartridgeTop}>
            ACTIVITY CARTRIDGE <Layers3 size={18} />
          </span>
          <div className={styles.display}>
            <small>TIME INVESTED</small>
            <strong>{formatDurationShort(data.summary.total_seconds)}</strong>
            <span>
              {data.summary.active_days} active days / {data.range.days_included} selected
            </span>
          </div>
          <div aria-hidden="true" className={styles.slots}>
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
      <div className={styles.metrics}>
        <div>
          <span>LANGUAGES</span>
          <strong>{data.breakdowns.languages.length}</strong>
          <small>In this selection</small>
        </div>
        <div>
          <span>DAILY AVERAGE</span>
          <strong>
            {formatDurationShort(
              data.summary.active_days ? data.summary.total_seconds / data.summary.active_days : 0
            )}
          </strong>
          <small>Per active day</small>
        </div>
        <div>
          <span>AI SHARE</span>
          <strong>
            {data.summary.ai_share_percent === null
              ? '—'
              : `${data.summary.ai_share_percent.toFixed(1)}%`}
          </strong>
          <small>Of recorded attended time</small>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.chartHeader}>
          <div>
            <span className={styles.kicker}>01 / THE BUILDING BLOCKS</span>
            <h3>Your language skyline</h3>
            <p>Top six languages by attended time. Select a tower to filter this project.</p>
          </div>
          <span className={styles.badge}>3D VIEW</span>
        </div>
        {languages.length === 0 ? (
          <p className={styles.empty}>
            No language activity in this selection. Try another date range or reset a filter.
          </p>
        ) : (
          <div className={styles.skyline}>
            {languages.map((item, index) => (
              <button
                aria-label={`${item.name}: ${formatDurationShort(item.total_seconds)}. Filter by language.`}
                aria-pressed={selectedLanguage === item.key}
                className={styles.building}
                key={item.key}
                onClick={() => onLanguage(selectedLanguage === item.key ? '' : item.key)}
                type="button"
              >
                <span className={styles.value}>{formatDurationShort(item.total_seconds)}</span>
                <span className={styles.track}>
                  <span
                    className={styles.tower}
                    data-tone={index % 3}
                    style={{ height: `${(item.total_seconds / maximum) * 100}%` }}
                  >
                    <span className={styles.windows} />
                  </span>
                </span>
                <strong title={item.name}>{item.name}</strong>
                <small>{total ? ((item.total_seconds / total) * 100).toFixed(1) : 0}%</small>
              </button>
            ))}
          </div>
        )}
        <div className={styles.footer}>
          HEIGHT = ATTENDED TIME <span>Real activity. Built one moment at a time.</span>
        </div>
      </div>
    </section>
  );
}
