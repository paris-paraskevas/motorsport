import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-guard';
import { listSeriesSubmissions } from '@/lib/feeder';
import { listAllPosts, type BlogPost } from '@/lib/blog';
import { learnFeaturedPosts } from '@/lib/blog';
import { INFO_TOPICS, getTopic } from '@/lib/information/topics';
import { getInfoStats } from '@/lib/information/registry';
import { loadAllSeriesMeta } from '@/lib/series';
import { loadCuratedChampions, loadChampionNotes } from '@/lib/series-content';
import { AdminPageHeader, SubmissionRow, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Content · Admin' };

// Content: what have I published, and where are the holes.
//
// The point of this tab is the CROSS-CUTTING view. Every flag a post carries
// already exists and every one of them is set on the post's own page — status,
// series, cover, imported, Learn topic, schedule. What has never existed is a
// screen showing all of them at once, so the only way to answer "which posts are
// in Learn" or "which have no cover" was to open twenty-four posts in turn.
//
// The switch stays on the object; the overview lives here. Same for Learn
// placement: the toggle is on the studio page for a published post, and what
// this adds is the count per topic INCLUDING the topics on zero — an empty topic
// is invisible on /information, because the band only renders where something
// exists.

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const STATUS_TONE: Record<string, string> = {
  published: 'text-positive',
  in_review: 'text-brand',
  approved: 'text-brand',
  draft: 'text-text-muted',
  rejected: 'text-text-faint',
};

function Flag({ tone, children }: { tone: 'on' | 'off' | 'neutral'; children: React.ReactNode }) {
  const cls =
    tone === 'on'
      ? 'border-brand/60 text-brand'
      : tone === 'off'
        ? 'border-negative/50 text-negative'
        : 'border-border text-text-muted';
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-10 ${cls}`}>
      {children}
    </span>
  );
}

function PostRow({ p }: { p: BlogPost }) {
  const topic = p.learnTopic ? getTopic(p.learnTopic) : undefined;
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <a
          href={`${SITE_URL}/studio/${p.id}`}
          className="min-w-0 flex-1 truncate text-sm text-text hover:text-brand"
        >
          {p.title}
        </a>
        <span
          className={`shrink-0 font-mono text-10 uppercase tracking-[0.14em] ${STATUS_TONE[p.status] ?? 'text-text-faint'}`}
        >
          {p.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {p.seriesSlug ? <Flag tone="neutral">{p.seriesSlug}</Flag> : null}
        {topic ? <Flag tone="on">Learn · {topic.label}</Flag> : null}
        {p.status === 'published' && !p.learnTopic ? <Flag tone="neutral">not in Learn</Flag> : null}
        {p.heroImage ? <Flag tone="neutral">cover</Flag> : <Flag tone="off">no cover</Flag>}
        {p.originalUrl ? <Flag tone="neutral">imported</Flag> : null}
        {p.publishAt && p.status !== 'published' ? (
          <Flag tone="neutral">
            scheduled {new Date(p.publishAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </Flag>
        ) : null}
      </div>
    </li>
  );
}

export default async function AdminContentPage() {
  await requireAdmin();

  const [posts, featured, info, series, submissions] = await Promise.all([
    safe(() => listAllPosts(100), [] as BlogPost[]),
    safe(() => learnFeaturedPosts(undefined, 100), [] as BlogPost[]),
    safe(() => getInfoStats(), null),
    safe(() => loadAllSeriesMeta(), []),
    safe(() => listSeriesSubmissions(20), []),
  ]);

  // Champion-note coverage per series: how many seasons have an authored note
  // against how many the series has champions for. Both come from the bundled
  // content, so this is in-memory rather than fifteen file reads at request time.
  const coverage = await safe(
    () =>
      Promise.all(
        series.map(async m => {
          const [champions, notes] = await Promise.all([
            loadCuratedChampions(m.slug).catch(() => null),
            loadChampionNotes(m.slug).catch(() => null),
          ]);
          return {
            slug: m.slug,
            name: m.name,
            total: champions?.length ?? 0,
            done: notes ? Object.keys(notes).length : 0,
          };
        }),
      ),
    [] as { slug: string; name: string; total: number; done: number }[],
  );

  const withNotes = coverage.filter(c => c.total > 0).sort((a, b) => a.done / a.total - b.done / b.total);
  const notesDone = coverage.reduce((n, c) => n + c.done, 0);
  const notesTotal = coverage.reduce((n, c) => n + c.total, 0);

  const published = posts.filter(p => p.status === 'published');
  const noCover = published.filter(p => !p.heroImage).length;

  // Every topic, including the ones on zero — the whole reason this panel exists.
  const byTopic = INFO_TOPICS.map(t => ({
    ...t,
    posts: featured.filter(p => p.learnTopic === t.id).length,
    answers: info?.byTopic[t.id] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Content" tagline="Posts · Learn placement · where the holes are" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { v: String(published.length), l: 'posts published' },
          { v: `${published.length - noCover}/${published.length}`, l: 'have a cover' },
          { v: `${featured.length}`, l: 'featured in Learn' },
          { v: notesTotal ? `${notesDone}/${notesTotal}` : '—', l: 'champion notes' },
        ].map(s => (
          <div key={s.l} className="min-w-0 rounded-xl border border-border bg-surface-elevated p-4">
            <div className="truncate font-display text-3xl font-extrabold tabular-nums text-text">{s.v}</div>
            <div className="mt-1 truncate font-mono text-10 uppercase tracking-[0.14em] text-text-muted">{s.l}</div>
          </div>
        ))}
      </div>

      <TelemetryPanel title="Posts" meta={posts.length ? `${posts.length} newest first` : undefined} flush>
        {posts.length === 0 ? (
          <div className="p-4">
            <Unavailable note="No posts on file. Drafts written in the Studio appear here with every flag they carry." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {posts.map(p => (
              <PostRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </TelemetryPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <TelemetryPanel
          title="Learn, by topic"
          meta={`${featured.length} posts · ${info?.total ?? 0} answers`}
          flush
        >
          <ul className="divide-y divide-border">
            {byTopic.map(t => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate text-text-muted">{t.label}</span>
                <span className="flex shrink-0 items-baseline gap-3 font-mono text-11 tabular-nums">
                  <span className={t.posts === 0 ? 'text-text-faint' : 'text-brand'}>{t.posts} posts</span>
                  <span className="text-text-faint">{t.answers} answers</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-text-faint">
            A topic on zero posts is invisible on <Link href="/information" className="text-brand hover:underline">/information</Link>,
            because the contributor band only renders where something exists. That is what this column is for.
          </p>
        </TelemetryPanel>

        <TelemetryPanel title="Champion notes" meta={notesTotal ? `${notesDone} of ${notesTotal}` : undefined} flush>
          {withNotes.length === 0 ? (
            <div className="p-4">
              <Unavailable note="No curated champions on file." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {withNotes.map(c => {
                const pct = Math.round((c.done / c.total) * 100);
                return (
                  <li key={c.slug} className="px-4 py-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-text-muted">{c.name}</span>
                      <span
                        className={`shrink-0 font-mono text-11 tabular-nums ${
                          c.done === 0 ? 'text-negative' : c.done === c.total ? 'text-positive' : 'text-text'
                        }`}
                      >
                        {c.done} / {c.total}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${c.done === c.total ? 'bg-positive' : 'bg-brand'}`}
                        style={{ width: `${Math.max(pct, c.done > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TelemetryPanel>
      </div>

      <TelemetryPanel
        title="Sent in through /contribute"
        meta={submissions.length ? `${submissions.length} on file` : undefined}
        flush
      >
        {submissions.length === 0 ? (
          <div className="p-4">
            <Unavailable note="Nothing yet. Series that send their data through /contribute land here for review." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {submissions.map(s => (
              <SubmissionRow key={s.id} s={s} />
            ))}
          </ul>
        )}
      </TelemetryPanel>
    </div>
  );
}
