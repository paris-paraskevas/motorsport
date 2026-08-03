import { ImageResponse } from 'next/og';
import { loadSeries } from '@/lib/series';
import { weekendFor, weekendLabel } from '@/lib/weekend';

// Per-weekend social share card (mirrors the per-session card). A shared
// weekend link ("FIA WEC · 6 Hours of São Paulo") gets a branded, series-tinted
// image instead of the generic site card. Resolves the same data the page does;
// falls back to a generic card on any error (the image route must never throw).
// Node runtime — loadSeries reads fs.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Paddock Tracker — race weekend';

function parseRound(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; round: string }>;
}) {
  const { slug, round: roundRaw } = await params;

  let seriesName = 'Motorsport';
  let color = '#ff4136';
  let gp = '';
  let roundLabel = '';
  let dates = '';

  try {
    const round = parseRound(roundRaw);
    const series = await loadSeries(slug);
    seriesName = series.meta.name;
    color = series.meta.color || color;
    const weekend = round ? weekendFor(series, round) : null;
    if (weekend && round) {
      gp = weekendLabel(weekend, round).title;
      roundLabel = `Round ${round}`;
      dates = weekend.dateRangeLabel ?? '';
    }
  } catch {
    // generic card
  }

  const headline = gp && gp !== roundLabel ? gp : seriesName;

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
          {roundLabel ? (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                letterSpacing: 3,
                color,
                border: `2px solid ${color}`,
                padding: '10px 20px',
                textTransform: 'uppercase',
              }}
            >
              {roundLabel}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 34, color: '#a1a1aa', letterSpacing: 3, textTransform: 'uppercase' }}>
            {seriesName}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 96, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>
            <span style={{ display: 'flex' }}>{headline}</span>
            <span style={{ display: 'flex', color }}>.</span>
          </div>
          {dates ? (
            <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: '#84848e' }}>{dates}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#84848e' }}>
          <span style={{ display: 'flex' }}>paddock-tracker.com</span>
          <span style={{ display: 'flex' }}>Schedule · weather · results</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
