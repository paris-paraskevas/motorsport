import { ImageResponse } from 'next/og';
import { loadSeries } from '@/lib/series';
import { sessionBySlug, weekendFor, weekendLabel } from '@/lib/weekend';

// Per-session social share card. The Decoder / Race Story are built to be
// shared ("Verstappen vs Norris — Monaco Q"), so every session page gets a
// branded OG image; F1 qualifying/race carry the telemetry badge. Resolves the
// same data the page does; falls back to a generic card on any error (the image
// route must never throw). Node runtime — loadSeries reads fs.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Paddock Tracker — F1 session';

function parseRound(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; round: string; session: string }>;
}) {
  const { slug, round: roundRaw, session: sessionParam } = await params;

  let seriesName = 'Motorsport';
  let color = '#e10600';
  let gp = '';
  let sessionName = 'Session';
  let badge: string | null = null;

  try {
    const round = parseRound(roundRaw);
    const series = await loadSeries(slug);
    seriesName = series.meta.name;
    color = series.meta.color || color;
    const weekend = round ? weekendFor(series, round) : null;
    if (weekend && round) {
      gp = weekendLabel(weekend, round).title;
      const session = sessionBySlug(weekend, sessionParam);
      if (session) {
        sessionName = session.title.replace(/^.*?[-–—:]\s*/, '').trim() || session.title;
      }
    }
    const isQuali = /qualifying|superpole|shootout/i.test(sessionName);
    const isRace = !isQuali && /race|sprint/i.test(sessionName);
    if (slug === 'f1' && isQuali) badge = 'Qualifying Analysis';
    else if (slug === 'f1' && isRace) badge = 'Race Story';
  } catch {
    // generic card
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
          background: '#07070a',
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
                textTransform: 'uppercase',
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 34, color: '#a1a1aa', letterSpacing: 3, textTransform: 'uppercase' }}>
            {gp ? `${seriesName} · ${gp}` : seriesName}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 128, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>
            <span style={{ display: 'flex' }}>{sessionName}</span>
            <span style={{ display: 'flex', color }}>.</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#84848e' }}>
          <span style={{ display: 'flex' }}>paddock-tracker.com</span>
          <span style={{ display: 'flex' }}>Telemetry via OpenF1 · unofficial</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
