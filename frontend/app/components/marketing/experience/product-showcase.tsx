'use client';

import { type KeyboardEvent, useRef, useState } from 'react';

import Image from 'next/image';

import type { SiteLocale } from '@/lib/seo/site';

import { EXPERIENCE_COPY, PRODUCT_VIEWS, type ProductView } from './experience-copy';
import { PRODUCT_REPLICAS } from './product-replicas';
import { PRODUCT_SHOTS } from './product-shots';

/** Hotspot positions (percent of the frame) and what each one explains. */
const HOTSPOTS: Record<ProductView, readonly { en: string; th: string; x: number; y: number }[]> = {
  overview: [
    {
      x: 58,
      y: 52,
      en: 'A daily or weekly coding-time goal, tracked against the same timeline as every other total.',
      th: 'เป้าหมายเวลาเขียนโค้ดรายวันหรือรายสัปดาห์ วัดบนไทม์ไลน์เดียวกับยอดอื่นทั้งหมด',
    },
    {
      x: 25,
      y: 69,
      en: 'Today’s total is built from heartbeat-derived duration blocks; idle gaps close a block instead of padding it.',
      th: 'ยอดวันนี้มาจาก duration block ที่สร้างจาก heartbeat ช่วงว่างจะปิด block แทนการนับต่อ',
    },
    {
      x: 49,
      y: 84,
      en: 'A WakaTime-compatible total is available beside AtoAxis’s own count, so an imported history can be compared.',
      th: 'มียอดแบบเดียวกับ WakaTime แสดงคู่กับยอดของ AtoAxis เพื่อเทียบกับประวัติที่ import มา',
    },
  ],
  timeline: [
    {
      x: 56,
      y: 16,
      en: 'Filters live in the URL: project, language, editor and branch, shareable as a link.',
      th: 'ตัวกรองอยู่ใน URL ทั้งโปรเจกต์ ภาษา editor และ branch แชร์เป็นลิงก์ได้',
    },
    {
      x: 92,
      y: 31,
      en: 'Activity by hour shows your rhythm; drill from here into the heatmap and the file list.',
      th: 'กิจกรรมรายชั่วโมงบอกจังหวะการทำงาน และเจาะต่อไปยัง heatmap และรายชื่อไฟล์ได้',
    },
    {
      x: 92,
      y: 66,
      en: 'Each lane is a day; human, AI and Unattributed blocks keep their own pattern.',
      th: 'แต่ละแถวคือหนึ่งวัน block ของคน AI และ Unattributed แยกลวดลายกันชัดเจน',
    },
  ],
  projects: [
    {
      x: 93,
      y: 34,
      en: 'Time by project, and the same range broken down by language, editor and branch.',
      th: 'เวลาแยกตามโปรเจกต์ และแยกช่วงเดียวกันตามภาษา editor และ branch',
    },
    {
      x: 46,
      y: 91,
      en: 'Regex project rules and manual merges group several checkouts into one project, server-side.',
      th: 'Project rules แบบ regex และการ merge รวมหลาย checkout เป็นโปรเจกต์เดียวฝั่ง server',
    },
  ],
  'human-ai': [
    {
      x: 93,
      y: 43,
      en: 'Line changes split three ways: AI, human and Unattributed.',
      th: 'การเปลี่ยนแปลงบรรทัดแบ่งเป็นสามกลุ่ม: AI, human และ Unattributed',
    },
    {
      x: 28,
      y: 78,
      en: 'Coverage is reported as a percentage; missing evidence is never shown as zero.',
      th: 'รายงาน coverage เป็นเปอร์เซ็นต์ ข้อมูลที่ไม่มีหลักฐานจะไม่ถูกแสดงเป็นศูนย์',
    },
    {
      x: 62,
      y: 78,
      en: 'AI line counts are aggregated per agent and per day from each agent’s hook.',
      th: 'จำนวนบรรทัดของ AI รวมตาม agent และวัน จาก hook ของแต่ละ agent',
    },
  ],
};

/**
 * The product chapter's centrepiece: four real product views behind tabs, with numbered
 * hotspots. The ordered list under the frame carries the same explanations as the
 * hotspots, so nothing is available only by pointing at an image.
 */
export function ProductShowcase({ locale }: { locale: SiteLocale }) {
  const copy = EXPERIENCE_COPY[locale].product;
  const [view, setView] = useState<ProductView>('overview');
  const [spot, setSpot] = useState<null | number>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (next: ProductView) => {
    setView(next);
    setSpot(null);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = PRODUCT_VIEWS.indexOf(view);
    let next = index;
    switch (event.key) {
      case 'ArrowRight': {
        next = (index + 1) % PRODUCT_VIEWS.length;
        break;
      }
      case 'ArrowLeft': {
        next = (index - 1 + PRODUCT_VIEWS.length) % PRODUCT_VIEWS.length;
        break;
      }
      case 'Home': {
        next = 0;
        break;
      }
      case 'End': {
        next = PRODUCT_VIEWS.length - 1;
        break;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    select(PRODUCT_VIEWS[next]);
    tabs.current[next]?.focus();
  };

  return (
    <div className="axx-showcase">
      <div
        aria-label={copy.tabsLabel}
        className="axx-tabs"
        onKeyDown={onKey}
        role="tablist"
        tabIndex={-1}
      >
        {PRODUCT_VIEWS.map((id, index) => (
          <button
            aria-controls={`axx-panel-${id}`}
            aria-selected={view === id}
            data-magnetic
            id={`axx-tab-${id}`}
            key={id}
            onClick={() => select(id)}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            tabIndex={view === id ? 0 : -1}
            type="button"
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            {copy.views[id].tab}
          </button>
        ))}
      </div>
      {PRODUCT_VIEWS.map((id) => {
        const Replica = PRODUCT_REPLICAS[id];
        const shot = PRODUCT_SHOTS[id];
        const spots = HOTSPOTS[id];
        return (
          <div
            aria-labelledby={`axx-tab-${id}`}
            className="axx-panel"
            hidden={view !== id}
            id={`axx-panel-${id}`}
            key={id}
            role="tabpanel"
          >
            <div className="axx-panel-copy">
              <h3>{copy.views[id].title}</h3>
              <p>{copy.views[id].body}</p>
            </div>
            <figure className="axx-frame">
              <div className="axx-frame-stage">
                {shot ? (
                  <Image
                    alt={shot.alt[locale]}
                    height={shot.height}
                    sizes="(max-width: 1023px) 92vw, 880px"
                    src={shot.src}
                    width={shot.width}
                  />
                ) : view === id ? (
                  // Only the visible panel draws its illustration. The three hidden replicas
                  // were ~600 DOM nodes of demo markup; each panel's heading, body and notes
                  // stay in the HTML regardless, so nothing indexable is lost.
                  <Replica locale={locale} />
                ) : null}
                {spots.map((hotspot, index) => (
                  <button
                    aria-controls={`axx-note-${id}-${index}`}
                    aria-expanded={spot === index}
                    aria-label={`${copy.hotspotsLabel} ${index + 1}`}
                    className="axx-hotspot"
                    data-cursor={String(index + 1)}
                    key={hotspot.en}
                    onClick={() => setSpot(spot === index ? null : index)}
                    style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                    type="button"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <figcaption>{shot ? copy.screenshot : copy.illustration}</figcaption>
            </figure>
            <ol aria-label={copy.hotspotsLabel} className="axx-notes">
              {spots.map((hotspot, index) => (
                <li data-active={spot === index} id={`axx-note-${id}-${index}`} key={hotspot.en}>
                  <span aria-hidden="true">{index + 1}</span>
                  {hotspot[locale]}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
