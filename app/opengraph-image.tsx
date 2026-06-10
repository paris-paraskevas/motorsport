import { ImageResponse } from 'next/og';

export const alt = 'Paddock Tracker — personal motorsport companion';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
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
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', marginBottom: 56 }}>
          {[0, 1, 2, 3].map(col => (
            <div key={col} style={{ display: 'flex', flexDirection: 'column' }}>
              {[0, 1, 2, 3].map(row => (
                <div
                  key={row}
                  style={{
                    width: 84,
                    height: 84,
                    background: (col + row) % 2 === 0 ? '#e10600' : '#f5f5f5',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          Paddock Tracker
        </div>
        <div
          style={{
            fontSize: 30,
            color: '#a1a1aa',
            marginTop: 16,
            letterSpacing: 0.5,
          }}
        >
          F1 · MotoGP · WEC · Formula E · WRC · IndyCar · NASCAR · IMSA · DTM
        </div>
      </div>
    ),
    size,
  );
}
