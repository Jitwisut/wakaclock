'use client';

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named overflow regions must be keyboard-scrollable. */

import { useState } from 'react';

import { PauseIcon, PlayIcon } from 'lucide-react';

import type { SiteLocale } from '@/lib/seo/site';

import { COMPATIBLE_EDITORS } from './editor-wall.data';

function MarqueeRow({ reverse = false }: { reverse?: boolean }) {
  const names = COMPATIBLE_EDITORS.filter((_, index) => index % 2 === (reverse ? 1 : 0));
  return (
    <div aria-hidden="true" className="axis-editor-marquee">
      <div className="wakaclock-marquee-track" data-reverse={reverse}>
        {[0, 1].map((copy) => (
          <ul className="axis-editor-group" key={copy}>
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function EditorWallSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const [paused, setPaused] = useState(false);
  const th = locale === 'th';
  const playback = th
    ? ['หยุดแถบ editor', 'เล่นแถบ editor']
    : ['Pause editor strip', 'Play editor strip'];
  return (
    <section
      aria-labelledby="editor-wall-title"
      className="axis-editor-wall mkt-reveal"
      data-marquee-paused={paused}
    >
      <div className="axis-editor-heading">
        <div>
          <span className="axis-editor-eyebrow">
            {th ? 'ทำงานในแบบที่คุณคุ้นเคย' : 'AT HOME IN YOUR WORKFLOW'}
          </span>
          <h2 id="editor-wall-title">
            {th ? 'Editor ที่คุณรัก ภาพรวมที่ชัดขึ้น' : 'Your editor. A clearer perspective.'}
          </h2>
          <p>
            {th
              ? 'เชื่อมต่อผ่าน WakaTime plugin เดิมเพื่อบันทึกเวลาเขียนโค้ด ส่วนข้อมูล AI ขึ้นอยู่กับ integration ที่ใช้'
              : 'Connect your existing WakaTime plugin to track coding time. AI attribution depends on your integration.'}
          </p>
        </div>
        <button
          aria-pressed={paused}
          className="axis-editor-playback"
          onClick={() => setPaused((value) => !value)}
          type="button"
        >
          {paused ? <PlayIcon aria-hidden size={14} /> : <PauseIcon aria-hidden size={14} />}
          {playback[paused ? 1 : 0]}
        </button>
      </div>
      <div className="axis-editor-desktop">
        <MarqueeRow />
        <MarqueeRow reverse />
      </div>
      {/* The real list is readable by assistive technology at every size. On compact
          screens it becomes a native scroll region; decorative duplicates disappear. */}
      <div
        aria-label={th ? 'รายชื่อ editor เลื่อนดูได้' : 'Browse compatible editors'}
        className="axis-editor-browser"
        role="region"
        tabIndex={0}
      >
        <ul
          aria-label={
            th
              ? 'Editor ที่เข้ากันได้ผ่าน WakaTime protocol'
              : 'Editors compatible through the WakaTime plugin protocol'
          }
          className="axis-editor-list"
        >
          {COMPATIBLE_EDITORS.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
      <p className="axis-editor-hint">
        {th ? 'ปัดซ้าย–ขวาเพื่อดูรายชื่อทั้งหมด' : 'Swipe to explore all compatible editors'}{' '}
        <span aria-hidden="true">↔</span>
      </p>
    </section>
  );
}
