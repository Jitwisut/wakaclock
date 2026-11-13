import { ImageResponse } from 'next/og';

/**
 * The social preview every public page points its `og:image` / `twitter:image` at
 * (`SOCIAL_IMAGE_PATH` in lib/seo/site.ts).
 *
 * This file must live in `app/`. It sat one directory up, beside `package.json`, where
 * Next.js never registers it as a route — so `/opengraph-image` returned 404 and every
 * shared link rendered without a preview. `scripts/check-prerender.mjs` now fails the
 * build check if the route is missing from the output.
 */
export const alt = 'AtoAxis — developer time tracking and AI coding analytics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: '#0b0f0d',
        color: '#f4f1e8',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        padding: '72px',
        width: '100%',
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex' }}>
        <div
          style={{
            background: '#2fbf71',
            borderRadius: 999,
            display: 'flex',
            height: 20,
            marginRight: 18,
            width: 20,
          }}
        />
        <div style={{ color: '#2fbf71', display: 'flex', fontSize: 30, letterSpacing: 6 }}>
          ATOAXIS
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>
          Developer time tracking
        </div>
        <div style={{ color: '#2fbf71', display: 'flex', fontSize: 76, fontWeight: 700 }}>
          &amp; AI coding analytics
        </div>
        <div style={{ color: '#a9b3ac', display: 'flex', fontSize: 34, marginTop: 28 }}>
          Complete coding history. Human and AI work, counted separately.
        </div>
      </div>
      <div
        style={{
          borderTop: '2px solid #24302a',
          color: '#7f8a83',
          display: 'flex',
          fontSize: 26,
          justifyContent: 'space-between',
          paddingTop: 28,
        }}
      >
        <div style={{ display: 'flex' }}>WakaTime API compatible</div>
        <div style={{ display: 'flex' }}>No source code uploaded</div>
        <div style={{ display: 'flex' }}>atoaxis.com</div>
      </div>
    </div>,
    size
  );
}
