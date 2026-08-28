import { ImageResponse } from 'next/og';
import { loadSeriesMeta } from '@/lib/series';

/** Shared renderer for the series social card.
 *
 *  Two consumers: `/series/[slug]` and `/series/[slug]/[tab]`. They need
 *  separate route files because **`opengraph-image.tsx` is not inherited by a
 *  nested dynamic segment** — measured 2026-08-28, when marking the tabs
 *  `ownCard` left all 73 of them with no og:image at all. Re-exporting the
 *  parent route was tried first and fails outright: Next cannot recognise a
 *  re-exported `runtime` field and the route 500s.
 *
 *  So: one renderer here, two thin route files. A copy in each would let the
 *  tab card drift from the series card it is meant to match. */
export async function seriesCard(slug: string): Promise<ImageResponse> {
  let name = 'Motorsport';
  let color = '#ff4136';
  let season = '';

  try {
    const meta = await loadSeriesMeta(slug);
    name = meta.name;
    color = meta.color || color;
    season = meta.season ? String(meta.season) : '';
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
          {season ? (
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
              {season} SEASON
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              fontSize: 96,
              fontWeight: 800,
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            <span style={{ display: 'flex' }}>{name}</span>
            <span style={{ display: 'flex', color }}>.</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#84848e' }}>
          <span style={{ display: 'flex' }}>paddock-tracker.com</span>
          <span style={{ display: 'flex' }}>Calendar · standings · results</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
