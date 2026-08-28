import { ImageResponse } from 'next/og';
import { getInfoEntry } from '@/lib/information/registry';
import { getTopic } from '@/lib/information/topics';

// Per-answer social share card for the Learn section — 654 pages, every one of
// which shared the single generic site card until 2026-08-28. These are the
// most shareable pages we have (a question with an answer is what people link
// to), so the card leads with the question itself.
//
// Node runtime — the registry reads the content bundle.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Paddock Tracker — answer';

/** The questions run from "Who won the 2020 F1 championship?" to
 *  "Who has won the most ADAC Ravenol 24h Nürburgring championships?", so a
 *  fixed size either clips the long ones or wastes the card on the short ones. */
function headlineSize(text: string): number {
  if (text.length <= 34) return 84;
  if (text.length <= 52) return 68;
  if (text.length <= 72) return 56;
  return 46;
}

export default async function Image({
  params,
}: {
  params: Promise<{ topic: string; slug: string }>;
}) {
  const { topic, slug } = await params;

  let question = 'Motorsport, answered';
  let topicLabel = 'Learn';
  const color = '#ff4136';

  try {
    const entry = await getInfoEntry(topic, slug);
    if (entry) question = entry.question;
    topicLabel = getTopic(topic)?.label ?? topicLabel;
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
            {topicLabel}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: headlineSize(question),
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {question}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#84848e' }}>
          <span style={{ display: 'flex' }}>paddock-tracker.com</span>
          <span style={{ display: 'flex' }}>Answered, and sourced</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
