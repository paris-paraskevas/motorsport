'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MarkdownEditor } from '@/components/blog/MarkdownEditor';
import { readinessChecks } from '@/lib/post-ready';
import {
  STATUS_META,
  defaultLocalDateTime,
  toLocalInput,
  fmtWhen,
  postAction,
  type PostAction,
} from './studio-shared';

// The studio's full-page editor for one post (/studio/[id]) — the single editing
// surface (the old /blog/[slug] pencil-edit routed here). Editable fields match
// the PATCH contract exactly: title, summary, body, cover. Slug, series and tags
// are immutable after creation; the rail shows them read-only. Actions live in
// the rail and follow status + role; Submit/Approve are disabled while there are
// unsaved changes so what gets submitted is always what was last saved.

export interface StudioEditorPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  heroImage: string | null;
  seriesSlug: string | null;
  tags: string[];
  /** Import provenance (create-time only, read-only here) — non-null marks the
   *  post as an import whose canonical points off-site. */
  originalUrl: string | null;
  status: 'draft' | 'in_review' | 'approved';
  publishAt: string | null;
}

const FIELD =
  'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';
const BTN_PRIMARY =
  'w-full rounded bg-brand-fill px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90 disabled:opacity-40';
const BTN_QUIET =
  'w-full rounded border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-40';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function RailFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        {label}
      </div>
      <div className="mt-0.5 break-all font-mono text-xs text-text-muted">{value}</div>
    </div>
  );
}

const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL || 'https://buymeacoffee.com/parisp';

export function StudioEditor({
  post,
  admin,
  aiTools,
}: {
  post: StudioEditorPost;
  admin: boolean;
  /** Supporter gate: AI tools render disabled without it (admins pass; everyone
   *  else needs the donor flag an admin sets on /admin/users). The API enforces
   *  the same rule server-side — this is display, not security. */
  aiTools: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [summary, setSummary] = useState(post.summary);
  const [body, setBody] = useState(post.body);
  const [hero, setHero] = useState(post.heroImage ?? '');
  const [when, setWhen] = useState(() =>
    post.status === 'approved' ? toLocalInput(post.publishAt) : defaultLocalDateTime(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  // AI heading proposal under review. `from` pins the body it was computed
  // against, so Apply can refuse if the draft changed underneath it.
  const [headingReview, setHeadingReview] = useState<{
    from: string;
    body: string;
    inserted: { heading: string; excerpt: string }[];
  } | null>(null);
  const [headingNote, setHeadingNote] = useState<string | null>(null);

  // Live post-readiness over the CURRENT (possibly unsaved) fields — the
  // checklist reflects what Save would persist, not what the server has.
  const readiness = useMemo(
    () =>
      readinessChecks({
        summary,
        seriesSlug: post.seriesSlug,
        heroImage: hero.trim() || null,
        body,
      }),
    [summary, hero, body, post.seriesSlug],
  );

  const dirty =
    title !== post.title ||
    summary !== post.summary ||
    body !== post.body ||
    hero.trim() !== (post.heroImage ?? '');

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, summary, body, heroImage: hero.trim() || null }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      router.refresh(); // fresh post props arrive; `dirty` settles false
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function run(action: PostAction) {
    setBusy(true);
    setError(null);
    const res = await postAction(post.id, action, when);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  // Auto-link (deterministic, insert-only — lib/post-ready): the result replaces
  // the EDITOR body as unsaved changes, so the author reads the diff in place
  // (or via Preview) and Save is the accept step. Nothing persists here.
  async function autoLink() {
    setBusy(true);
    setError(null);
    setLinkNote(null);
    try {
      const res = await fetch('/api/blog/format', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        body?: string;
        added?: { name: string }[];
        error?: string;
      };
      if (!res.ok || typeof d.body !== 'string') {
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      if (!d.added || d.added.length === 0) {
        setLinkNote('No new links found: every known name is either absent or already linked.');
        return;
      }
      setBody(d.body);
      setLinkNote(`Linked ${d.added.map(a => a.name).join(', ')}. Review, then save.`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // AI section headings (item 17 phase 2): the model proposes {before, heading}
  // pairs, the server inserts them behind a byte-identity guard, and the result
  // lands HERE as a reviewable proposal — Apply replaces the editor body as
  // unsaved changes (same contract as Auto-link), Save is the accept step.
  async function proposeHeadings() {
    if (!aiTools) return;
    setBusy(true);
    setError(null);
    setHeadingNote(null);
    setHeadingReview(null);
    const from = body;
    try {
      const res = await fetch('/api/blog/headings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: from, title }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        body?: string;
        inserted?: { heading: string; excerpt: string }[];
        error?: string;
      };
      if (!res.ok || typeof d.body !== 'string' || !Array.isArray(d.inserted)) {
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      if (d.inserted.length === 0) {
        setHeadingNote('No sections proposed: the model reads the piece as fine without more.');
        return;
      }
      setHeadingReview({ from, body: d.body, inserted: d.inserted });
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function applyHeadings() {
    if (!headingReview || headingReview.from !== body) return;
    setBody(headingReview.body);
    setHeadingReview(null);
    setHeadingNote('Sections inserted. Review the draft, then save.');
  }

  const meta = STATUS_META[post.status];
  const decide = admin && (post.status === 'draft' || post.status === 'in_review');

  return (
    <form onSubmit={save} className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10 lg:items-start">
      <div className="min-w-0 space-y-4">
        <Field label="Title">
          <input
            className={`${FIELD} text-lg font-semibold`}
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={140}
            required
          />
        </Field>
        <Field label="Summary">
          <textarea
            className={FIELD}
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={2}
            maxLength={300}
            required
          />
        </Field>
        <div>
          <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Body
          </span>
          <MarkdownEditor value={body} onChange={setBody} minHeightClass="min-h-[60vh]" />
        </div>
      </div>

      <aside className="mt-8 space-y-5 border-t border-border pt-6 lg:sticky lg:top-24 lg:mt-0 lg:border-t-0 lg:pt-0">
        <div className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>
          {meta.label}
          {post.status === 'approved' && post.publishAt && (
            <span className="ml-2 normal-case tracking-normal text-text-faint">
              publishes {fmtWhen(post.publishAt)}
            </span>
          )}
        </div>

        <div className="space-y-3 border-y border-border py-4">
          <RailFact label="Slug" value={post.slug} />
          <RailFact label="Series" value={post.seriesSlug ?? 'site-wide'} />
          {post.tags.length > 0 && <RailFact label="Tags" value={post.tags.join(', ')} />}
          {post.originalUrl !== null && <RailFact label="Imported from" value={post.originalUrl} />}
          <Link
            href={`/blog/${post.slug}`}
            className="inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
          >
            Open preview ↗
          </Link>
        </div>

        <section>
          <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Post-ready
          </h3>
          <ul className="space-y-1.5">
            {readiness.map(c => (
              <li key={c.key} className="text-xs leading-snug">
                <span className={c.ok ? 'text-text-muted' : 'text-amber-700 dark:text-amber-300'}>
                  <span aria-hidden="true" className="mr-1.5 font-mono">
                    {c.ok ? '✓' : '✗'}
                  </span>
                  {c.label}
                </span>
                {!c.ok && <span className="block pl-4 text-text-faint">{c.hint}</span>}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={autoLink}
            className="mt-2.5 w-full rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-40"
          >
            Auto-link names
          </button>
          {linkNote && <p className="mt-1.5 text-xs leading-snug text-text-muted">{linkNote}</p>}
          <button
            type="button"
            disabled={busy || !aiTools}
            onClick={proposeHeadings}
            className="mt-1.5 w-full rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-40"
          >
            Propose sections (AI)
          </button>
          {!aiTools && (
            <p className="mt-1.5 text-xs leading-snug text-text-faint">
              AI tools are a supporter perk:{' '}
              <a
                href={COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted underline underline-offset-2 transition-colors duration-(--duration-fast) hover:text-text"
              >
                buy me a coffee
              </a>{' '}
              and they unlock on your account.
            </p>
          )}
          {headingNote && <p className="mt-1.5 text-xs leading-snug text-text-muted">{headingNote}</p>}
          {headingReview && (
            <div className="mt-2 space-y-2 rounded border border-border bg-surface p-2.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                Proposed sections
              </p>
              <ul className="space-y-1.5">
                {headingReview.inserted.map(h => (
                  <li key={h.heading} className="text-xs leading-snug">
                    <span className="block font-semibold text-text">## {h.heading}</span>
                    <span className="block text-text-faint">before “{h.excerpt.slice(0, 60)}…”</span>
                  </li>
                ))}
              </ul>
              {headingReview.from !== body ? (
                <p className="text-xs leading-snug text-amber-700 dark:text-amber-300">
                  The draft changed since this proposal. Propose again.
                </p>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyHeadings}
                    className="flex-1 rounded bg-brand-fill px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeadingReview(null)}
                    className="flex-1 rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <Field label="Cover image URL">
          <input
            className={`${FIELD} font-mono text-xs`}
            value={hero}
            onChange={e => setHero(e.target.value)}
            placeholder="https://… (blank = none)"
            maxLength={2048}
          />
        </Field>
        {hero.trim() && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.trim()}
            alt="Cover preview"
            width={256}
            height={134}
            className="aspect-[1200/630] w-full rounded border border-border bg-surface object-cover"
          />
        )}

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}

        <div className="space-y-2">
          <button type="submit" disabled={busy || !dirty} className={BTN_PRIMARY}>
            {busy ? 'Working…' : dirty ? 'Save changes' : 'Saved'}
          </button>
          {post.status === 'draft' && (
            <button
              type="button"
              disabled={busy || dirty}
              title={dirty ? 'Save first — submitting sends the saved version' : undefined}
              onClick={() => run('submit')}
              className={BTN_QUIET}
            >
              Submit for review
            </button>
          )}
          {decide && (
            <>
              <Field label="Publish time">
                <input
                  type="datetime-local"
                  value={when}
                  onChange={e => setWhen(e.target.value)}
                  className={`${FIELD} font-mono text-xs`}
                  aria-label="Publish time"
                />
              </Field>
              <button
                type="button"
                disabled={busy || dirty}
                title={dirty ? 'Save first — approving publishes the saved version' : undefined}
                onClick={() => run('approve')}
                className={BTN_PRIMARY}
              >
                Approve + schedule
              </button>
              <button type="button" disabled={busy} onClick={() => run('reject')} className={BTN_QUIET}>
                Reject
              </button>
            </>
          )}
          {post.status === 'approved' && admin && (
            <>
              <Field label="New publish time">
                <input
                  type="datetime-local"
                  value={when}
                  onChange={e => setWhen(e.target.value)}
                  className={`${FIELD} font-mono text-xs`}
                  aria-label="New publish time"
                />
              </Field>
              <button type="button" disabled={busy} onClick={() => run('reschedule')} className={BTN_QUIET}>
                Re-schedule
              </button>
            </>
          )}
        </div>

        {post.status === 'in_review' && !admin && (
          <p className="font-mono text-[10px] leading-relaxed text-text-faint">
            Submitted, waiting on the editor. Edits you save still count until it publishes.
          </p>
        )}
      </aside>
    </form>
  );
}
