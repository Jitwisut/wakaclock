import type { SiteLocale } from '@/lib/seo/site';

import {
  DEMO_BLOCKS,
  DEMO_DAYS,
  DEMO_DAYS_TH,
  DEMO_PROJECTS,
  DEMO_SUMMARY,
  formatMinutes,
} from './experience-data';

/**
 * HTML illustrations of the four product views, drawn in the dashboard's own visual
 * language (square pixel shadows, the deep green hero card, the lime accent, monospace
 * figures) so the marketing page shows what the product actually looks like.
 *
 * They are illustrations with demo data, and every caller captions them that way. When a
 * real screenshot is configured in `product-shots.ts`, the showcase uses it instead.
 */

type Locale = SiteLocale;
const th = (locale: Locale) => locale === 'th';

/** The worked example's week. Values are the ones the interpretation paragraph states. */
export const WEEKLY_BARS = [55, 78, 40, 92, 65, 18, 10] as const;

function Chrome({ children, path }: { children: React.ReactNode; path: string }) {
  return (
    <div className="axx-ui">
      <div aria-hidden="true" className="axx-ui-chrome">
        <span />
        <span />
        <span />
        <em>{path}</em>
      </div>
      <div className="axx-ui-body">{children}</div>
    </div>
  );
}

function Tile({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div className="axx-ui-tile">
      <span className="axx-ui-label">{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

/** Chapter 4: the week the interpretation paragraph walks through. */
export function WeekTimeline({ locale }: { locale: Locale }) {
  const days = th(locale) ? DEMO_DAYS_TH : DEMO_DAYS;
  const tiles = th(locale)
    ? [
        ['วันนี้', '5ชม. 42น.'],
        ['สัปดาห์นี้', '28ชม. 10น.'],
        ['มี AI ช่วย', '34%'],
        ['โปรเจกต์ปัจจุบัน', 'atoaxis'],
      ]
    : [
        ['Today', '5h 42m'],
        ['This week', '28h 10m'],
        ['AI-assisted', '34%'],
        ['Active project', 'atoaxis'],
      ];
  return (
    <Chrome path="app.atoaxis.com/dashboard/wakaclock">
      <div className="axx-ui-tiles">
        {tiles.map(([label, value]) => (
          <Tile key={label} label={label} value={value} />
        ))}
      </div>
      <div className="axx-ui-card">
        <span className="axx-ui-label">
          {th(locale) ? 'Activity ย้อนหลัง 7 วัน' : 'Activity, last 7 days'}
        </span>
        <div className="axx-ui-week">
          {WEEKLY_BARS.map((pct, index) => (
            <div key={days[index]}>
              <span className="mkt-chart-bar" style={{ height: `${pct}%` }} />
              <em>{days[index]}</em>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function OverviewView({ locale }: { locale: Locale }) {
  const t = th(locale);
  return (
    <Chrome path="app.atoaxis.com/dashboard/wakaclock">
      <div className="axx-ui-title">
        <strong>{t ? 'ภาพรวม' : 'Overview'}</strong>
        <span>
          {t
            ? 'เวลา โฟกัส และความก้าวหน้าของคุณ'
            : 'A clearer view of your time, focus, and progress.'}
        </span>
      </div>
      <div className="axx-ui-hero">
        <div>
          <span className="axx-ui-kicker">{t ? 'เป้าหมายวันนี้' : 'TODAY’S QUEST'}</span>
          <strong>{t ? 'เขียนโค้ด 6 ชม.' : 'Code for 6h'}</strong>
          <div className="axx-ui-progress">
            <span style={{ width: '95%' }} />
          </div>
          <small>{t ? '5ชม. 42น. จาก 6ชม.' : '5h 42m of 6h'}</small>
        </div>
        <div aria-hidden="true" className="axx-ui-hero-art">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="axx-ui-tiles">
        <Tile label={t ? 'วันนี้' : 'TODAY'} note={t ? 'กำลังทำงาน' : 'Active'} value="5h 42m" />
        <Tile
          label={t ? 'เวลาเขียนโค้ดทั้งหมด' : 'ALL-TIME ACTIVE CODING'}
          note={t ? 'มียอดแบบ WakaTime ให้ดูด้วย' : 'WakaTime-compatible total also available'}
          value="412h 06m"
        />
        <Tile label={t ? 'วันที่มีกิจกรรม' : 'DAYS WITH ACTIVITY'} value="70" />
        <Tile label={t ? 'เริ่มบันทึกเมื่อ' : 'CODING SINCE'} value="06/2026" />
      </div>
    </Chrome>
  );
}

function hourlyMinutes() {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const block of DEMO_BLOCKS) {
    hours[Math.floor(block.startMin / 60) % 24] += block.durationMin;
  }
  return hours.map((minutes, hour) => ({ hour, minutes }));
}
const HOURS = hourlyMinutes();
const HOUR_MAX = Math.max(...HOURS.map((entry) => entry.minutes));

function TimelineView({ locale }: { locale: Locale }) {
  const t = th(locale);
  const lanes = [7, 8, 9, 10, 11, 12, 13];
  const days = t ? DEMO_DAYS_TH : DEMO_DAYS;
  return (
    <Chrome path="app.atoaxis.com/dashboard/wakaclock/analytics/timeline">
      <div aria-hidden="true" className="axx-ui-filters">
        <span>project: all</span>
        <span>language: all</span>
        <span>editor: all</span>
        <span>7d</span>
      </div>
      <div className="axx-ui-card">
        <span className="axx-ui-label">
          {t ? 'จังหวะกิจกรรมรายชั่วโมง' : 'Activity rhythm by hour'}
        </span>
        <div className="axx-ui-hours">
          {HOURS.map(({ hour, minutes }) => (
            <span
              key={`hour-${hour}`}
              style={{ height: `${Math.max(4, (minutes / HOUR_MAX) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="axx-ui-card">
        <span className="axx-ui-label">{t ? 'ไทม์ไลน์รายวัน' : 'Daily timeline'}</span>
        <div className="axx-ui-lanes">
          {lanes.map((day, index) => (
            <div className="axx-ui-lane" key={day}>
              <em>{days[index]}</em>
              <div>
                {DEMO_BLOCKS.filter((block) => block.day === day).map((block) => (
                  <span
                    data-kind={block.kind}
                    key={block.startMin}
                    style={{
                      left: `${(block.startMin / 1440) * 100}%`,
                      width: `${Math.max(0.25, (block.durationMin / 1440) * 100)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function ProjectsView({ locale }: { locale: Locale }) {
  const t = th(locale);
  const total = DEMO_SUMMARY.totalMin;
  const rows = DEMO_PROJECTS.map((name, index) => ({
    name,
    minutes: DEMO_SUMMARY.byProject[index],
  })).sort((a, b) => b.minutes - a.minutes);
  return (
    <Chrome path="app.atoaxis.com/dashboard/wakaclock/analytics/projects">
      <div className="axx-ui-title">
        <strong>{t ? 'โปรเจกต์' : 'Projects'}</strong>
        <span>{t ? '14 วันล่าสุด' : 'Last 14 days'}</span>
      </div>
      <div className="axx-ui-card">
        <ul className="axx-ui-projects">
          {rows.map((row) => (
            <li key={row.name}>
              <span>{row.name}</span>
              <div>
                <i style={{ width: `${(row.minutes / rows[0].minutes) * 100}%` }} />
              </div>
              <strong>{formatMinutes(row.minutes, locale)}</strong>
              <em>{Math.round((row.minutes / total) * 100)}%</em>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden="true" className="axx-ui-chips">
        <span>TypeScript</span>
        <span>Rust</span>
        <span>VS Code</span>
        <span>main</span>
      </div>
    </Chrome>
  );
}

function HumanAiView({ locale }: { locale: Locale }) {
  const t = th(locale);
  const split = [
    { kind: 0, label: t ? 'คน' : 'Human', value: 58 },
    { kind: 1, label: 'AI', value: 34 },
    { kind: 2, label: 'Unattributed', value: 8 },
  ];
  return (
    <Chrome path="app.atoaxis.com/dashboard/wakaclock/analytics/human-ai">
      <div className="axx-ui-title">
        <strong>{t ? 'คน vs AI' : 'Human vs AI'}</strong>
        <span>
          {t
            ? 'Attribution คือการระบุที่มาของการเปลี่ยนแปลงโค้ด ไม่ใช่การวัดเวลาหรือคุณภาพ'
            : 'AI attribution is code-change attribution, not a measure of time or quality.'}
        </span>
      </div>
      <div className="axx-ui-card">
        <span className="axx-ui-label">{t ? 'การเปลี่ยนแปลงบรรทัด' : 'Line changes'}</span>
        <div className="axx-ui-split">
          {split.map((part) => (
            <span data-kind={part.kind} key={part.kind} style={{ flexGrow: part.value }} />
          ))}
        </div>
        <ul className="axx-ui-legend">
          {split.map((part) => (
            <li key={part.kind}>
              <i data-kind={part.kind} />
              {part.label} <strong>{part.value}%</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="axx-ui-tiles">
        <Tile
          label={t ? 'Coverage' : 'COVERAGE'}
          note={t ? 'ส่วนที่มีหลักฐาน' : 'Share with evidence'}
          value="92%"
        />
        <Tile label="CLAUDE CODE" value="21%" />
        <Tile label="CODEX CLI" value="13%" />
      </div>
    </Chrome>
  );
}

export const PRODUCT_REPLICAS = {
  overview: OverviewView,
  timeline: TimelineView,
  projects: ProjectsView,
  'human-ai': HumanAiView,
} as const;
