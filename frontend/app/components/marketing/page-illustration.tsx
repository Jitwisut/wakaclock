import Image from 'next/image';

import type { SiteLocale } from '@/lib/seo/site';

const ARTWORK: Record<
  string,
  { alt: Record<SiteLocale, string>; caption: Record<SiteLocale, string>; src: string }
> = {
  '/ai-coding-tracker': {
    src: '/atoaxis-ai-coding-3d.png',
    caption: {
      en: 'Code from different sources, one clearer picture.',
      th: 'โค้ดจากหลายแหล่ง มองเห็นในภาพเดียว',
    },
    alt: {
      en: '3D keyboard and AI crystal feeding distinct streams of code tiles into a shared timeline',
      th: 'ภาพ 3D แป้นพิมพ์และคริสตัล AI เชื่อมสายโค้ดหลายแหล่งเข้าสู่ไทม์ไลน์เดียว',
    },
  },
  '/ai-cost-tracking': {
    src: '/atoaxis-ai-cost-3d.png',
    caption: {
      en: 'Understand the usage behind the estimate.',
      th: 'เข้าใจการใช้งานที่อยู่เบื้องหลังต้นทุน',
    },
    alt: {
      en: '3D token cubes in project trays beside a balance scale and abstract usage ledger',
      th: 'ภาพ 3D ลูกบาศก์โทเคนแยกตามถาดโปรเจกต์ ข้างตาชั่งและสมุดข้อมูลการใช้งาน',
    },
  },
  '/developer-analytics': {
    src: '/atoaxis-analytics-3d.png',
    caption: {
      en: 'Find the patterns in your working day.',
      th: 'มองเห็นรูปแบบการทำงานในแต่ละวัน',
    },
    alt: {
      en: '3D timeline, calendar activity tiles, bar columns and timer arranged as an analytics landscape',
      th: 'ภาพ 3D ไทม์ไลน์ ตารางกิจกรรม แท่งกราฟ และนาฬิกา แสดงแนวคิดการวิเคราะห์งาน',
    },
  },
  '/integrations': {
    src: '/atoaxis-integrations-3d.png',
    caption: {
      en: 'Connect your tools. Keep your workflow.',
      th: 'เชื่อมเครื่องมือ เข้ากับวิธีทำงานของคุณ',
    },
    alt: {
      en: '3D editor screens connected by cables to a central glass timeline hub',
      th: 'ภาพ 3D หน้าจอเครื่องมือเขียนโค้ด เชื่อมต่อด้วยสายเข้าสู่ศูนย์กลางไทม์ไลน์',
    },
  },
  '/teams': {
    src: '/atoaxis-teams-3d.png',
    caption: {
      en: 'A shared space, still taking shape.',
      th: 'พื้นที่ทำงานร่วมกัน ที่กำลังพัฒนา',
    },
    alt: {
      en: '3D concept model of shared coding desks with an unfinished wireframe area representing a prototype',
      th: 'ภาพแนวคิด 3D โต๊ะเขียนโค้ดร่วมกัน พร้อมพื้นที่โครงร่างที่สื่อถึงต้นแบบที่กำลังพัฒนา',
    },
  },
};

export function PageIllustration({ path, locale }: { locale: SiteLocale; path: string }) {
  const art = ARTWORK[path];
  if (!art) return null;
  return (
    <figure className="mkt-page-art mkt-reveal" data-art-page={path}>
      <Image
        alt={art.alt[locale]}
        height={1024}
        sizes="(max-width: 767px) 76vw, 340px"
        src={art.src}
        width={1536}
      />
      <figcaption>
        <span>{locale === 'th' ? 'ภาพแนวคิด' : 'Concept illustration'}</span>
        <strong>{art.caption[locale]}</strong>
        {path === '/teams' ? (
          <p>
            {locale === 'th'
              ? 'พื้นที่ทีมยังเป็นต้นแบบและอยู่ระหว่างพัฒนา'
              : 'Team spaces are a prototype and remain in development.'}
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
