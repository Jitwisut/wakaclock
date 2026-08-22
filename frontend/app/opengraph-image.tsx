import { ImageResponse } from 'next/og';

export const alt = 'AtoAxis — developer time tracking with complete history';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'center',
          padding: '72px',
          width: '100%',
        }}
      >
        <div style={{ color: '#4ade80', display: 'flex', fontSize: 28, marginBottom: 24 }}>
          ATOAXIS
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>
          Developer time tracking
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', fontSize: 42, marginTop: 18 }}>
          with your complete coding history.
        </div>
        <div style={{ color: '#64748b', display: 'flex', fontSize: 24, marginTop: 48 }}>
          WakaTime API compatible · Project analytics · AI attribution
        </div>
      </div>
    ),
    size
  );
}
