import Link from 'next/link';

import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { breadcrumbSchema, type FaqEntry, faqSchema, graph, webPageSchema } from '@/lib/seo/schema';
import {
  createMarketingMetadata,
  localizedPath,
  PRICING,
  PRODUCT_STATUS,
  SITE_NAME,
  type SiteLocale,
} from '@/lib/seo/site';

import { AnswerGuide } from './answer-guide';
import { EarlyAccessForm } from './early-access-form';
import { FaqSection } from './faq-section';
import { productTourSchema } from './product-tour';
import { QuickStartSection } from './quick-start-section';
import {
  MKT_ACCENT,
  MKT_ACCENT_FG,
  MKT_BORDER,
  MKT_DISPLAY_FONT,
  MKT_FG,
  MKT_FG_MUTED,
} from './tokens';

/**
 * `/join` — the campaign landing page.
 *
 * Deliberately a different page from `/early-access`, which is the plain form. This one
 * carries the offer: one screenful that says what the product does, what it costs, what
 * it cannot do yet, and how long setup takes, so a link from an ad or a post lands
 * somewhere that answers all four without a second click.
 *
 * Everything claimed here is already claimed elsewhere on the site and backed by shipped
 * code. There is no invented urgency: Early Access is a list, not a checkout, and the
 * page says so in the same size type as the offer.
 */
const COPY = {
  en: {
    badge: 'Early Access, no card required',
    breadcrumb: 'Join Early Access',
    title: 'Your coding history,\nkept whole.',
    description:
      'Join AtoAxis Early Access: WakaTime-compatible developer time tracking with your complete coding history and AI attribution. No card required.',
    lead: `${SITE_NAME} turns editor heartbeats into time, project, language and AI-attribution analytics, and never ages your history out to a recent window. Point an existing WakaTime plugin at it and keep the setup you already have.`,
    primaryCta: 'Get my Early Access key',
    secondaryCta: 'See the 5-minute setup',
    honesty: `${PRODUCT_STATUS.en.label} is a waiting list, not a checkout. ${PRODUCT_STATUS.en.signup} The hosted product has no free tier at launch.`,
    valueHeading: 'What you get on day one',
    values: [
      {
        title: 'Complete history, in the base plan',
        body: 'No week-long or fortnight-long dashboard window, and no higher tier to buy to see last quarter.',
      },
      {
        title: 'AI work counted separately',
        body: 'Bundled hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI attribute AI lines apart from your keystrokes.',
      },
      {
        title: 'Time you can defend',
        body: 'Close heartbeats become duration blocks; idle gaps are excluded rather than rounded up.',
      },
      {
        title: 'Your existing plugin still works',
        body: `${SITE_NAME} implements the WakaTime API, so most editors need one changed line, not a new extension.`,
      },
    ],
    priceHeading: 'What it will cost',
    priceBody: `One plan with every feature included: $${PRICING.monthlyUsd}/month, or $${PRICING.annualUsd}/year. Checkout is not open during Early Access.`,
    priceNote: 'Compared with the competition',
    faqHeading: 'Before you sign up',
    faq: [
      {
        question: 'What happens after I join?',
        answer:
          'You go on the Early Access list and receive launch updates by email. When keys are issued you get one for your account.',
      },
      {
        question: 'Do I have to stop using WakaTime?',
        answer: `No. ${SITE_NAME} implements the WakaTime API and can import a WakaTime export, so you can run it alongside and compare before deciding.`,
      },
      {
        question: 'Does it read my source code?',
        answer:
          'No. A heartbeat carries file metadata and counts: path, project, branch, language, editor, keystroke and character counts. It never carries file contents, prompts or AI responses.',
      },
      {
        question: 'What is not ready yet?',
        answer:
          'Full team and organisation dashboards are still in development, though opt-in leaderboards and a presence prototype exist where the server runs PostgreSQL. Only the VS Code plugin is first-party, and Cursor and Copilot need adapters before their activity is attributed.',
      },
    ],
  },
  th: {
    badge: 'Early Access ไม่ต้องใช้บัตร',
    breadcrumb: 'เข้าร่วม Early Access',
    title: 'ประวัติการเขียนโค้ดของคุณ\nเก็บไว้ครบทุกวัน',
    description:
      'เข้าร่วม Early Access ของ AtoAxis ติดตามเวลาเขียนโค้ดที่รองรับ WakaTime เก็บประวัติครบทุกวัน และแยกงานจาก AI ไม่ต้องใช้บัตรเครดิต',
    lead: `${SITE_NAME} เปลี่ยน heartbeat จาก editor เป็นข้อมูลเวลา โปรเจกต์ ภาษา และ AI attribution โดยไม่ตัดประวัติเหลือเฉพาะช่วงล่าสุด ถ้าคุณมี WakaTime plugin อยู่แล้ว ก็ชี้มาที่นี่ได้เลยโดยไม่ต้องเปลี่ยนวิธีทำงาน`,
    primaryCta: 'ขอ key สำหรับ Early Access',
    secondaryCta: 'ดูวิธีติดตั้งใน 5 นาที',
    honesty: `${PRODUCT_STATUS.th.label} คือรายชื่อรอ ไม่ใช่หน้าชำระเงิน ${PRODUCT_STATUS.th.signup} ผลิตภัณฑ์ hosted จะไม่มี free tier ตอนเปิดตัว`,
    valueHeading: 'สิ่งที่ได้ตั้งแต่วันแรก',
    values: [
      {
        title: 'ประวัติครบถ้วนในแผนหลัก',
        body: 'ไม่จำกัด dashboard เหลือแค่หนึ่งหรือสองสัปดาห์ และไม่ต้องซื้อ tier สูงกว่าเพื่อดูไตรมาสที่แล้ว',
      },
      {
        title: 'นับงานฝั่ง AI แยกออกมา',
        body: 'มี hook สำหรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ที่แยก AI lines ออกจาก keystroke ของคุณ',
      },
      {
        title: 'ตัวเลขเวลาที่อธิบายได้',
        body: 'heartbeat ที่ต่อเนื่องกันกลายเป็น duration block ส่วนช่วงที่ไม่มีกิจกรรมถูกตัดออก ไม่ใช่ปัดขึ้น',
      },
      {
        title: 'plugin เดิมยังใช้ได้',
        body: `${SITE_NAME} รองรับ WakaTime API ทำให้ editor ส่วนใหญ่แก้แค่บรรทัดเดียว ไม่ต้องติดตั้ง extension ใหม่`,
      },
    ],
    priceHeading: 'ราคาที่วางไว้',
    priceBody: `แผนเดียวรวมทุกฟีเจอร์ $${PRICING.monthlyUsd} ต่อเดือน หรือ $${PRICING.annualUsd} ต่อปี ช่วง Early Access ยังไม่เปิด checkout`,
    priceNote: 'เทียบกับเจ้าอื่นในตลาด',
    faqHeading: 'ก่อนตัดสินใจลงทะเบียน',
    faq: [
      {
        question: 'ลงทะเบียนแล้วเกิดอะไรขึ้นต่อ',
        answer:
          'ชื่อของคุณจะอยู่ในรายชื่อ Early Access และได้รับข่าวการเปิดตัวทางอีเมล เมื่อถึงรอบออก key เราจะส่ง key สำหรับบัญชีของคุณให้',
      },
      {
        question: 'ต้องเลิกใช้ WakaTime ไหม',
        answer: `ไม่ต้อง ${SITE_NAME} รองรับ WakaTime API และ import ไฟล์ export ของ WakaTime ได้ จึงใช้คู่กันเพื่อเทียบผลก่อนตัดสินใจได้`,
      },
      {
        question: 'ระบบอ่าน source code ของเราหรือเปล่า',
        answer:
          'ไม่ heartbeat มีแค่ metadata และตัวเลข เช่น path, project, branch, ภาษา, editor และจำนวน keystroke กับ character ไม่มีเนื้อหาไฟล์ prompt หรือคำตอบของ AI',
      },
      {
        question: 'อะไรที่ยังไม่พร้อม',
        answer:
          'dashboard สำหรับทีมและองค์กรเต็มรูปแบบยังอยู่ระหว่างพัฒนา แต่มี leaderboard แบบ opt-in และ presence prototype เมื่อ server รัน PostgreSQL plugin ที่เราดูแลเองมีเฉพาะ VS Code ส่วน Cursor และ Copilot ต้องมี adapter ก่อนจึงจะ attribute งานได้',
      },
    ],
  },
} as const;

export function campaignPageMetadata(locale: SiteLocale) {
  const copy = COPY[locale];
  const title = `${SITE_NAME} — ${copy.title.replace('\n', ' ')}`;

  return {
    ...createMarketingMetadata({ description: copy.description, locale, path: '/join', title }),
    // A plain string title is rendered through the root layout's `%s | AtoAxis` template.
    // This one already names the product, so it has to opt out or the brand appears twice.
    title: { absolute: title },
  };
}

export function CampaignPage({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy = COPY[locale];
  const breadcrumbs = [
    { name: locale === 'th' ? 'หน้าหลัก' : 'Home', path: localizedPath(locale, '/') },
    { name: copy.breadcrumb, path: localizedPath(locale, '/join') },
  ];

  return (
    <>
      <section className="mkt-campaign-intro mx-auto max-w-6xl px-4 pt-16 pb-12 md:px-6 md:pt-24">
        <p
          className="mkt-pixel-shadow-sm mb-6 inline-flex items-center gap-2 border-2 px-3 py-1.5 text-xs font-bold"
          style={{
            background: 'var(--mkt-highlight-soft)',
            borderColor: MKT_BORDER,
            color: MKT_FG,
          }}
        >
          <span
            aria-hidden
            className="mkt-blink inline-block size-2"
            style={{ background: MKT_ACCENT }}
          />
          {copy.badge}
        </p>

        <h1
          className="text-4xl leading-[1.15] font-bold tracking-tight text-balance md:text-6xl"
          style={{ fontFamily: MKT_DISPLAY_FONT }}
        >
          {copy.title.split('\n').map((line, index) => (
            <span
              className="block"
              key={line}
              style={index === 1 ? { color: MKT_ACCENT } : undefined}
            >
              {line}
            </span>
          ))}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty" style={{ color: MKT_FG_MUTED }}>
          {copy.lead}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="font-bold"
            size="lg"
            style={{ background: MKT_ACCENT, color: MKT_ACCENT_FG }}
          >
            <Link href="#early-access">{copy.primaryCta}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#quick-start">{copy.secondaryCta}</Link>
          </Button>
        </div>

        <p className="mx-auto mt-6 max-w-xl text-xs" style={{ color: MKT_FG_MUTED }}>
          {copy.honesty}
        </p>
      </section>

      <section className="axis-campaign-values mkt-reveal">
        <h2
          className="mb-10 text-center text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: MKT_DISPLAY_FONT }}
        >
          {copy.valueHeading}
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {copy.values.map((value, index) => (
            /* Numbered rather than iconified: the count tells the reader how much is left
               to read, which an abstract glyph cannot, and it keeps the card free of
               decoration that would repeat what the heading already says. */
            <li className="axis-campaign-value" key={value.title}>
              <span
                aria-hidden
                className="inline-flex size-10 shrink-0 items-center justify-center border-2 text-sm font-bold"
                style={{
                  color: MKT_ACCENT,
                  fontFamily: MKT_DISPLAY_FONT,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-base font-bold">{value.title}</h3>
                <p className="mt-2 text-sm" style={{ color: MKT_FG_MUTED }}>
                  {value.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="axis-campaign-price mkt-reveal">
        <div
          className="mkt-pixel-shadow border-[3px] p-8 text-center"
          style={{ background: 'var(--mkt-bg-sunken)', borderColor: MKT_BORDER }}
        >
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: MKT_DISPLAY_FONT }}
          >
            {copy.priceHeading}
          </h2>
          <p className="mt-3 text-base" style={{ color: MKT_FG_MUTED }}>
            {copy.priceBody}
          </p>
          <Link
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
            href={localizedPath(locale, '/wakatime-alternative')}
            style={{ color: MKT_ACCENT }}
          >
            {copy.priceNote}
          </Link>
        </div>
      </section>

      <AnswerGuide locale={locale} path="/join" />

      <QuickStartSection locale={locale} />
      <EarlyAccessForm locale={locale} sourcePage={`${locale}/join`} />
      <FaqSection entries={copy.faq} heading={copy.faqHeading} id="join-faq" locale={locale} />
      {/* Rendered last, not first: see the note in marketing-home-page.tsx. */}
      <JsonLd
        data={graph(
          webPageSchema({
            path: '/join',
            locale,
            name: copy.title.replace('\n', ' '),
            description: copy.lead,
          }),
          breadcrumbSchema(breadcrumbs),
          faqSchema(copy.faq as readonly FaqEntry[]),
          productTourSchema(locale)
        )}
      />
    </>
  );
}
