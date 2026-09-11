import Image from 'next/image';

import type { SiteLocale } from '@/lib/seo/site';

export function WorkspaceIllustrationSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const th = locale === 'th';
  return (
    <section className="mkt-workspace-story mkt-reveal mx-auto max-w-6xl px-4 md:px-6">
      <figure className="mkt-workspace-art">
        <Image
          alt={
            th
              ? 'ภาพประกอบ 3D ของโต๊ะเขียนโค้ดสีเขียว พร้อมนาฬิกา ไทม์ไลน์กระจก และคริสตัลที่สื่อถึง AI'
              : '3D green coding workspace with a timer, glass timeline panels, and a crystal representing AI'
          }
          height={1024}
          sizes="(max-width: 767px) 76vw, 400px"
          src="/atoaxis-coding-workspace-3d.png"
          width={1536}
        />
        <figcaption>
          {th ? 'ภาพแนวคิด: โค้ด เวลา และ AI' : 'Concept illustration: code, time, and AI'}
        </figcaption>
      </figure>
      <div className="mkt-workspace-copy">
        <span className="mkt-workspace-eyebrow">ATOAXIS / YOUR WORK, IN VIEW</span>
        <h2>
          {th ? 'ทุกช่วงเวลาที่ลงมือ\nมีเรื่องราวให้มองเห็น' : 'See the story\nbehind your work.'}
        </h2>
        <p>
          {th
            ? 'จากโค้ดที่เขียน สู่เวลาที่ใช้ในแต่ละโปรเจกต์ AtoAxis ช่วยให้คุณมองย้อนกลับไปเห็นงานของตัวเอง พร้อมแยกการมีส่วนร่วมของ AI ตามข้อมูลที่เครื่องมือรายงาน'
            : 'From the code you write to the time you spend on each project, AtoAxis brings your work into view—with AI contributions identified from the evidence your tools report.'}
        </p>
        <div className="mkt-workspace-topics">
          <span>{th ? 'เวลาของคุณ' : 'Your time'}</span>
          <span>{th ? 'โปรเจกต์ของคุณ' : 'Your projects'}</span>
          <span>{th ? 'การมีส่วนร่วมของ AI' : 'AI contributions'}</span>
        </div>
      </div>
    </section>
  );
}
