import { ImageResponse } from 'next/og';
import { findDriverBySlug } from '@/lib/people';

// Per-driver social share card. 126 driver profiles all shared the one generic
// site card until 2026-08-28, which made every driver link look like every
// other. Tinted by the driver's own team colour where we have one, falling back
// to the series colour and then to brand red.
//
// Node runtime — findDriverBySlug reads the content bundle.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Paddock Tracker — driver profile';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name = 'Driver';
  let team = '';
  let seriesName = '';
  let color = '#ff4136';
  let badge = '';

  try {
    const d = await findDriverBySlug(slug);
    if (d) {
      name = d.name;
      team = d.team;
      seriesName = d.seriesName;
      color = d.teamColor || d.seriesColor || color;
      // The race number reads better than the three-letter code at this size,
      // but not every series carries one.
      badge = d.number != null ? `#${d.number}` : (d.code ?? '');
    }
  } catch {
    // generic card — an image route must never throw
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#121215',
          color: '#f5f5f7',
          padding: '72px',
          borderBottom: `14px solid ${color}`,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: 6, color: '#a1a1aa', fontWeight: 700 }}>
            PADDOCK·TRACKER
          </div>
          {badge ? (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                letterSpacing: 3,
                color,
                border: `2px solid ${color}`,
                padding: '10px 20px',
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {seriesName ? (
            <div style={{ display: 'flex', fontSize: 34, color: '#a1a1aa', letterSpacing: 3, textTransform: 'uppercase' }}>
              {seriesName}
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 88, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>
            <span style={{ display: 'flex' }}>{name}</span>
            <span style={{ display: 'flex', color }}>.</span>
          </div>
          {team ? (
            <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: '#84848e' }}>{team}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#84848e' }}>
          <span style={{ display: 'flex' }}>paddock-tracker.com</span>
          <span style={{ display: 'flex' }}>Form · results · biography</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
