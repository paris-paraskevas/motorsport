import { readFile } from 'fs/promises';
import path from 'path';
import { ImageResponse } from 'next/og';

export const alt = 'Paddock Tracker — personal motorsport companion';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Social share card: the real crossed-flags app icon + wordmark on the 2.0
// near-black. (The previous red/white chequer grid read as a generic flag on
// Instagram link previews — operator-reported.)
export default async function OpengraphImage() {
  const icon = await readFile(
    path.join(process.cwd(), 'public', 'icons', 'icon-512.png'),
  );
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#07070a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#f5f5f7',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt="" width={280} height={280} />
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: 2,
            lineHeight: 1,
            marginTop: 24,
          }}
        >
          <span>PADDOCK</span>
          <span style={{ color: '#ffb400', margin: '0 10px' }}>•</span>
          <span>TRACKER</span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#a1a1aa',
            marginTop: 20,
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          Every session · Every series · One paddock
        </div>
      </div>
    ),
    size,
  );
}
