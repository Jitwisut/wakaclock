import { absoluteUrl, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

const VIDEO_PATH = '/media/atoaxis-tour.mp4';
const POSTER_PATH = '/media/atoaxis-tour-poster.webp';
const CAPTIONS_PATH = '/media/atoaxis-tour.en.vtt';
/** Recorded from the live site and edited on this date; update both when re-cut. */
const UPLOAD_DATE = '2026-10-10';
const DURATION = 'PT30S';

const COPY = {
  en: {
    title: `${SITE_NAME} product tour`,
    caption:
      'A 30-second tour recorded from this website: the time-ring overview, the Human + AI split, the AI coding tracker and planned pricing.',
    description:
      'A 30-second recording of the AtoAxis website showing coding time by project, the WakaTime-compatible setup, separate Human and AI attribution with coverage, and planned Early Access pricing.',
  },
  th: {
    title: `วิดีโอแนะนำ ${SITE_NAME}`,
    caption:
      'วิดีโอ 30 วินาทีที่บันทึกจากเว็บไซต์นี้ (คำบรรยายภาษาอังกฤษ): ภาพรวมวงแหวนเวลา การแยกงานคนกับ AI หน้า AI coding tracker และราคาที่วางแผนไว้',
    description:
      'วิดีโอ 30 วินาทีจากเว็บไซต์ AtoAxis แสดงเวลาเขียนโค้ดแยกตามโปรเจกต์ การตั้งค่าที่รองรับ WakaTime การแยก attribution ของคนกับ AI พร้อม coverage และราคาช่วง Early Access',
  },
} as const;

/** VideoObject for the tour; pages add it to their single JSON-LD graph. */
export function productTourSchema(locale: SiteLocale) {
  const copy = COPY[locale];
  return {
    '@type': 'VideoObject',
    name: copy.title,
    description: copy.description,
    thumbnailUrl: absoluteUrl(POSTER_PATH),
    contentUrl: absoluteUrl(VIDEO_PATH),
    uploadDate: UPLOAD_DATE,
    duration: DURATION,
    inLanguage: 'en',
  };
}

/**
 * A short product tour, recorded from the live site rather than staged, so it shows only
 * what the pages already describe. `preload="none"` keeps it off the network until played.
 */
export function ProductTour({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale];
  return (
    <figure className="mkt-product-tour mt-8">
      <video
        className="w-full rounded-xl"
        controls
        height={720}
        playsInline
        poster={POSTER_PATH}
        preload="none"
        title={copy.title}
        width={1280}
      >
        <source src={VIDEO_PATH} type="video/mp4" />
        {/* The video is silent; this track repeats the on-screen captions for assistive tech. */}
        <track default kind="captions" label="English" src={CAPTIONS_PATH} srcLang="en" />
      </video>
      <figcaption className="mt-3 text-sm opacity-75">{copy.caption}</figcaption>
    </figure>
  );
}
