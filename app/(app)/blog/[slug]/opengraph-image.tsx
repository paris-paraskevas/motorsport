import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/blog';
import { loadPost } from '@/lib/posts';
import { loadSeriesMeta } from '@/lib/series';

// Per-post social share card (mirrors the weekend/session cards). Owns og:image
// for /blog/[slug] outright — file-based metadata overrides generateMetadata
// (node_modules/next/dist/docs/…/generate-metadata.md), so the page sets no
// images and every share gets the branded series-tinted card. Before this card,
// share scrapers fell back to the byline avatar — the operator's profile photo —
// on every coverless post.
// The post's cover photo (hero_image) is deliberately NOT embedded here: a
// full-bleed-photo treatment was built and dropped on operator review
// (2026-07-21) — cover sources vary in quality/resolution, while the branded
// card is sharp and on-brand every time. The cover renders on the post page
// itself (PostHero).
// Published posts only: drafts/scheduled render the generic card so nothing
// leaks through an unauthenticated image route. Must never throw.
// Node runtime — lib/posts + lib/series read fs.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Paddock Tracker — blog';

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
    // Legacy MDX posts (published by definition — the folder only ships live posts).
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

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let card: CardData = { title: 'The Paddock blog', dateLabel: '', seriesName: '', color: '#ff4136' };
  try {
    card = await resolveCard(slug);
  } catch {
    // generic card
  }

  // Branded text card, same visual language as the weekend cards.
  const titleSize = card.title.length > 90 ? 48 : card.title.length > 55 ? 60 : 76;
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
          padding: '64px',
          borderBottom: `14px solid ${card.color}`,
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
              color: card.color,
              border: `2px solid ${card.color}`,
              padding: '10px 20px',
              textTransform: 'uppercase',
            }}
          >
            Blog
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {card.seriesName ? (
            <div style={{ display: 'flex', fontSize: 32, color: '#a1a1aa', letterSpacing: 3, textTransform: 'uppercase' }}>
              {card.seriesName}
            </div>
          ) : null}
          <div style={{ display: 'flex', marginTop: 10, fontSize: titleSize, fontWeight: 800, lineHeight: 1.08 }}>
            {card.title}
          </div>
          {card.dateLabel ? (
            <div style={{ display: 'flex', marginTop: 20, fontSize: 28, color: '#84848e' }}>{card.dateLabel}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#84848e' }}>
          <span style={{ display: 'flex' }}>paddock-tracker.com</span>
          <span style={{ display: 'flex' }}>News · previews · race reports</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
