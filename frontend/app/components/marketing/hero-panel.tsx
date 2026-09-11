'use client';

import { useState } from 'react';

import { ArrowDownIcon, Code2Icon, RotateCcwIcon, SparklesIcon } from 'lucide-react';

import type { SiteLocale } from '@/lib/seo/site';

const MODES = ['human', 'ai', 'mixed', 'unknown'] as const;
type Mode = (typeof MODES)[number];
const SAMPLES: Record<Mode, { ai: number; human: number; unknown: number }> = {
  human: { human: 12, ai: 0, unknown: 0 },
  ai: { human: 0, ai: 12, unknown: 0 },
  mixed: { human: 5, ai: 5, unknown: 2 },
  unknown: { human: 0, ai: 0, unknown: 12 },
};

/** Local illustration: switching examples never sends a heartbeat. */
export function HeroPanel({ locale = 'en' }: { locale?: SiteLocale }) {
  const [mode, setMode] = useState<Mode>('mixed');
  const [replay, setReplay] = useState(0);
  const th = locale === 'th';
  const labels: Record<Mode, string> = {
    human: th ? 'คนเขียน' : 'Human',
    ai: 'AI',
    mixed: th ? 'ร่วมกัน' : 'Mixed',
    unknown: th ? 'ไม่ทราบ' : 'Unknown',
  };
  const sample = SAMPLES[mode];
  return (
    <div className="mkt-hero-panel mkt-studio min-w-0">
      <div className="mkt-studio-heading">
        <span className="mkt-studio-kicker">
          <SparklesIcon aria-hidden size={14} /> ACTIVITY STUDIO
        </span>
        <span className="mkt-studio-sample">{th ? 'ข้อมูลจำลอง' : 'Illustrative demo'}</span>
      </div>
      <h2 className="mkt-studio-title">
        {th ? 'ทุกการเปลี่ยนแปลง มีเรื่องราว' : 'Every edit tells a story.'}
      </h2>
      <p className="mkt-studio-help">
        {th
          ? 'เลือกผู้เขียน แล้วดูการแบ่งสัดส่วนด้านล่าง'
          : 'Choose an author. Watch the story take shape.'}
      </p>
      <div
        aria-label={th ? 'ผู้เขียนในตัวอย่าง' : 'Sample authorship'}
        className="mkt-studio-modes"
        role="group"
      >
        {MODES.map((value) => (
          <button
            aria-pressed={mode === value}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            {labels[value]}
          </button>
        ))}
      </div>
      <div className="mkt-studio-scene" key={replay}>
        <div className="mkt-studio-editor">
          <div className="mkt-studio-file">
            <Code2Icon aria-hidden size={15} />
            <span>morning.ts</span>
            <span className="ml-auto">+12</span>
          </div>
          <div aria-hidden="true" className="mkt-studio-code">
            <div>
              <span>01</span>
              <code>const day = startSession();</code>
            </div>
            <div>
              <span>02</span>
              <code>day.track(&apos;small steps&apos;);</code>
            </div>
            <div className="mkt-studio-edit">
              <span>03</span>
              <code>return meaningfulProgress;</code>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="mkt-studio-connector">
          <ArrowDownIcon size={16} />
          <span>{th ? 'การแก้ไข → ไทม์ไลน์' : 'EDIT → TIMELINE'}</span>
          <i />
        </div>
        <div className="mkt-studio-result">
          <div className="flex items-center justify-between gap-2">
            <span>{th ? 'แบ่งตามหลักฐานผู้เขียน' : 'Authorship breakdown'}</span>
            <strong>12 {th ? 'บรรทัด' : 'lines'}</strong>
          </div>
          <div aria-hidden="true" className="mkt-studio-track">
            {(['human', 'ai', 'unknown'] as const).map((kind) => (
              <span
                data-kind={kind}
                key={kind}
                style={{ width: `${(sample[kind] / 12) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <p aria-atomic="true" aria-live="polite" className="mkt-studio-legend" role="status">
        {(['human', 'ai', 'unknown'] as const).map((kind) => (
          <span key={kind}>
            <i data-kind={kind} />
            {labels[kind]} <strong>{sample[kind]}</strong>
          </span>
        ))}
      </p>
      <div className="mkt-studio-footer">
        <p>{th ? 'ข้อมูลที่ไม่มีหลักฐานยังคงเป็น “ไม่ทราบ”' : 'Missing evidence stays unknown.'}</p>
        <button onClick={() => setReplay((value) => value + 1)} type="button">
          <RotateCcwIcon aria-hidden size={13} />
          {th ? 'เล่นอีกครั้ง' : 'Replay'}
        </button>
      </div>
    </div>
  );
}
