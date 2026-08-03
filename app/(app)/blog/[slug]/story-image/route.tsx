import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/blog';
import { loadPost } from '@/lib/posts';
import { loadSeriesMeta } from '@/lib/series';

// 9:16 portrait share card (1080x1920) for Instagram / other Stories — fills a
// phone screen, unlike the 1200x630 og:image card (which letterboxes into a small
// band on a Story). BlogShare fetches this and hands it to the native share sheet.
// Mirrors the og card's branded look (opengraph-image.tsx); the small resolver is
// duplicated here rather than shared, to avoid touching the og:image route (a
// landmine — file-based metadata owns og:image). Published posts only: drafts /
// scheduled render the generic card so nothing leaks through this public route.
export const runtime = 'nodejs';

interface CardData {
  title: string;
  dateLabel: string;
  seriesName: string;
  color: string;
}

async function resolveCard(slug: string): Promise<CardData> {
  const card: CardData = { title: 'The Paddock blog', dateLabel: '', seriesName: '', color: '#ff4136' };
  const db = await getPostBySlug(slug);
  let title = '';
  let dateIso = '';
  let seriesSlug: string | null = null;
  if (db && db.status === 'published') {
    title = db.title;
    dateIso = db.publishedAt ?? db.createdAt;
    seriesSlug = db.seriesSlug;
  } else if (!db) {
    const mdx = await loadPost(slug);
    if (mdx) {
      title = mdx.frontmatter.title;
      dateIso = mdx.frontmatter.publishedAt;
      seriesSlug = mdx.frontmatter.seriesSlug ?? null;
    }
  }
  if (title) {
    card.title = title;
    const d = new Date(dateIso);
    if (!Number.isNaN(d.getTime())) {
      card.dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
    if (seriesSlug) {
      const meta = await loadSeriesMeta(seriesSlug).catch(() => null);
      if (meta) {
        card.seriesName = meta.name;
        card.color = meta.color || card.color;
      }
    }
  }
  return card;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let card: CardData = { title: 'The Paddock blog', dateLabel: '', seriesName: '', color: '#ff4136' };
  try {
    card = await resolveCard(slug);
  } catch {
    // generic card
  }

  // Large title that fills the portrait canvas; step down for longer headlines.
  const titleSize = card.title.length > 120 ? 76 : card.title.length > 70 ? 92 : 116;

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
          padding: '110px 84px',
          borderBottom: `30px solid ${card.color}`,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 46, letterSpacing: 10, color: '#a1a1aa', fontWeight: 700 }}>
            PADDOCK·TRACKER
          </div>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              marginTop: 28,
              fontSize: 34,
              letterSpacing: 4,
              color: card.color,
              border: `3px solid ${card.color}`,
              padding: '12px 28px',
              textTransform: 'uppercase',
            }}
          >
            Blog
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {card.seriesName ? (
            <div style={{ display: 'flex', fontSize: 46, color: '#a1a1aa', letterSpacing: 4, textTransform: 'uppercase' }}>
              {card.seriesName}
            </div>
          ) : null}
          <div style={{ display: 'flex', marginTop: 22, fontSize: titleSize, fontWeight: 800, lineHeight: 1.06 }}>
            {card.title}
          </div>
          {card.dateLabel ? (
            <div style={{ display: 'flex', marginTop: 34, fontSize: 42, color: '#84848e' }}>{card.dateLabel}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 42, color: '#84848e' }}>
          <span style={{ display: 'flex', color: '#f5f5f7', fontWeight: 700 }}>paddock-tracker.com</span>
          <span style={{ display: 'flex', marginTop: 8 }}>News · previews · race reports</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
