import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { NEWS_SLUG_MAP, fetchNews } from '@/lib/news';
import { loadAllSeriesMeta } from '@/lib/series';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo } from '@/lib/push';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_LINK_KEY = (slug: string) => `paddock:news:lastLink:${slug}`;
const MAX_NOTIFICATIONS_PER_RUN = 5;

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

async function authorizeCronRequest(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const header = req.headers.get('authorization');
  return header === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  const authorized = await authorizeCronRequest(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isKvConfigured()) {
    return NextResponse.json({ ok: false, error: 'kv not configured' }, { status: 503 });
  }

  try {
    const seriesMeta = await loadAllSeriesMeta();
    const metaBySlug = new Map(seriesMeta.map(s => [s.slug, s]));

    const subs = await listSubscriptions();

    // Per-user followed + notif-prefs cache for this cron run
    const userCache = new Map<string, { followed: string[] | null; newsOn: boolean; soundOn: boolean; muted: Set<string> }>();
    const getUserState = async (userId: string) => {
      const cached = userCache.get(userId);
      if (cached) return cached;
      const [followed, prefs] = await Promise.all([
        getUserFollowed(userId),
        getUserNotifPrefs(userId),
      ]);
      const state = {
        followed,
        newsOn: prefs.news,
        soundOn: prefs.sound !== false,
        muted: new Set(prefs.mutedSeries ?? []),
      };
      userCache.set(userId, state);
      return state;
    };

    let coldStart = 0;
    let unchanged = 0;
    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    const newArticles: Array<{ slug: string; title: string; link: string }> = [];

    for (const [slug, motorsportSlug] of Object.entries(NEWS_SLUG_MAP)) {
      if (!motorsportSlug) continue;
      if (newArticles.length >= MAX_NOTIFICATIONS_PER_RUN) break;

      const items = await fetchNews(slug);
      if (items.length === 0) continue;

      const top = items[0];
      const key = LAST_LINK_KEY(slug);
      const lastLink = await kv.get<string>(key);

      if (!lastLink) {
        // Cold start — record top link, don't notify
        await kv.set(key, top.link);
        coldStart++;
        continue;
      }

      if (lastLink === top.link) {
        unchanged++;
        continue;
      }

      // Genuinely new article — record and queue notification
      await kv.set(key, top.link);
      newArticles.push({ slug, title: top.title, link: top.link });
    }

    if (newArticles.length === 0 || subs.length === 0) {
      return NextResponse.json({
        ok: true,
        coldStart,
        unchanged,
        sent: 0,
        skipped: 0,
        evicted: 0,
        newArticles: newArticles.length,
      });
    }

    for (const article of newArticles) {
      const meta = metaBySlug.get(article.slug);
      if (!meta) continue;
      const payload = {
        title: `${meta.name} · News`,
        body: article.title,
        url: article.link,
        tag: `paddock-news-${article.slug}`,
        color: meta.color,
        actions: [
          { action: 'open', title: 'Read' },
          { action: 'mute', title: 'Mute series' },
        ],
        data: { seriesSlug: article.slug },
      };
      for (const { subscription, userId } of subs) {
        let silent = false;
        if (userId) {
          const state = await getUserState(userId);
          if (!state.newsOn) {
            skipped++;
            continue;
          }
          if (state.followed !== null && !state.followed.includes(article.slug)) {
            skipped++;
            continue;
          }
          if (state.muted.has(article.slug)) {
            skipped++;
            continue;
          }
          silent = !state.soundOn;
        }
        const result = await sendPushTo(
          subscription,
          silent ? { ...payload, silent: true } : payload,
        );
        if (result.ok) {
          sent++;
        } else if (result.gone) {
          await deleteSubscription(subscription.endpoint);
          evicted++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      coldStart,
      unchanged,
      newArticles: newArticles.length,
      sent,
      skipped,
      evicted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
